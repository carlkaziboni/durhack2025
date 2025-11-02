from pettingzoo import ParallelEnv
from gymnasium import spaces
import numpy as np
from datetime import datetime, timedelta

import pandas as pd
import os

class TravelEnvironment(ParallelEnv):
    render_mode = "human"

    metadata = {
        "name": "travel_environment_v0",
    }

    def __init__(self, scenario):
        super().__init__()
        self.scenario = scenario

        # Load data from CSV files FIRST (needed for building candidate locations)
        self._load_data_initial()
        
        # Extract temporal information from availability window
        self.availability_start = datetime.fromisoformat(scenario["availability_window"]["start"].replace('Z', '+00:00'))
        self.availability_end = datetime.fromisoformat(scenario["availability_window"]["end"].replace('Z', '+00:00'))
        
        # Get day of week (0=Monday, 6=Sunday)
        self.start_day_of_week = self.availability_start.weekday()
        self.end_day_of_week = self.availability_end.weekday()
        
        # Extract event duration
        self.event_duration_days = scenario["event_duration"]["days"]
        self.event_duration_hours = scenario["event_duration"]["hours"]
        self.total_event_hours = self.event_duration_days * 24 + self.event_duration_hours
        
        # Calculate total availability window in days
        self.availability_window_days = (self.availability_end - self.availability_start).days
        
        # Build candidate locations dynamically from actual flight data
        # Get all unique destinations that are reachable from QRT headquarters
        qrt_hq_iata_codes = ["LHR", "CDG", "HKG", "SIN", "BOM", "DXB", 
                             "PVG", "ZRH", "GVA", "AAR", "SYD", "WRO", "BUD"]
        
        # Find all destinations from QRT headquarters in the training data
        destinations_from_qrt = self.training_df[
            self.training_df['departure_location'].isin(qrt_hq_iata_codes)
        ]['arrival_location'].unique()
        
        # Exclude QRT headquarters themselves from candidate destinations
        candidate_iata = [iata for iata in destinations_from_qrt if iata not in qrt_hq_iata_codes]
        
        # Map IATA codes to city names
        iata_to_city = {}
        for iata in candidate_iata:
            city_info = self.codes_df[self.codes_df['iata'] == iata]
            if not city_info.empty:
                # Use airport name or region as city name
                airport_name = city_info.iloc[0]['airport']
                # Extract city name from airport name (remove common airport terms)
                city_name = airport_name
                for term in [' Airport', ' International', ' Intl', ' Regional', ' Municipal', 
                            ' Field', ' AFB', ' Air Base', ' Arpt']:
                    city_name = city_name.replace(term, '')
                city_name = city_name.split(',')[0].strip()
                
                # Skip very short or generic names
                if city_name and len(city_name) > 2 and city_name.lower() not in ['the', 'all', 'new']:
                    iata_to_city[iata] = city_name
        
        # Create candidate locations list (ALL city names that exist in training data - no limit)
        # Sort by frequency of routes to prioritize better-connected destinations
        destination_counts = self.training_df[
            self.training_df['departure_location'].isin(qrt_hq_iata_codes)
        ]['arrival_location'].value_counts()
        
        # Order destinations by connectivity (most routes first)
        sorted_iata = [iata for iata in destination_counts.index if iata in iata_to_city]
        self.candidate_locations = [iata_to_city[iata] for iata in sorted_iata]
        
        print(f"✈️  Loaded {len(self.candidate_locations)} candidate destinations from training data")
        
        # Update city_to_iata mapping to include both QRT HQs and candidate destinations
        self.city_to_iata.update({city: iata for iata, city in iata_to_city.items() if city in self.candidate_locations})
        
        # Create agents list based on attendees from scenario
        # Each city gets multiple agents based on attendee count
        self.agents = []
        self.agent_home_locations = {}
        
        for city, count in scenario["attendees"].items():
            for i in range(count):
                agent_name = f"{city}_{i}"
                self.agents.append(agent_name)
                self.agent_home_locations[agent_name] = city
        
        self.possible_agents = self.agents[:]
        self.agent_name_mapping = {agent: i for i, agent in enumerate(self.agents)}
        
        # Initialize data structures for each agent
        self.travel_matrix = {}
        self.co2_emissions = {}
        self.timezone_offsets = {}
        self.distances = {}
        self.prices = {}
        
        for agent in self.agents:
            home_city = self.agent_home_locations[agent]
            self.travel_matrix[agent] = {}
            self.co2_emissions[agent] = {}
            self.timezone_offsets[agent] = {}
            self.distances[agent] = {}
            self.prices[agent] = {}
            
            for destination in self.candidate_locations:
                self.travel_matrix[agent][destination] = self._get_travel_time(home_city, destination)
                self.co2_emissions[agent][destination] = self._get_co2_emissions(home_city, destination)
                self.timezone_offsets[agent][destination] = self._get_timezone_offset(home_city, destination)
                self.distances[agent][destination] = self._get_distance(home_city, destination)
                self.prices[agent][destination] = self._get_price(home_city, destination)
        
        # Reference for backward compatibility
        self.travel_time = self.travel_matrix

        self.action_spaces = {agent: spaces.Discrete(len(self.candidate_locations)) for agent in self.agents}
        # Observation space: 6 features per candidate location + 3 temporal features
        # (distance, timezone, flight_time, co2, price, combined) * num_locations + (start_day, end_day, event_duration)
        obs_size = len(self.candidate_locations) * 6 + 3
        self.observation_spaces = {agent: spaces.Box(low=0, high=1, shape=(obs_size,), dtype=np.float32) for agent in self.agents}

        self.reset()

    def _load_data_initial(self):
        """Load data from CSV files and build candidate locations from actual flight data."""
        # Construct paths relative to this file's location
        base_dir = os.path.dirname(os.path.abspath(__file__))
        reinforcementlearning_dir = os.path.abspath(os.path.join(base_dir, '..', '..'))
        
        training_data_path = os.path.join(reinforcementlearning_dir, 'training_data.csv')
        codes_data_path = os.path.join(reinforcementlearning_dir, 'codes.csv')

        self.training_df = pd.read_csv(training_data_path)
        self.codes_df = pd.read_csv(codes_data_path)

        # Create a mapping from city names to IATA codes.
        # QRT Headquarters (13 locations - these are attendee START locations)
        # Plus destination cities worldwide for potential meeting locations
        self.city_to_iata = {
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

    def _get_flight_data(self, origin_city, dest_city, column):
        """Get a specific data point for a flight from training_data.csv."""
        origin_iata = self.city_to_iata.get(origin_city)
        dest_iata = self.city_to_iata.get(dest_city)

        if not origin_iata or not dest_iata:
            # No IATA mapping - return penalty values
            penalties = {
                'avg_time': 1440.0,  # 24 hours in minutes (penalty)
                'avg_co2_emissions': 500.0,  # Very high CO2 (penalty)
                'timezone_offset_diff': 12.0,  # Maximum timezone diff
                'avg_distance': 15000.0  # Very long distance (penalty)
            }
            return penalties.get(column, 1000.0)

        flight = self.training_df[
            (self.training_df['departure_location'] == origin_iata) &
            (self.training_df['arrival_location'] == dest_iata)
        ]

        if not flight.empty:
            value = flight[column].iloc[0]
            # Ensure we don't return NaN or inf
            if pd.isna(value) or np.isinf(value):
                # Return penalty values for invalid data
                penalties = {
                    'avg_time': 1440.0,
                    'avg_co2_emissions': 500.0,
                    'timezone_offset_diff': 12.0,
                    'avg_distance': 15000.0
                }
                return penalties.get(column, 1000.0)
            return value
        
        # No direct flight found - return high penalty values to discourage this route
        penalties = {
            'avg_time': 1440.0,  # 24 hours in minutes
            'avg_co2_emissions': 500.0,  # Very high CO2
            'timezone_offset_diff': 12.0,  # Maximum timezone diff
            'avg_distance': 15000.0  # Very long distance
        }
        return penalties.get(column, 1000.0)

    def _get_travel_time(self, origin, destination):
        """Get travel time between two locations (in hours)"""
        if origin == destination:
            return 0.0
        # avg_time is in minutes in the csv, converting to hours
        return self._get_flight_data(origin, destination, 'avg_time') / 60.0
    
    def _get_co2_emissions(self, origin, destination):
        """Get CO2 emissions between two locations (in kg CO2)"""
        if origin == destination:
            return 0.0
        return self._get_flight_data(origin, destination, 'avg_co2_emissions')
    
    def _get_timezone_offset(self, origin, destination):
        """Get timezone offset between two locations (in hours)"""
        if origin == destination:
            return 0.0
        return self._get_flight_data(origin, destination, 'timezone_offset_diff')
    
    def _get_distance(self, origin, destination):
        """Get distance between two locations (in km)"""
        if origin == destination:
            return 0.0
        return self._get_flight_data(origin, destination, 'avg_distance')
    
    def _get_price(self, origin, destination):
        """Get flight price between two locations (in USD)"""
        # 'price' is not in training_data.csv, returning 0.0 as a placeholder
        if origin == destination:
            return 0.0
        return 0.0

    def reset(self, seed=None, options=None):
        if seed is not None:
            np.random.seed(seed)
            
        self.agents = self.possible_agents[:]
        self.agent_selection = self.agents[0]
        self._cumulative_rewards = {agent: 0 for agent in self.agents}
        self.rewards = {agent: 0 for agent in self.agents}
        self.dones = {agent: False for agent in self.agents}
        self.infos = {agent: {} for agent in self.agents}
        self.actions = {agent: None for agent in self.agents}
        
        # Return observations for all agents (required for ParallelEnv)
        observations = {agent: self.observe(agent) for agent in self.agents}
        infos = {agent: {} for agent in self.agents}
        return observations, infos

    def observe(self, agent):
        # Create observation vector with all 6 features for each candidate location
        obs_features = []
        
        for city in self.candidate_locations:
            distance = self.distances[agent][city]
            timezone = self.timezone_offsets[agent][city]
            flight_time = self.travel_matrix[agent][city]
            co2 = self.co2_emissions[agent][city]
            price = self.prices[agent][city]
            
            # Append all features for this city
            obs_features.extend([distance, timezone, flight_time, co2, price, 
                               distance + timezone + flight_time + co2 + price])
        
        # Add temporal features (normalized)
        obs_features.extend([
            self.start_day_of_week / 6.0,           # Day of week (0-6) normalized
            self.end_day_of_week / 6.0,             # Day of week (0-6) normalized
            self.total_event_hours / 24.0           # Event duration normalized to days
        ])
        
        obs = np.array(obs_features, dtype=np.float32)
        
        # Normalize observations to [0, 1] range with safe handling
        obs_max = obs.max()
        if obs_max > 0 and not np.isnan(obs_max) and not np.isinf(obs_max):
            obs = obs / obs_max
        else:
            # If all zeros or invalid, return normalized array
            obs = np.zeros_like(obs)
        
        # Final safety check for NaN or inf
        obs = np.nan_to_num(obs, nan=0.0, posinf=1.0, neginf=0.0)
        
        return obs
    
    def step(self, actions):
        """
        ParallelEnv requires all agents to act simultaneously
        actions: dict mapping agent -> action
        """
        # Store all actions
        self.actions = actions
        
        # Mark all agents as done
        self.dones = {agent: True for agent in self.agents}
        self.dones["__all__"] = True
        
        # Calculate votes and determine chosen city
        votes = [self.candidate_locations[actions[agent]] for agent in self.agents]
        chosen_city = max(set(votes), key=votes.count)
        
        # Calculate base costs for each agent using all 6 factors
        agent_costs = {}
        for agent in self.agents:
            distance = self.distances[agent][chosen_city]
            timezone = self.timezone_offsets[agent][chosen_city]
            flight_time = self.travel_matrix[agent][chosen_city]
            co2 = self.co2_emissions[agent][chosen_city]
            price = self.prices[agent][chosen_city]
            
            # Weighted combination of all factors (normalize to similar scales)
            # Distance in 1000s km, timezone in hours, time in hours, co2 in kg, price in 100s USD
            agent_costs[agent] = (
                0.15 * (distance / 1000) +      # Distance contribution
                0.15 * timezone +                # Timezone contribution
                0.20 * flight_time +             # Flight time contribution
                0.25 * (co2 / 10) +              # CO2 contribution (scaled down)
                0.25 * (price / 100)             # Price contribution (scaled down)
            )
            
            # Add temporal penalty: flight should arrive at least 1 day before event
            # This encourages selecting locations where agents can arrive comfortably before the event
            required_buffer_hours = 24  # 1 day buffer after event duration
            total_required_time = flight_time + self.total_event_hours + required_buffer_hours
            
            # If total time exceeds availability window, add penalty
            if total_required_time > (self.availability_window_days * 24):
                time_overflow_penalty = (total_required_time - (self.availability_window_days * 24)) / 24
                agent_costs[agent] += 0.5 * time_overflow_penalty  # Penalty for time constraint violation
        
        # Calculate variation penalty (standard deviation of costs)
        costs_array = np.array(list(agent_costs.values()))
        cost_std = np.std(costs_array)
        variation_penalty = 0.3 * cost_std  # Weight for fairness penalty
        
        # Calculate rewards for each agent (negative cost + shared variation penalty)
        self.rewards = {}
        for agent in self.agents:
            # Each agent gets their own cost plus a shared penalty for unfairness
            self.rewards[agent] = -(agent_costs[agent] + variation_penalty)
        
        # Get observations (though episode is done)
        observations = {agent: self.observe(agent) for agent in self.agents}
        
        # Prepare infos with additional temporal information
        self.infos = {
            agent: {
                "chosen_city": chosen_city,
                "start_day": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][self.start_day_of_week],
                "end_day": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][self.end_day_of_week],
                "event_duration_hours": self.total_event_hours,
                "availability_window_days": self.availability_window_days
            } 
            for agent in self.agents
        }
        
        # Prepare truncated dict (required for Gymnasium API)
        truncated = {agent: False for agent in self.agents}
        truncated["__all__"] = False
        
        return observations, self.rewards, self.dones, truncated, self.infos

    def _next_agent(self):
        """Helper to cycle through agents"""
        current_idx = self.agents.index(self.agent_selection)
        next_idx = (current_idx + 1) % len(self.agents)
        return self.agents[next_idx]

    def render(self):
        if all(action is not None for action in self.actions.values()):
            print("Votes:", {agent: self.candidate_locations[self.actions[agent]] 
                            for agent in self.agents if agent in self.actions})
            
            # Show vote summary by city
            votes = [self.candidate_locations[self.actions[agent]] for agent in self.agents]
            vote_counts = {city: votes.count(city) for city in self.candidate_locations}
            print("Vote counts:", vote_counts)
            print("Chosen city:", self.infos[self.agents[0]].get("chosen_city"))

    def observation_space(self, agent):
        return self.observation_spaces[agent]

    def action_space(self, agent):
        return self.action_spaces[agent]