from pettingzoo import ParallelEnv
from gymnasium import spaces
import numpy as np
from datetime import datetime, timedelta

class TravelEnvironment(ParallelEnv):

    metadata = {
        "name": "travel_environment_v0",
    }

    def __init__(self, scenario):
        super().__init__()
        self.scenario = scenario
        
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

        # Fixed candidate locations (QRT locations)
        self.candidate_locations = [
            "New York",
            "London",
            "Dubai",
            "Singapore"
        ]
        
        # Fixed travel time data (in hours)
        self.travel_time_data = {
            "Mumbai": {"New York": 20.5, "London": 9.2, "Dubai": 3.5, "Singapore": 5.1},
            "Shanghai": {"New York": 14.6, "London": 11.2, "Dubai": 8.5, "Singapore": 5.0},
            "Hong Kong": {"New York": 16.7, "London": 12.3, "Dubai": 9.1, "Singapore": 4.2},
            "Singapore": {"New York": 18.1, "London": 13.5, "Dubai": 7.9, "Singapore": 0.5},
            "Sydney": {"New York": 23.9, "London": 21.2, "Dubai": 17.5, "Singapore": 7.2}
        }
        
        # Fixed CO2 emissions data (in kg CO2)
        self.co2_data = {
            "Mumbai": {"New York": 120, "London": 60, "Dubai": 30, "Singapore": 40},
            "Shanghai": {"New York": 110, "London": 70, "Dubai": 50, "Singapore": 35},
            "Hong Kong": {"New York": 100, "London": 65, "Dubai": 45, "Singapore": 30},
            "Singapore": {"New York": 130, "London": 80, "Dubai": 55, "Singapore": 10},
            "Sydney": {"New York": 140, "London": 90, "Dubai": 60, "Singapore": 25}
        }
        
        # Fixed timezone offsets (in hours) - absolute value
        self.timezone_data = {
            "Mumbai": {"New York": 10.5, "London": 4.5, "Dubai": 1.5, "Singapore": 2.5},
            "Shanghai": {"New York": 13, "London": 7, "Dubai": 4, "Singapore": 0},
            "Hong Kong": {"New York": 13, "London": 7, "Dubai": 4, "Singapore": 0},
            "Singapore": {"New York": 13, "London": 7, "Dubai": 4, "Singapore": 0},
            "Sydney": {"New York": 16, "London": 10, "Dubai": 7, "Singapore": 3}
        }
        
        # Fixed distance data (in km)
        self.distance_data = {
            "Mumbai": {"New York": 12544, "London": 7191, "Dubai": 1927, "Singapore": 4321},
            "Shanghai": {"New York": 11869, "London": 9218, "Dubai": 5950, "Singapore": 4197},
            "Hong Kong": {"New York": 12989, "London": 9648, "Dubai": 5964, "Singapore": 2571},
            "Singapore": {"New York": 15344, "London": 10873, "Dubai": 5828, "Singapore": 0},
            "Sydney": {"New York": 15993, "London": 17015, "Dubai": 11932, "Singapore": 6289}
        }
        
        # Fixed price data (in USD)
        self.price_data = {
            "Mumbai": {"New York": 850, "London": 450, "Dubai": 250, "Singapore": 350},
            "Shanghai": {"New York": 800, "London": 550, "Dubai": 500, "Singapore": 300},
            "Hong Kong": {"New York": 750, "London": 600, "Dubai": 450, "Singapore": 250},
            "Singapore": {"New York": 950, "London": 700, "Dubai": 500, "Singapore": 100},
            "Sydney": {"New York": 1100, "London": 900, "Dubai": 750, "Singapore": 400}
        }
        
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

    def _get_travel_time(self, origin, destination):
        """Get travel time between two locations (in hours)"""
        if origin == destination:
            return 0.0
        
        return self.travel_time_data.get(origin, {}).get(destination, 0.0)
    
    def _get_co2_emissions(self, origin, destination):
        """Get CO2 emissions between two locations (in kg CO2)"""
        if origin == destination:
            return 0.0
        
        return self.co2_data.get(origin, {}).get(destination, 0.0)
    
    def _get_timezone_offset(self, origin, destination):
        """Get timezone offset between two locations (in hours)"""
        if origin == destination:
            return 0.0
        
        return self.timezone_data.get(origin, {}).get(destination, 0.0)
    
    def _get_distance(self, origin, destination):
        """Get distance between two locations (in km)"""
        if origin == destination:
            return 0.0
        
        return self.distance_data.get(origin, {}).get(destination, 0.0)
    
    def _get_price(self, origin, destination):
        """Get flight price between two locations (in USD)"""
        if origin == destination:
            return 0.0
        
        return self.price_data.get(origin, {}).get(destination, 0.0)

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
        
        # Normalize observations to [0, 1] range
        if obs.max() > 0:
            obs = obs / obs.max()
        
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