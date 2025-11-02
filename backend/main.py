from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
from datetime import datetime, timedelta
import sys
import os
from pathlib import Path
import numpy as np

# Add current directory to path to import the environment
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

from stable_baselines3 import PPO
from travel_environment.env.travel_environment import TravelEnvironment

app = FastAPI(title="Event Optimizer API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained model
MODEL_PATH = current_dir / "trained_ppo_travel_model_expanded.zip"
try:
    model = PPO.load(str(MODEL_PATH))
    print(f"✅ Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    print(f"⚠️ Warning: Could not load model: {e}")
    model = None


# Request/Response Models
class AvailabilityWindow(BaseModel):
    start: str  # ISO 8601 format: "2025-12-10T09:00:00Z"
    end: str

class EventDuration(BaseModel):
    days: int
    hours: int

class OptimizeEventRequest(BaseModel):
    attendees: Dict[str, int]  # {"Mumbai": 2, "Shanghai": 3, ...}
    availability_window: AvailabilityWindow
    event_duration: EventDuration

class EventDates(BaseModel):
    start: str
    end: str

class EventSpan(BaseModel):
    start: str
    end: str

class EventLocationCoordinates(BaseModel):
    latitude: float
    longitude: float

class OptimizeEventResponse(BaseModel):
    event_location: str
    event_location_coordinates: EventLocationCoordinates
    event_dates: EventDates
    event_span: EventSpan
    total_co2: float
    average_travel_hours: float
    median_travel_hours: float
    max_travel_hours: float
    min_travel_hours: float
    attendee_travel_hours: Dict[str, float]


@app.get("/")
def read_root():
    return {
        "message": "Event Optimizer API",
        "version": "1.0.0",
        "endpoints": {
            "/optimize-event": "POST - Optimize event location and schedule",
            "/health": "GET - Health check"
        }
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": model is not None
    }


@app.post("/optimize-event", response_model=OptimizeEventResponse)
async def optimize_event(request: OptimizeEventRequest):
    """
    Optimize event location and schedule based on attendee locations,
    availability window, and event duration.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Convert request to scenario format for the model
        scenario = {
            "attendees": request.attendees,
            "availability_window": {
                "start": request.availability_window.start,
                "end": request.availability_window.end
            },
            "event_duration": {
                "days": request.event_duration.days,
                "hours": request.event_duration.hours
            }
        }
        
        # Create environment with the scenario
        env = TravelEnvironment(scenario)
        
        # Reset environment and get initial observations
        obs, info = env.reset()
        
        # Get actions from the model for each agent
        actions = {}
        for agent in env.agents:
            agent_obs = obs[agent]
            action, _ = model.predict(agent_obs, deterministic=True)
            actions[agent] = int(action)
        
        # Step through the environment to get the recommendation
        observations, rewards, dones, truncated, infos = env.step(actions)
        
        # Extract the chosen location
        if not env.agents:
            raise HTTPException(status_code=500, detail="No agents in environment")
        
        first_agent = env.agents[0]
        chosen_city = infos[first_agent].get("chosen_city")
        
        if not chosen_city:
            raise HTTPException(status_code=500, detail="No location chosen by model")
        
        # Get coordinates for the chosen city from training data
        chosen_city_iata = env.city_to_iata.get(chosen_city)
        event_latitude = None
        event_longitude = None
        
        if chosen_city_iata:
            # Look up coordinates in the training data
            city_data = env.training_df[env.training_df['arrival_location'] == chosen_city_iata]
            if not city_data.empty:
                event_latitude = float(city_data.iloc[0]['arrival_latitude'])
                event_longitude = float(city_data.iloc[0]['arrival_longitude'])
        
        # Fallback if coordinates not found
        if event_latitude is None or event_longitude is None:
            # Default coordinates (could be improved with a geocoding API)
            event_latitude = 0.0
            event_longitude = 0.0
        
        # Calculate travel metrics for each attendee home location
        attendee_travel_hours = {}
        all_travel_times = []
        total_co2 = 0.0
        
        for agent in env.agents:
            home_city = env.agent_home_locations[agent]
            
            # Get travel time in hours
            travel_time = env.travel_matrix[agent][chosen_city]
            co2_emission = env.co2_emissions[agent][chosen_city]
            
            # Store travel time per home location (not per agent)
            if home_city not in attendee_travel_hours:
                attendee_travel_hours[home_city] = travel_time
            
            all_travel_times.append(travel_time)
            total_co2 += co2_emission
        
        # Calculate statistics
        average_travel_hours = float(np.mean(all_travel_times))
        median_travel_hours = float(np.median(all_travel_times))
        max_travel_hours = float(np.max(all_travel_times))
        min_travel_hours = float(np.min(all_travel_times))
        
        # Parse dates
        availability_start = datetime.fromisoformat(request.availability_window.start.replace('Z', '+00:00'))
        availability_end = datetime.fromisoformat(request.availability_window.end.replace('Z', '+00:00'))
        
        # Calculate event dates considering travel time
        # Event should start after the longest travel time + buffer
        max_travel_duration = timedelta(hours=max_travel_hours)
        buffer_duration = timedelta(hours=2)  # 2-hour buffer for check-in, rest, etc.
        
        # Event starts after max travel time + buffer from availability window start
        event_start = availability_start + max_travel_duration + buffer_duration
        
        # Event duration
        total_event_hours = request.event_duration.days * 24 + request.event_duration.hours
        event_duration = timedelta(hours=total_event_hours)
        event_end = event_start + event_duration
        
        # Event span includes travel time before and after
        # Earliest departure: someone might leave immediately at availability start
        event_span_start = availability_start
        
        # Latest return: event end + max travel time back
        event_span_end = event_end + max_travel_duration
        
        # Ensure event fits within availability window
        if event_end > availability_end:
            # Adjust to fit within availability window
            event_end = availability_end
            event_start = event_end - event_duration
            if event_start < availability_start:
                event_start = availability_start
                event_end = min(event_start + event_duration, availability_end)
        
        # Format dates as ISO 8601
        response = OptimizeEventResponse(
            event_location=chosen_city,
            event_location_coordinates=EventLocationCoordinates(
                latitude=round(event_latitude, 6),
                longitude=round(event_longitude, 6)
            ),
            event_dates=EventDates(
                start=event_start.isoformat().replace('+00:00', 'Z'),
                end=event_end.isoformat().replace('+00:00', 'Z')
            ),
            event_span=EventSpan(
                start=event_span_start.isoformat().replace('+00:00', 'Z'),
                end=event_span_end.isoformat().replace('+00:00', 'Z')
            ),
            total_co2=round(total_co2, 2),
            average_travel_hours=round(average_travel_hours, 2),
            median_travel_hours=round(median_travel_hours, 2),
            max_travel_hours=round(max_travel_hours, 2),
            min_travel_hours=round(min_travel_hours, 2),
            attendee_travel_hours={city: round(hours, 2) for city, hours in attendee_travel_hours.items()}
        )
        
        return response
        
    except Exception as e:
        print(f"Error in optimize_event: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error optimizing event: {str(e)}")
    

'''
Command to restart the server:
lsof -ti:8000 | xargs kill -9 2>/dev/null; sleep 2; cd /Users/george_mahabir/GitHub_Repos/durhack2025/backend && /opt/anaconda3/envs/durhack/bin/python -m uvicorn main:app --reload --port 8000
'''