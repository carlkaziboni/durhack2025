from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
from datetime import datetime, timedelta
import sys
import os
from pathlib import Path
import numpy as np
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import asyncio
import time

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

# Note: FastAPI runs with async/await, but CPU-bound operations should run in threads
# Stable-baselines3 model.predict can benefit from batch processing when possible

# Load the trained model
MODEL_PATH = current_dir / "trained_ppo_travel_model_expanded.zip"
try:
    model = PPO.load(str(MODEL_PATH))
    print(f"✅ Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    print(f"⚠️ Warning: Could not load model: {e}")
    model = None

# Load and cache travel data at startup
def load_travel_data():
    """Load CSV data once at startup and build fast lookup dictionaries."""
    print("📊 Loading travel data...")
    
    # Determine paths (same logic as TravelEnvironment)
    base_dir = current_dir
    training_data_path = base_dir / "training_data.csv"
    codes_data_path = base_dir / "codes.csv"
    
    # Load CSVs
    training_df = pd.read_csv(training_data_path)
    codes_df = pd.read_csv(codes_data_path)
    
    print(f"   Loaded {len(training_df):,} flight records and {len(codes_df):,} airport codes")
    
    # Build fast lookup dictionary: origin_iata -> dest_iata -> {time, co2, timezone, distance}
    # This replaces slow DataFrame queries with O(1) dictionary lookups
    flight_data_cache = {}
    penalties = {
        'avg_time': 1440.0,  # 24 hours in minutes
        'avg_co2_emissions': 500.0,
        'timezone_offset_diff': 12.0,
        'avg_distance': 15000.0
    }
    
    # Pre-build lookup dictionary from DataFrame
    for _, row in training_df.iterrows():
        origin = row['departure_location']
        dest = row['arrival_location']
        
        if origin not in flight_data_cache:
            flight_data_cache[origin] = {}
        
        # Store all flight data for this route
        flight_data_cache[origin][dest] = {
            'avg_time': float(row['avg_time']) if pd.notna(row['avg_time']) and not np.isinf(row['avg_time']) else penalties['avg_time'],
            'avg_co2_emissions': float(row['avg_co2_emissions']) if pd.notna(row['avg_co2_emissions']) and not np.isinf(row['avg_co2_emissions']) else penalties['avg_co2_emissions'],
            'timezone_offset_diff': float(row['timezone_offset_diff']) if pd.notna(row['timezone_offset_diff']) and not np.isinf(row['timezone_offset_diff']) else penalties['timezone_offset_diff'],
            'avg_distance': float(row['avg_distance']) if pd.notna(row['avg_distance']) and not np.isinf(row['avg_distance']) else penalties['avg_distance'],
            'arrival_latitude': float(row['arrival_latitude']) if pd.notna(row['arrival_latitude']) and not np.isinf(row['arrival_latitude']) else 0.0,
            'arrival_longitude': float(row['arrival_longitude']) if pd.notna(row['arrival_longitude']) and not np.isinf(row['arrival_longitude']) else 0.0,
        }
    
    print(f"   Built lookup cache with {len(flight_data_cache):,} origin airports")
    
    # Build IATA to coordinates cache for fast coordinate lookups
    print("   Building coordinate cache...")
    iata_to_coordinates = {}
    for origin_iata in flight_data_cache:
        for dest_iata, route_data in flight_data_cache[origin_iata].items():
            if dest_iata not in iata_to_coordinates:
                lat = route_data['arrival_latitude']
                lon = route_data['arrival_longitude']
                if lat != 0.0 and lon != 0.0:
                    iata_to_coordinates[dest_iata] = {'latitude': lat, 'longitude': lon}
    
    print(f"   Built coordinate cache with {len(iata_to_coordinates):,} locations")
    
    # Build city to IATA mapping (same as in TravelEnvironment)
    city_to_iata = {
        # === QRT HEADQUARTERS (Attendee Home Locations) ===
        "London": "LHR",
        "Paris": "CDG",
        "Hong Kong": "HKG",
        "Singapore": "SIN",
        "Mumbai": "BOM",
        "Dubai": "DXB",
        "Shanghai": "PVG",
        "Zurich": "ZRH",
        "Geneva": "GVA",
        "Aarhus": "AAR",
        "Sydney": "SYD",
        "Wroclaw": "WRO",
        "Budapest": "BUD",
        
        # === DESTINATION CITIES (Potential Meeting Locations) ===
        # North America
        "New York": "JFK",
        "Los Angeles": "LAX",
        "Chicago": "ORD",
        "San Francisco": "SFO",
        "Miami": "MIA",
        "Boston": "BOS",
        "Seattle": "SEA",
        "Washington DC": "IAD",
        "Toronto": "YYZ",
        "Vancouver": "YVR",
        "Montreal": "YUL",
        "Mexico City": "MEX",
        "Cancun": "CUN",
        
        # Europe
        "Amsterdam": "AMS",
        "Berlin": "TXL",
        "Frankfurt": "FRA",
        "Barcelona": "BCN",
        "Madrid": "MAD",
        "Rome": "FCO",
        "Milan": "MXP",
        "Vienna": "VIE",
        "Brussels": "BRU",
        "Copenhagen": "CPH",
        "Stockholm": "ARN",
        "Oslo": "OSL",
        "Lisbon": "LIS",
        "Dublin": "DUB",
        "Edinburgh": "EDI",
        "Manchester": "MAN",
        "Athens": "ATH",
        "Prague": "PRG",
        "Krakow": "KRK",
        "Helsinki": "HEL",
        "Reykjavik": "KEF",
        "Nice": "NCE",
        "Lyon": "LYS",
        
        # Middle East
        "Abu Dhabi": "AUH",
        "Doha": "DOH",
        "Riyadh": "RUH",
        "Tel Aviv": "TLV",
        "Amman": "AMM",
        "Beirut": "BEY",
        
        # Asia Pacific
        "Tokyo": "NRT",
        "Seoul": "ICN",
        "Taipei": "TPE",
        "Bangkok": "BKK",
        "Kuala Lumpur": "KUL",
        "Jakarta": "CGK",
        "Beijing": "PEK",
        "Guangzhou": "CAN",
        "Shenzhen": "SZX",
        "Hanoi": "HAN",
        "Ho Chi Minh City": "SGN",
        "Manila": "MNL",
        "Bangalore": "BLR",
        "Delhi": "DEL",
        "Kolkata": "CCU",
        "Melbourne": "MEL",
        "Brisbane": "BNE",
        "Auckland": "AKL",
        "Christchurch": "CHC",
        "Perth": "PER",
        "Adelaide": "ADL",
        
        # South America
        "Sao Paulo": "GRU",
        "Rio de Janeiro": "GIG",
        "Buenos Aires": "EZE",
        "Santiago": "SCL",
        "Lima": "LIM",
        "Bogota": "BOG",
        "Quito": "UIO",
        
        # Africa
        "Johannesburg": "JNB",
        "Cape Town": "CPT",
        "Nairobi": "NBO",
        "Lagos": "LOS",
        "Cairo": "CAI",
        "Casablanca": "CMN",
        "Tunis": "TUN",
        "Accra": "ACC"
    }
    
    return {
        'flight_data_cache': flight_data_cache,
        'training_df': training_df,  # Keep for coordinate lookups
        'codes_df': codes_df,
        'city_to_iata': city_to_iata,
        'penalties': penalties,
        'iata_to_coordinates': iata_to_coordinates  # Fast coordinate lookup
    }

# Load data at startup
print("🚀 Starting up Event Optimizer API...")
try:
    travel_data = load_travel_data()
    print("✅ Travel data loaded and cached successfully")
except Exception as e:
    print(f"❌ Error loading travel data: {e}")
    import traceback
    traceback.print_exc()
    travel_data = None


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
    
    if travel_data is None:
        raise HTTPException(status_code=503, detail="Travel data not loaded")
    
    try:
        start_time = time.time()
        
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
        
        # Create environment with the scenario and cached data
        # This is now parallelized internally for travel matrix building
        env = TravelEnvironment(scenario, travel_data=travel_data)
        
        env_time = time.time()
        print(f"⏱️  Environment creation: {env_time - start_time:.3f}s")
        
        # Reset environment and get initial observations
        obs, info = env.reset()
        
        reset_time = time.time()
        print(f"⏱️  Environment reset: {reset_time - env_time:.3f}s")
        
        # Get actions from the model for each agent
        # Try batch prediction first (most efficient), fallback to parallel threading
        actions = {}
        try:
            # Batch all observations together if model supports it (most efficient)
            obs_list = [obs[agent] for agent in env.agents]
            obs_array = np.array(obs_list)
            actions_array, _ = model.predict(obs_array, deterministic=True)
            actions = {agent: int(actions_array[i]) for i, agent in enumerate(env.agents)}
            print(f"⏱️  Batch prediction: {time.time() - reset_time:.3f}s")
        except (ValueError, TypeError, AttributeError):
            # Fallback: Run individual predictions in parallel threads
            # On Apple Silicon M4 Pro, use ThreadPoolExecutor (PyTorch/TensorFlow handle threading)
            def predict_all_actions():
                def predict_action(agent):
                    agent_obs = obs[agent]
                    action, _ = model.predict(agent_obs, deterministic=True)
                    return agent, int(action)
                
                # Use ThreadPoolExecutor - model.predict with PyTorch benefits from threading
                # M4 Pro has many cores, so we can use more workers
                max_workers = min(len(env.agents), 20, (os.cpu_count() or 12))
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    results = list(executor.map(predict_action, env.agents))
                return dict(results)
            
            # Run the CPU-bound prediction work in a thread pool to avoid blocking async loop
            loop = asyncio.get_event_loop()
            actions = await loop.run_in_executor(None, predict_all_actions)
            print(f"⏱️  Parallel prediction ({min(len(env.agents), 20, (os.cpu_count() or 12))} workers): {time.time() - reset_time:.3f}s")
        
        # Step through the environment to get the recommendation
        observations, rewards, dones, truncated, infos = env.step(actions)
        
        # Log vote distribution to see what agents chose
        votes = [env.candidate_locations[actions[agent]] for agent in env.agents]
        from collections import Counter
        vote_counts = Counter(votes)
        top_votes = vote_counts.most_common(5)
        print(f"📊 Model Votes: {dict(top_votes)}")
        
        # Debug: Check what actions the model predicted and what cities they map to
        print(f"🔍 Action index → City mapping (first 10 candidates):")
        for i in range(min(10, len(env.candidate_locations))):
            city = env.candidate_locations[i]
            action_count = sum(1 for agent in env.agents if actions[agent] == i)
            if action_count > 0 or city in ["Frankfurt", "Vienna", "Dublin", "Amsterdam", "Brussels"]:
                print(f"   Action {i}: {city} ({action_count} votes)")
        
        # Check where European cities are in the candidate list
        print(f"🔍 European city positions in candidate list:")
        for city in ["Frankfurt", "Vienna", "Dublin", "Amsterdam", "Brussels", "Kuala Lumpur"]:
            if city in env.candidate_locations:
                idx = env.candidate_locations.index(city)
                action_count = sum(1 for agent in env.agents if actions[agent] == idx)
                print(f"   {city}: position {idx} ({action_count} votes)")
        
        # Extract the chosen location
        if not env.agents:
            raise HTTPException(status_code=500, detail="No agents in environment")
        
        first_agent = env.agents[0]
        chosen_city = infos[first_agent].get("chosen_city")
        
        if not chosen_city:
            raise HTTPException(status_code=500, detail="No location chosen by model")
        
        # Calculate what alternative locations would cost for comparison
        # CRITICAL: Check attendee cities even if they're not in candidate_locations!
        # Also check top voted alternatives AND key regional hubs near attendees
        attendee_cities = set(env.agent_home_locations.values())
        
        # Find regional hubs that might be good alternatives (if attendees are clustered)
        key_hubs = []
        european_attendees = [c for c in attendee_cities if c in ["London", "Paris", "Zurich", "Geneva", "Vienna", "Frankfurt", "Dublin", "Amsterdam", "Brussels", "Stockholm", "Copenhagen", "Oslo", "Budapest", "Wroclaw", "Aarhus"]]
        if len(european_attendees) >= 2:
            # If 2+ European attendees, check European hubs
            key_hubs = ["Frankfurt", "Vienna", "Amsterdam", "Brussels", "Copenhagen", "Dublin"]
        
        asia_attendees = [c for c in attendee_cities if c in ["Hong Kong", "Singapore", "Tokyo", "Shanghai", "Beijing", "Seoul", "Bangkok", "Kuala Lumpur", "Jakarta", "Manila", "Mumbai", "Delhi", "Sydney", "Melbourne"]]
        if len(asia_attendees) >= 2:
            # If 2+ Asia-Pacific attendees, check regional hubs
            key_hubs.extend(["Hong Kong", "Singapore", "Bangkok", "Kuala Lumpur"])
        
        alternatives_to_check = list(attendee_cities) + key_hubs + [city for city, _ in top_votes if city != chosen_city]
        alternatives_to_check = list(dict.fromkeys(alternatives_to_check))[:12]  # Check up to 12 alternatives
        
        print(f"\n🔍 Deep analysis: Comparing alternatives to chosen location ({chosen_city}):")
        print(f"   Model reward weights: 15% distance, 15% timezone, 20% flight_time, 25% CO₂, 25% price")
        print(f"\n✅ FIXED: Changed to per-feature normalization (preserves relative relationships)")
        print(f"   OLD: obs / obs.max() - normalized all features by global max (lost relationships)")
        print(f"   NEW: Each feature normalized by its own max (distances, CO2, etc. normalized separately)")
        print(f"   Now: Frankfurt CO2=6.7kg → 0.034, KL CO2=195kg → 1.0 (model can see 29x difference!)")
        print(f"   ⚠️  Model was trained on old normalization - may need retraining for optimal performance")
        
        # Show what the model's reward function sees for chosen city
        sample_agent = list(env.agents)[0]
        home_city = env.agent_home_locations[sample_agent]
        chosen_distance = env.distances[sample_agent].get(chosen_city, 0.0)
        chosen_timezone = env.timezone_offsets[sample_agent].get(chosen_city, 0.0)
        chosen_flight_time = env.travel_matrix[sample_agent].get(chosen_city, 0.0)
        chosen_co2 = env.co2_emissions[sample_agent].get(chosen_city, 0.0)
        chosen_price = env.prices[sample_agent].get(chosen_city, 0.0)
        
        chosen_reward_components = (
            0.15 * (chosen_distance / 1000),
            0.15 * chosen_timezone,
            0.20 * chosen_flight_time,
            0.25 * (chosen_co2 / 10),
            0.25 * (chosen_price / 100)
        )
        
        print(f"\n📊 Model reward breakdown for {home_city} → {chosen_city}:")
        print(f"   Distance: {chosen_distance:.0f}km → {chosen_reward_components[0]:.3f} (15% weight)")
        print(f"   Timezone: {chosen_timezone:.1f}h → {chosen_reward_components[1]:.3f} (15% weight)")
        print(f"   Flight time: {chosen_flight_time:.1f}h → {chosen_reward_components[2]:.3f} (20% weight)")
        print(f"   CO₂: {chosen_co2:.1f}kg → {chosen_reward_components[3]:.3f} (25% weight)")
        print(f"   Price: {chosen_price:.0f} → {chosen_reward_components[4]:.3f} (25% weight)")
        print(f"   Total cost per agent: {sum(chosen_reward_components):.3f}")
        
        # Check what European cities ARE in candidates and show their scores
        european_cities_in_candidates = []
        for city in ["Amsterdam", "Frankfurt", "Brussels", "Berlin", "Madrid", "Rome", "Vienna", "Dublin", "Stockholm", "Copenhagen", "Oslo", "Lisbon", "Prague", "Athens"]:
            if city in env.candidate_locations:
                european_cities_in_candidates.append(city)
        
        if european_cities_in_candidates and home_city in ["London", "Paris", "Zurich", "Geneva", "Wroclaw", "Budapest"]:
            print(f"\n🔍 European alternatives in candidates: {european_cities_in_candidates[:5]}")
            print(f"   ⚠️  Model issue: These have MUCH better reward scores but model didn't choose them!")
            for euro_city in european_cities_in_candidates[:3]:
                euro_distance = env.distances[sample_agent].get(euro_city, 0.0)
                euro_timezone = env.timezone_offsets[sample_agent].get(euro_city, 0.0)
                euro_flight_time = env.travel_matrix[sample_agent].get(euro_city, 0.0)
                euro_co2 = env.co2_emissions[sample_agent].get(euro_city, 0.0)
                euro_price = env.prices[sample_agent].get(euro_city, 0.0)
                
                euro_reward = (
                    0.15 * (euro_distance / 1000) +
                    0.15 * euro_timezone +
                    0.20 * euro_flight_time +
                    0.25 * (euro_co2 / 10) +
                    0.25 * (euro_price / 100)
                )
                
                diff = euro_reward - sum(chosen_reward_components)
                print(f"   {euro_city}: CO₂={euro_co2:.1f}kg, Reward={euro_reward:.3f} ({diff:+.3f} vs KL)")
                
                # Check what the model's observation sees (normalized) for this city vs KL
                if euro_city in env.candidate_locations:
                    idx = env.candidate_locations.index(euro_city)
                    kl_idx = env.candidate_locations.index(chosen_city)
                    obs = env.observe(sample_agent)
                    
                    # Each city has 6 features: distance, timezone, flight_time, co2, price, sum
                    euro_features = obs[idx * 6:(idx * 6) + 6]
                    kl_features = obs[kl_idx * 6:(kl_idx * 6) + 6]
                    
                    print(f"      Raw: distance={euro_distance:.0f}km, CO₂={euro_co2:.1f}kg")
                    print(f"      Normalized: [{euro_features[0]:.3f}, {euro_features[1]:.3f}, {euro_features[2]:.3f}, {euro_features[3]:.3f}] (dist,tz,time,co2)")
                    print(f"      KL normalized: [{kl_features[0]:.3f}, {kl_features[1]:.3f}, {kl_features[2]:.3f}, {kl_features[3]:.3f}]")
                    print(f"      ⚠️  Normalization makes them look similar despite 29x CO₂ difference!")
        
        alternative_comparisons = {}
        
        # Calculate chosen city metrics (both raw CO2/time AND model reward cost)
        chosen_total_co2 = sum(env.co2_emissions[agent].get(chosen_city, 0.0) for agent in env.agents)
        chosen_avg_time = np.mean([env.travel_matrix[agent].get(chosen_city, 0.0) for agent in env.agents])
        
        # Calculate model cost for chosen city (same formula as in step())
        chosen_total_model_cost = 0.0
        for agent in env.agents:
            distance = env.distances[agent].get(chosen_city, 0.0)
            timezone = env.timezone_offsets[agent].get(chosen_city, 0.0)
            flight_time = env.travel_matrix[agent].get(chosen_city, 0.0)
            co2 = env.co2_emissions[agent].get(chosen_city, 0.0)
            price = env.prices[agent].get(chosen_city, 0.0)
            chosen_total_model_cost += (
                0.15 * (distance / 1000) +
                0.15 * timezone +
                0.20 * flight_time +
                0.25 * (co2 / 10) +
                0.25 * (price / 100)
            )
        
        best_alternative = None
        best_score = float('inf')
        best_candidate_alternative = None  # Best alternative that's IN candidates
        best_candidate_score = float('inf')
        
        for alt_city in alternatives_to_check:
            if alt_city == chosen_city:
                continue
            
            # Calculate metrics for alternative (even if not in candidate_locations)
            alt_total_co2 = 0.0
            alt_travel_times = []
            alt_distances = []
            alt_timezones = []
            alt_prices = []
            
            for agent in env.agents:
                home_city = env.agent_home_locations[agent]
                
                # Check if it's same city (no travel needed)
                if home_city == alt_city:
                    alt_total_co2 += 0.0
                    alt_travel_times.append(0.0)
                    alt_distances.append(0.0)
                    alt_timezones.append(0.0)
                    alt_prices.append(0.0)
                elif alt_city in env.travel_matrix[agent]:
                    # City is in candidate list, use cached data
                    alt_total_co2 += env.co2_emissions[agent].get(alt_city, 0.0)
                    alt_travel_times.append(env.travel_matrix[agent].get(alt_city, 0.0))
                    alt_distances.append(env.distances[agent].get(alt_city, 0.0))
                    alt_timezones.append(env.timezone_offsets[agent].get(alt_city, 0.0))
                    alt_prices.append(env.prices[agent].get(alt_city, 0.0))
                else:
                    # Not in candidates and not same city - need to calculate using fallback
                    # Use the helper functions to get real data
                    travel_time = env._get_travel_time(home_city, alt_city)
                    co2_emission = env._get_co2_emissions(home_city, alt_city)
                    distance = env._get_distance(home_city, alt_city)
                    timezone = env._get_timezone_offset(home_city, alt_city)
                    price = env._get_price(home_city, alt_city)
                    
                    alt_total_co2 += co2_emission
                    alt_travel_times.append(travel_time)
                    alt_distances.append(distance)
                    alt_timezones.append(timezone)
                    alt_prices.append(price)
            
            if not alt_travel_times:
                continue
                
            alt_avg_time = np.mean(alt_travel_times)
            alt_avg_distance = np.mean(alt_distances)
            alt_avg_timezone = np.mean(alt_timezones)
            alt_avg_price = np.mean(alt_prices)
            
            # Calculate model's cost function (same weights as reward)
            # Note: This is what the model optimizes, but we also check pure CO2
            alt_model_cost = (
                0.15 * (alt_avg_distance / 1000) +
                0.15 * alt_avg_timezone +
                0.20 * alt_avg_time +
                0.25 * (alt_total_co2 / 10) +
                0.25 * (alt_avg_price / 100)
            ) * len(env.agents)  # Total cost across all agents
            
            # Also calculate CO2-only score for comparison
            alt_co2_score = alt_total_co2 + (alt_avg_time * 50)  # CO2 + time penalty
            
            co2_diff = alt_total_co2 - chosen_total_co2
            time_diff = alt_avg_time - chosen_avg_time
            model_cost_diff = alt_model_cost - chosen_total_model_cost
            
            is_better_co2 = co2_diff < 0
            is_better_model = model_cost_diff < 0
            
            # Check if in candidates
            in_candidates = "✅ CANDIDATE" if alt_city in env.candidate_locations else "❌ NOT IN CANDIDATES"
            
            marker = "🏆" if is_better_model else "❌"
            print(f"   {marker} {alt_city} ({in_candidates}):")
            print(f"      CO₂: {alt_total_co2:.2f} kg ({co2_diff:+.2f}) | Time: {alt_avg_time:.2f} hrs ({time_diff:+.2f})")
            print(f"      Model cost: {alt_model_cost:.2f} ({model_cost_diff:+.2f}) | Distance: {alt_avg_distance:.0f}km | Timezone: {alt_avg_timezone:.1f}h")
            
            # Find best by CO2+time (not model cost, since model optimizes weighted combo)
            combined_score = alt_co2_score
            if combined_score < best_score:
                best_score = combined_score
                best_alternative = (alt_city, alt_total_co2, alt_avg_time, alt_model_cost)
            
            # Also track best alternative that's actually in candidates (model can vote for)
            if alt_city in env.candidate_locations and combined_score < best_candidate_score:
                best_candidate_score = combined_score
                best_candidate_alternative = (alt_city, alt_total_co2, alt_avg_time, alt_model_cost)
            
            alternative_comparisons[alt_city] = {
                'co2': alt_total_co2,
                'avg_time': alt_avg_time,
                'model_cost': alt_model_cost,
                'co2_diff': co2_diff,
                'time_diff': time_diff,
                'model_cost_diff': model_cost_diff,
                'in_candidates': alt_city in env.candidate_locations
            }
        
        print(f"\n📊 Chosen location metrics:")
        print(f"   Total CO₂: {chosen_total_co2:.2f} kg")
        print(f"   Avg travel time: {chosen_avg_time:.2f} hrs")
        print(f"   Total model cost: {chosen_total_model_cost:.2f}")
        print(f"\n🔍 Alternatives checked: {len(alternatives_to_check)} cities")
        print(f"   Attendee cities: {list(attendee_cities)}")
        print(f"   Cities being evaluated: {alternatives_to_check[:8]}")
        
        # Validate model choice: if a much better alternative exists (30%+ better CO2), override
        if best_alternative:
            best_city, best_co2, best_time, best_model_cost = best_alternative
            chosen_score = chosen_total_co2 + (chosen_avg_time * 50)
            improvement = ((chosen_score - best_score) / chosen_score) * 100 if chosen_score > 0 else 0
            
            print(f"\n🏆 Best alternative by CO₂: {best_city} ({best_co2:.2f} kg, {best_time:.2f} hrs)")
            print(f"   Model cost difference: {best_model_cost - chosen_total_model_cost:+.2f}")
            
            # Check if best alternative is an attendee city (QRT HQ) not in candidates
            is_in_candidates = best_city in env.candidate_locations
            is_attendee_city = best_city in attendee_cities
            
            # Calculate improvements
            co2_improvement_pct = ((chosen_total_co2 - best_co2) / chosen_total_co2 * 100) if chosen_total_co2 > 0 else 0
            is_significantly_better = (
                (co2_improvement_pct > 20) or  # At least 20% CO2 reduction
                (is_attendee_city and co2_improvement_pct > 5)  # Or attendee city with 5%+ reduction
            ) and best_co2 < chosen_total_co2 and chosen_total_co2 > 0
            
            # Priority: Choose the BEST option overall (attendee city OR candidate city, whichever is better)
            # Compare best_alternative (could be attendee city) vs best_candidate_alternative
            if best_alternative and best_candidate_alternative:
                # Both exist - choose the better one
                best_alt_score = best_co2 + (best_time * 50)
                cand_city, cand_co2, cand_time, cand_cost = best_candidate_alternative
                cand_score = cand_co2 + (cand_time * 50)
                
                if best_alt_score < cand_score and is_significantly_better:
                    # Best alternative (usually attendee city) is better
                    if is_attendee_city and not is_in_candidates:
                        print(f"\n⚠️  SPECIAL OVERRIDE: {best_city} (attendee city) is better than best candidate!")
                        print(f"   Attendee city: {best_city} ({best_co2:.2f} kg) vs Candidate: {cand_city} ({cand_co2:.2f} kg)")
                        print(f"   Overriding to attendee city: {best_city}")
                        chosen_city = best_city
                        chosen_total_co2 = best_co2
                        chosen_avg_time = best_time
                    else:
                        # Best alternative is in candidates and better
                        cand_improvement = ((chosen_total_co2 - cand_co2) / chosen_total_co2 * 100) if chosen_total_co2 > 0 else 0
                        is_regional_hub = cand_city in ["Frankfurt", "Vienna", "Amsterdam", "Brussels", "Copenhagen", "Dublin", "Hong Kong", "Singapore", "Bangkok", "Kuala Lumpur"]
                        threshold = 10 if is_regional_hub else 15
                        if cand_improvement > threshold:
                            print(f"\n⚠️  OVERRIDE: Better candidate city found!")
                            print(f"   Model chose: {chosen_city} ({chosen_total_co2:.2f} kg)")
                            print(f"   Better option: {cand_city} ({cand_co2:.2f} kg) - {cand_improvement:.1f}% less CO₂")
                            chosen_city = cand_city
                            chosen_total_co2 = cand_co2
                            chosen_avg_time = cand_time
                elif cand_score < best_alt_score:
                    # Candidate is better than attendee city
                    cand_improvement = ((chosen_total_co2 - cand_co2) / chosen_total_co2 * 100) if chosen_total_co2 > 0 else 0
                    is_regional_hub = cand_city in ["Frankfurt", "Vienna", "Amsterdam", "Brussels", "Copenhagen", "Dublin", "Hong Kong", "Singapore", "Bangkok", "Kuala Lumpur"]
                    threshold = 10 if is_regional_hub else 15
                    if cand_improvement > threshold:
                        print(f"\n⚠️  OVERRIDE: Better candidate city found!")
                        print(f"   Model chose: {chosen_city} ({chosen_total_co2:.2f} kg)")
                        print(f"   Better option: {cand_city} ({cand_co2:.2f} kg) - {cand_improvement:.1f}% less CO₂")
                        chosen_city = cand_city
                        chosen_total_co2 = cand_co2
                        chosen_avg_time = cand_time
            elif best_candidate_alternative:
                # Only candidate alternative exists
                cand_city, cand_co2, cand_time, cand_cost = best_candidate_alternative
                cand_improvement = ((chosen_total_co2 - cand_co2) / chosen_total_co2 * 100) if chosen_total_co2 > 0 else 0
                # Lower threshold for regional hubs (10% instead of 15%)
                is_regional_hub = cand_city in ["Frankfurt", "Vienna", "Amsterdam", "Brussels", "Copenhagen", "Dublin", "Hong Kong", "Singapore", "Bangkok", "Kuala Lumpur"]
                threshold = 10 if is_regional_hub else 15
                if cand_improvement > threshold:
                    print(f"\n⚠️  OVERRIDE: Better candidate city found!")
                    print(f"   Model chose: {chosen_city} ({chosen_total_co2:.2f} kg)")
                    print(f"   Better option: {cand_city} ({cand_co2:.2f} kg) - {cand_improvement:.1f}% less CO₂")
                    chosen_city = cand_city
                    chosen_total_co2 = cand_co2
                    chosen_avg_time = cand_time
                else:
                    print(f"\nℹ️  Best candidate: {cand_city} ({cand_co2:.2f} kg) but improvement ({cand_improvement:.1f}%) below threshold ({threshold}%)")
            elif is_attendee_city and not is_in_candidates and is_significantly_better:
                # Only attendee city alternative exists and it's much better
                print(f"\n⚠️  SPECIAL OVERRIDE: {best_city} is an attendee city (QRT HQ) with {co2_improvement_pct:.1f}% less CO₂!")
                print(f"   Model couldn't choose it (not in candidate_locations), but it's clearly optimal")
                print(f"   Overriding to attendee city: {best_city}")
                chosen_city = best_city
                chosen_total_co2 = best_co2
                chosen_avg_time = best_time
            else:
                print(f"\nℹ️  Best alternative: {best_city} ({best_co2:.2f} kg, {co2_improvement_pct:.1f}% better)")
                if best_candidate_alternative:
                    cand_city, cand_co2, _, _ = best_candidate_alternative
                    cand_improvement = ((chosen_total_co2 - cand_co2) / chosen_total_co2 * 100) if chosen_total_co2 > 0 else 0
                    if not is_in_candidates:
                        print(f"   Not in candidates, but better candidate: {cand_city} ({cand_co2:.2f} kg, {cand_improvement:.1f}% better)")
                        if cand_improvement < 15:
                            print(f"   Candidate improvement ({cand_improvement:.1f}%) below threshold (15%)")
                    else:
                        print(f"   Improvement ({co2_improvement_pct:.1f}%) below threshold (20% for non-attendee cities)")
                elif not is_in_candidates:
                    print(f"   Not in candidate_locations - model can't vote for it")
                if not is_significantly_better:
                    print(f"   Improvement below threshold (20% required for non-attendee cities)")
        
        # Get coordinates for the chosen city using fast coordinate cache
        chosen_city_iata = env.city_to_iata.get(chosen_city)
        event_latitude = 0.0
        event_longitude = 0.0
        
        if chosen_city_iata:
            # Fast O(1) lookup from coordinate cache
            coordinates = travel_data.get('iata_to_coordinates', {}).get(chosen_city_iata)
            if coordinates:
                event_latitude = coordinates['latitude']
                event_longitude = coordinates['longitude']
            else:
                # Fallback: try DataFrame lookup if cache didn't have coordinates
                city_data = travel_data['training_df'][travel_data['training_df']['arrival_location'] == chosen_city_iata]
                if not city_data.empty:
                    event_latitude = float(city_data.iloc[0]['arrival_latitude'])
                    event_longitude = float(city_data.iloc[0]['arrival_longitude'])
        
        # Calculate travel metrics for each attendee home location
        # Use corrected city if validation override was applied
        attendee_travel_hours = {}
        all_travel_times = []
        total_co2 = 0.0
        
        for agent in env.agents:
            home_city = env.agent_home_locations[agent]
            
            # Get travel time in hours (using potentially corrected chosen_city)
            # Handle attendee cities that might not be in travel_matrix
            if home_city == chosen_city:
                # Same city - no travel needed
                travel_time = 0.0
                co2_emission = 0.0
            elif chosen_city in env.travel_matrix[agent]:
                # City is in candidate list, use cached data
                travel_time = env.travel_matrix[agent].get(chosen_city, 0.0)
                co2_emission = env.co2_emissions[agent].get(chosen_city, 0.0)
            else:
                # Not in candidates - calculate using helper functions
                # This happens when we override to an attendee city not in candidate_locations
                travel_time = env._get_travel_time(home_city, chosen_city)
                co2_emission = env._get_co2_emissions(home_city, chosen_city)
                # Debug: log helper function calls
                if home_city != chosen_city:
                    print(f"   🔧 Calculated {home_city} → {chosen_city}: {travel_time:.2f}h, {co2_emission:.2f}kg CO₂")
            
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
        
        total_time = time.time() - start_time
        
        # Log detailed response information
        print(f"\n{'='*80}")
        print(f"✅ OPTIMIZATION COMPLETE - Total time: {total_time:.3f}s")
        print(f"{'='*80}")
        print(f"📍 Recommended Location: {chosen_city}")
        print(f"   Coordinates: ({event_latitude:.6f}, {event_longitude:.6f})")
        print(f"\n📅 Event Schedule:")
        print(f"   Start: {event_start.isoformat().replace('+00:00', 'Z')}")
        print(f"   End: {event_end.isoformat().replace('+00:00', 'Z')}")
        print(f"   Span: {event_span_start.isoformat().replace('+00:00', 'Z')} to {event_span_end.isoformat().replace('+00:00', 'Z')}")
        print(f"\n📊 Travel Metrics:")
        print(f"   Total CO₂: {total_co2:.2f} kg")
        print(f"   Average Travel: {average_travel_hours:.2f} hours")
        print(f"   Median Travel: {median_travel_hours:.2f} hours")
        print(f"   Min Travel: {min_travel_hours:.2f} hours")
        print(f"   Max Travel: {max_travel_hours:.2f} hours")
        print(f"\n👥 Attendee Travel Times:")
        for city, hours in sorted(attendee_travel_hours.items(), key=lambda x: x[1]):
            print(f"   {city}: {hours:.2f} hours")
        print(f"{'='*80}\n")
        
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