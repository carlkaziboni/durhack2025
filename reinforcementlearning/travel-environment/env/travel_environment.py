from pettingzoo import ParallelEnv
from gymnasium import spaces
import numpy as np

class TravelEnvironment(ParallelEnv):

    metadata = {
        "name": "travel_environment_v0",
    }

    def __init__(self, scenario):
        super().__init__()
        self.scenario = scenario

        # Fixed candidate locations (QRT locations)
        self.candidate_locations = ["London", "Paris", "Berlin", "New York", "Tokyo", "Singapore"]
        
        # Initialize data structures
        self.travel_matrix = {}  # Travel time/distance for each agent to each location
        self.co2_emissions = {}  # CO2 emissions for each agent to each location
        self.travel_time = {}    # Alternative reference to travel_matrix
        self.timezone_offsets = {
            "London": 0,
            "Paris": 1,
            "Berlin": 1,
            "New York": -5,
            "Tokyo": 9,
            "Singapore": 8
        }
        
        # Build matrices for each agent
        for agent, info in scenario["attendees"].items():
            agent_location = info.get("location")
            self.travel_matrix[agent] = {}
            self.co2_emissions[agent] = {}
            
            for city in self.candidate_locations:
                # Set travel time/distance
                self.travel_matrix[agent][city] = self._get_travel_time(agent_location, city)
                # Set CO2 emissions
                self.co2_emissions[agent][city] = self._get_co2_emissions(agent_location, city)
        
        # Make travel_time reference the same data as travel_matrix
        self.travel_time = self.travel_matrix

        self.agents = list(scenario["attendees"].keys())
        self.possible_agents = self.agents[:]
        self.agent_name_mapping = {agent: i for i, agent in enumerate(self.agents)}

        self.action_spaces = {agent: spaces.Discrete(len(self.candidate_locations)) for agent in self.agents}
        self.observation_spaces = {agent: spaces.Box(low=0, high=1, shape=(len(self.candidate_locations),), dtype=np.float32) for agent in self.agents}

        self.reset()

    def _get_travel_time(self, origin, destination):
        """Get travel time between two locations (in hours)"""
        if origin == destination:
            return 0.0
        
        # TODO: Add your fixed travel time data here
        travel_times = {}
        
        return travel_times.get((origin, destination), 0.0)
    
    def _get_co2_emissions(self, origin, destination):
        """Get CO2 emissions between two locations (in kg CO2)"""
        if origin == destination:
            return 0.0
        
        # TODO: Add your fixed CO2 emissions data here
        co2_data = {}
        
        return co2_data.get((origin, destination), 0.0)

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
        # Combine travel time and CO2 into observation
        obs = np.array([
            self.travel_matrix[agent][city] + self.co2_emissions[agent][city] * 0.01
            for city in self.candidate_locations
        ], dtype=np.float32)
        
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
        
        # Calculate rewards for each agent
        self.rewards = {}
        for agent in self.agents:
            time = self.travel_matrix[agent][chosen_city]
            co2 = self.co2_emissions[agent][chosen_city]
            self.rewards[agent] = -(0.5 * co2 + 0.5 * time)
        
        # Get observations (though episode is done)
        observations = {agent: self.observe(agent) for agent in self.agents}
        
        # Prepare infos
        self.infos = {agent: {"chosen_city": chosen_city} for agent in self.agents}
        
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

    def observation_space(self, agent):
        return self.observation_spaces[agent]

    def action_space(self, agent):
        return self.action_spaces[agent]