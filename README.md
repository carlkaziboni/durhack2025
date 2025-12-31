# Event Optimizer

An AI-powered platform that optimizes meeting and event locations for global teams, balancing travel time, CO₂ emissions, cost, and fairness across all attendees.

## ✨ Visual Experience

**Immersive 3D Globe Visualization** powered by Cesium.js:

- 🗺️ **Interactive 3D Globe**: Navigate and explore the world with a beautiful, interactive 3D globe showing all meeting locations and travel routes
- ✈️ **Custom 3D Plane Models**: Animated airplane models fly along curved flight paths, synchronizing arrival times for dramatic visual effect
- 🎨 **Curved Flight Path Arcs**: Realistic curved arcs connecting departure cities to the meeting destination, with color-coded travel times
- 📍 **Smart Markers**:
  - Cyan markers for all departure cities (attendee origins)
  - Gold star marker for the optimized event location
  - Clear visual distinction between origins and destination
- 🌐 **Dynamic Animations**: Planes animate along paths with realistic timing based on actual flight durations
- 📊 **Real-Time Statistics**: Live updates of CO₂ emissions, travel times, and location details as you explore

Experience the full visualization by planning a meeting and watching the globe come alive with flight paths, animated planes, and location markers!

## 📊 Data Pipeline

### Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER INPUT (Frontend)                             │
│  • Attendee locations & counts                                               │
│  • Availability window (start/end dates)                                     │
│  • Event duration                                                            │
└──────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API REQUEST (POST /optimize-event)                   │
│  FastAPI endpoint receives JSON payload                                     │
└──────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA LOADING & CACHING                                │
│  • Load training_data.csv (293,845 flight records)                          │
│  • Build flight_data_cache: origin → dest → {time, CO₂, distance, ...}      │
│  • Build iata_to_coordinates cache                                          │
│  • Load pre-trained PPO model                                                │
│  → All caches built once at startup, reused for all requests                │
└──────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ENVIRONMENT CREATION                                   │
│  • Create TravelEnvironment with scenario                                   │
│  • Build candidate_locations (782 destinations, exact training order)        │
│  • Create agents (one per attendee)                                          │
│  • Build travel matrices (PARALLELIZED):                                     │
│    - For each agent × destination:                                          │
│      * Travel time (hours)                                                   │
│      * CO₂ emissions (kg)                                                     │
│      * Distance (km)                                                          │
│      * Timezone offset (hours)                                               │
│      * Price (USD)                                                           │
│  → Parallelized across agents using ThreadPoolExecutor                      │
└──────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OBSERVATION GENERATION                                 │
│  • For each agent, build observation vector:                                │
│    - For each of 782 candidates:                                             │
│      * 6 normalized features: distance, timezone, flight_time, CO₂,          │
│        price, combined                                                       │
│    - 3 temporal features: start_day, end_day, event_duration                │
│  → Total: 782×6 + 3 = 4,695 features per agent                              │
│  → Normalized per-feature (preserves relative relationships)                │
└──────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MODEL PREDICTION                                      │
│  • Batch prediction: All agent observations → single model forward pass     │
│    (or parallel predictions if batch fails)                                  │
│  • Model outputs action indices (0-781) → candidate city names                │
│  • Majority voting: Most voted city wins                                     │
└──────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MODEL VALIDATION & OVERRIDE                            │
│  • Compare model's choice against alternatives:                               │
│    - Attendee cities (even if not in candidates)                             │
│    - Regional hubs (Frankfurt, Vienna, etc. for Europe)                      │
│    - Top-voted alternatives                                                  │
│  • Calculate metrics for each:                                               │
│    - Total CO₂ across all attendees                                          │
│    - Average/median travel time                                              │
│    - Combined score (CO₂ + time penalty)                                     │
│  • Override if better option found:                                          │
│    - 10%+ better for regional hubs                                           │
│    - 15%+ better for other candidates                                        │
│    - 5%+ better for attendee cities                                          │
└──────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RESULT PROCESSING                                       │
│  • Calculate final metrics:                                                  │
│    - Total CO₂ emissions                                                     │
│    - Mean, median, min, max travel times                                      │
│    - Per-city travel hours                                                   │
│  • Get coordinates for chosen city (from cache)                               │
│  • Calculate event dates (considering travel time + buffer)                  │
│  • Format response JSON                                                      │
└──────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      API RESPONSE                                            │
│  JSON with:                                                                   │
│  • event_location, coordinates                                               │
│  • event_dates, event_span                                                   │
│  • total_co2, travel statistics                                               │
│  • attendee_travel_hours                                                     │
└──────────────────────────────┬──────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND VISUALIZATION                                    │
│  • 3D Cesium Globe:                                                          │
│    - Cyan markers: Departure cities (all attendees)                         │
│    - Gold marker: Event location (star)                                      │
│    - Curved flight paths with color-coded travel times                       │
│    - Animated planes along paths                                             │
│  • Statistics Panel:                                                          │
│    - CO₂ emissions, mean/median travel times                                   │
│    - Per-city breakdown                                                      │
│  • Expanded View:                                                             │
│    - Detailed statistics, weather, calendar export                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Data Transformations

1. **Input** → Raw attendee data + time constraints
2. **Caching** → Flight data pre-loaded into nested dictionaries (O(1) lookups)
3. **Matrix Building** → Parallel computation across agents (782 destinations × N agents)
4. **Normalization** → Per-feature scaling preserves CO₂/distance relationships
5. **Model Inference** → Multi-agent voting selects candidate location
6. **Validation** → Override logic ensures optimal choice (may correct model)
7. **Response** → Aggregated statistics + coordinates + scheduling
8. **Visualization** → 3D globe with markers, paths, and animations

### Performance Checkpoints

- **Data Loading**: ~0s (pre-cached at startup)
- **Environment Creation**: ~0.3s (parallelized matrix building)
- **Model Prediction**: ~0.001s (batch processing)
- **Validation**: ~0.01s (dictionary lookups)
- **Total Response Time**: <1s for typical scenarios

## 🌟 Features

- **AI-Powered Optimization**: Uses reinforcement learning (PPO) to find optimal meeting locations
- **Multi-Factor Analysis**: Considers travel time, CO₂ emissions, distance, timezone differences, and cost
- **3D Globe Visualization**: Interactive Cesium.js globe showing flight paths and attendee locations
- **Sustainability Focus**: Prioritizes low CO₂ emissions while maintaining fairness
- **Global Coverage**: Supports 782+ destinations worldwide
- **Real-Time Calculations**: Sub-second response times for optimization requests
- **Weather Integration**: Displays weather forecasts for chosen locations
- **Export Functionality**: Generate calendar files (.ics) and email summaries

## 🏗️ Architecture

### Backend

- **FastAPI** REST API
- **Stable-Baselines3** PPO reinforcement learning model
- **PettingZoo** multi-agent environment
- **Parallel Processing** with ThreadPoolExecutor for optimal performance
- **Caching Layer** for O(1) data lookups (293,845 flight routes)

### Frontend

- **React** with modern hooks
- **Cesium.js** 3D globe visualization
- **Tailwind CSS** for styling
- **Vite** for fast development and building

## 🚀 Quick Start

### Prerequisites

- Python 3.9+ (Python 3.13 recommended)
- Node.js 18+
- npm or yarn

### Backend Setup

1. **Navigate to backend directory:**

   ```bash
   cd backend
   ```

2. **Create virtual environment:**

   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Ensure data files are present:**

   - `training_data.csv` - Flight route data (293,845 records)
   - `codes.csv` - Airport IATA codes
   - `trained_ppo_travel_model_expanded.zip` - Pre-trained RL model

5. **Start the server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory:**

   ```bash
   cd frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173` (or the port Vite assigns)

## 📖 Usage

### API Endpoint

**POST** `/optimize-event`

**Request Body:**

```json
{
  "attendees": {
    "London": 2,
    "Paris": 3,
    "Tokyo": 1
  },
  "availability_window": {
    "start": "2025-10-06T09:00:00Z",
    "end": "2025-10-07T17:00:00Z"
  },
  "event_duration": {
    "days": 0,
    "hours": 2
  }
}
```

**Response:**

```json
{
  "event_location": "Paris",
  "event_location_coordinates": {
    "latitude": 49.0097,
    "longitude": 2.54778
  },
  "event_dates": {
    "start": "2025-10-06T11:00:00Z",
    "end": "2025-10-06T13:00:00Z"
  },
  "event_span": {
    "start": "2025-10-06T09:00:00Z",
    "end": "2025-10-06T15:00:00Z"
  },
  "total_co2": 4.65,
  "average_travel_hours": 1.03,
  "median_travel_hours": 0.82,
  "max_travel_hours": 2.06,
  "min_travel_hours": 0.0,
  "attendee_travel_hours": {
    "London": 2.06,
    "Paris": 0.0
  }
}
```

### Frontend Interface

1. Enter attendee locations and counts
2. Specify availability window (start/end dates)
3. Set event duration
4. Click "Plan Meeting"
5. View optimized location on 3D globe
6. Explore detailed statistics in expanded view

## 🧠 How It Works

### Optimization Algorithm

The system uses **Proximal Policy Optimization (PPO)** reinforcement learning to:

1. **Evaluate Candidates**: Consider 782+ global destinations
2. **Calculate Metrics**: For each location, compute:
   - Total CO₂ emissions across all attendees
   - Average and median travel time
   - Timezone convenience
   - Distance and cost
3. **Apply Model Override**: If model suggests suboptimal choice, intelligent override selects better alternative
4. **Balance Trade-offs**: Weighted optimization considering:
   - 25% CO₂ emissions (sustainability)
   - 20% Flight time (convenience)
   - 25% Price (cost)
   - 15% Distance
   - 15% Timezone differences

### Model Training

The RL model was trained on:

- **300,000 timesteps** of reinforcement learning
- **Per-feature normalization** to preserve relative relationships
- **Multi-agent environment** where each attendee votes on location
- **Reward function** balancing CO₂, time, distance, and fairness

## 📊 Performance

The system has been optimized for speed:

- **Environment Creation**: ~0.3 seconds (down from 127s)
- **Model Prediction**: ~0.001 seconds
- **Total Request Time**: <1 second for typical scenarios
- **Concurrent Requests**: Supports 10-50 simultaneous requests

See [PERFORMANCE_OPTIMIZATIONS.md](PERFORMANCE_OPTIMIZATIONS.md) for detailed optimization analysis.

## 🔧 Configuration

### Supported Cities

**QRT Headquarters (Attendee Locations):**

- London, Paris, Hong Kong, Singapore, Mumbai, Dubai, Shanghai, Zurich, Geneva, Aarhus, Sydney, Wroclaw, Budapest

**Candidate Destinations:**

- 782+ cities worldwide sorted by connectivity
- All destinations reachable from QRT headquarters

### Model Parameters

- **Learning Rate**: 0.0003
- **Batch Size**: 64
- **Gamma**: 0.99
- **GAE Lambda**: 0.95
- **Clip Range**: 0.2

## 📁 Project Structure

```
durhack2025/
├── backend/
│   ├── main.py                          # FastAPI application
│   ├── travel_environment/              # RL environment
│   │   └── env/
│   │       └── travel_environment.py   # PettingZoo environment
│   ├── retrain_model.py                 # Model retraining script
│   ├── test_model.py                    # Comprehensive test suite
│   ├── training_data.csv                 # Flight route data
│   ├── codes.csv                        # Airport codes
│   └── trained_ppo_travel_model_expanded.zip  # Pre-trained model
├── frontend/
│   ├── src/
│   │   ├── App.jsx                      # Main React component
│   │   ├── ExpandedView.jsx              # Detailed view modal
│   │   └── utils/                        # Utility functions
│   └── seen_files/                       # Test input files
├── reinforcementlearning/                # Original training code
└── README.md
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
cd backend
python test_model.py
```

Tests cover:

- Europe-only scenarios
- Asia-Pacific scenarios
- Global mixed scenarios
- Single city (zero travel)
- Small/large groups
- Short/long time windows

## 🔄 Retraining the Model

To retrain the model with updated normalization or hyperparameters:

```bash
cd backend
python retrain_model.py
```

See [backend/RETRAIN_INSTRUCTIONS.md](backend/RETRAIN_INSTRUCTIONS.md) for detailed instructions.

## 🛠️ Technology Stack

### Backend

- **FastAPI** - Modern Python web framework
- **Stable-Baselines3** - Reinforcement learning library
- **PettingZoo** - Multi-agent RL environments
- **Pandas/NumPy** - Data processing
- **Uvicorn** - ASGI server

### Frontend

- **React** - UI framework
- **Cesium.js** - 3D globe and visualization
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Luxon** - Date/time handling

### AI/ML

- **PPO (Proximal Policy Optimization)** - RL algorithm
- **Gymnasium** - RL environment interface
- **Supersuit** - Environment wrappers

## 🌍 Supported Features

- ✅ 782+ global destinations
- ✅ Real-time CO₂ calculations
- ✅ Timezone-aware scheduling
- ✅ Weather forecasts
- ✅ Calendar export (.ics)
- ✅ Email summary generation
- ✅ 3D flight path visualization
- ✅ Animated plane models
- ✅ Per-attendee travel statistics

## 📝 API Documentation

Interactive API documentation available at:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🚨 Troubleshooting

### Model Not Loading

- Ensure `trained_ppo_travel_model_expanded.zip` exists in `backend/` directory
- Check Python version (3.9+ required)

### Slow Performance

- Verify data files (`training_data.csv`, `codes.csv`) are present
- Check that caching is working (should see cache size in startup logs)
- Ensure sufficient CPU cores for parallel processing

### Frontend Not Connecting

- Verify backend is running on port 8000
- Check CORS settings if accessing from different origin
- Review browser console for errors

## 📄 License

This project was developed for QRT.

## 👥 Contributing

For internal team members, see:

- Performance optimization details: [PERFORMANCE_OPTIMIZATIONS.md](PERFORMANCE_OPTIMIZATIONS.md)
- Model retraining: [backend/RETRAIN_INSTRUCTIONS.md](backend/RETRAIN_INSTRUCTIONS.md)
- Test scenarios: `frontend/seen_files/input_*.json`

## 🎯 Future Enhancements

Potential improvements:

- Multi-day event optimization
- Hotel/venue cost integration
- Real-time flight pricing API integration
- Machine learning model versioning
- User preference learning
- Regional preferences and restrictions
