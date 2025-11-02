from pettingzoo import ParallelEnv
from gymnasium import spaces
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import os

class TravelEnvironment(ParallelEnv):
    render_mode = "human"

    metadata = {
        "name": "travel_environment_v0",
    }

    def __init__(self, scenario, travel_data=None):
        super().__init__()
        self.scenario = scenario


        if travel_data is None:
            self._load_data_initial()
        else:
            self._use_cached_data(travel_data)
        

        self.availability_start = datetime.fromisoformat(scenario["availability_window"]["start"].replace('Z', '+00:00'))
        self.availability_end = datetime.fromisoformat(scenario["availability_window"]["end"].replace('Z', '+00:00'))
        

        self.start_day_of_week = self.availability_start.weekday()
        self.end_day_of_week = self.availability_end.weekday()
        

        self.event_duration_days = scenario["event_duration"]["days"]
        self.event_duration_hours = scenario["event_duration"]["hours"]
        self.total_event_hours = self.event_duration_days * 24 + self.event_duration_hours
        

        self.availability_window_days = (self.availability_end - self.availability_start).days
        


        qrt_hq_iata_codes = ["LHR", "CDG", "HKG", "SIN", "BOM", "DXB", 
                             "PVG", "ZRH", "GVA", "AAR", "SYD", "WRO", "BUD"]
        

        destinations_from_qrt = self.training_df[
            self.training_df['departure_location'].isin(qrt_hq_iata_codes)
        ]['arrival_location'].unique()
        



        all_candidate_iata = list(set(list(destinations_from_qrt) + qrt_hq_iata_codes))
        


        qrt_hq_cities = {
            "LHR": "London",
            "CDG": "Paris", 
            "HKG": "Hong Kong",
            "SIN": "Singapore",
            "BOM": "Mumbai",
            "DXB": "Dubai",
            "PVG": "Shanghai",
            "ZRH": "Zurich",
            "GVA": "Geneva",
            "AAR": "Aarhus",
            "SYD": "Sydney",
            "WRO": "Wroclaw",
            "BUD": "Budapest"
        }
        iata_to_city = qrt_hq_cities.copy()
        

        for iata in all_candidate_iata:
            if iata not in iata_to_city:
                city_info = self.codes_df[self.codes_df['iata'] == iata]
                if not city_info.empty:

                    airport_name = city_info.iloc[0]['airport']

                    city_name = airport_name
                    for term in [' Airport', ' International', ' Intl', ' Regional', ' Municipal', 
                            ' Field', ' AFB', ' Air Base', ' Arpt']:
                        city_name = city_name.replace(term, '')
                    city_name = city_name.split(',')[0].strip()
                    

                    if city_name and len(city_name) > 2 and city_name.lower() not in ['the', 'all', 'new']:
                        iata_to_city[iata] = city_name
        




        


        candidate_iata = [iata for iata in all_candidate_iata if iata not in qrt_hq_iata_codes and iata in iata_to_city]
        

        destination_counts = self.training_df[
            self.training_df['departure_location'].isin(qrt_hq_iata_codes)
        ]['arrival_location'].value_counts()
        

        sorted_iata = [iata for iata in destination_counts.index if iata in candidate_iata]
        

        MAX_CANDIDATES = 782
        sorted_iata_limited = sorted_iata[:MAX_CANDIDATES]
        self.candidate_locations = [iata_to_city[iata] for iata in sorted_iata_limited]
        
        print(f"✈️  Loaded {len(self.candidate_locations)} candidate destinations (EXACT training order: QRT HQs excluded, sorted by connectivity)")
        

        self.city_to_iata.update({city: iata for iata, city in iata_to_city.items() if city in self.candidate_locations})
        


        self.agents = []
        self.agent_home_locations = {}
        
        for city, count in scenario["attendees"].items():
            for i in range(count):
                agent_name = f"{city}_{i}"
                self.agents.append(agent_name)
                self.agent_home_locations[agent_name] = city
        
        self.possible_agents = self.agents[:]
        self.agent_name_mapping = {agent: i for i, agent in enumerate(self.agents)}
        

        self.travel_matrix = {}
        self.co2_emissions = {}
        self.timezone_offsets = {}
        self.distances = {}
        self.prices = {}
        


        def build_agent_matrices(agent):
            home_city = self.agent_home_locations[agent]
            home_iata = self.city_to_iata.get(home_city)
            

            route_cache = {}
            if home_iata and self.flight_data_cache and home_iata in self.flight_data_cache:
                route_cache = self.flight_data_cache[home_iata]
            elif not home_iata:
                print(f"⚠️  Warning: No IATA code for {home_city}, will use fallback (slow)")
            elif not self.flight_data_cache:
                print(f"⚠️  Warning: flight_data_cache not available, will use fallback (slow)")
            elif home_iata not in self.flight_data_cache:
                print(f"⚠️  Warning: {home_iata} not in cache, will use fallback (slow)")
            
            matrix_data = {
                'travel_matrix': {},
                'co2_emissions': {},
                'timezone_offsets': {},
                'distances': {},
                'prices': {}
            }
            



            for destination in self.candidate_locations:
                dest_iata = self.city_to_iata.get(destination)
                

                if home_city == destination:
                    matrix_data['travel_matrix'][destination] = 0.0
                    matrix_data['co2_emissions'][destination] = 0.0
                    matrix_data['timezone_offsets'][destination] = 0.0
                    matrix_data['distances'][destination] = 0.0
                    matrix_data['prices'][destination] = 0.0
                    continue
                

                if home_iata and dest_iata and dest_iata in route_cache:

                    route_data = route_cache[dest_iata]

                    matrix_data['travel_matrix'][destination] = route_data.get('avg_time', self.penalties['avg_time']) / 60.0
                    matrix_data['co2_emissions'][destination] = route_data.get('avg_co2_emissions', self.penalties['avg_co2_emissions'])
                    matrix_data['timezone_offsets'][destination] = route_data.get('timezone_offset_diff', self.penalties['timezone_offset_diff'])
                    matrix_data['distances'][destination] = route_data.get('avg_distance', self.penalties['avg_distance'])
                    matrix_data['prices'][destination] = 0.0
                elif not home_iata or not dest_iata:


                    matrix_data['travel_matrix'][destination] = self._get_travel_time(home_city, destination)
                    matrix_data['co2_emissions'][destination] = self._get_co2_emissions(home_city, destination)
                    matrix_data['timezone_offsets'][destination] = self._get_timezone_offset(home_city, destination)
                    matrix_data['distances'][destination] = self._get_distance(home_city, destination)
                    matrix_data['prices'][destination] = self._get_price(home_city, destination)
                else:


                    matrix_data['travel_matrix'][destination] = self.penalties['avg_time'] / 60.0
                    matrix_data['co2_emissions'][destination] = self.penalties['avg_co2_emissions']
                    matrix_data['timezone_offsets'][destination] = self.penalties['timezone_offset_diff']
                    matrix_data['distances'][destination] = self.penalties['avg_distance']
                    matrix_data['prices'][destination] = 0.0
            
            return agent, matrix_data
        



        max_workers = min(len(self.agents), os.cpu_count() or 4, 20)
        print(f"🚀 Building travel matrices: {len(self.agents)} agents, {len(self.candidate_locations)} destinations, {max_workers} workers")
        if max_workers > 1 and len(self.agents) > 1:

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(build_agent_matrices, agent): agent for agent in self.agents}
                for future in as_completed(futures):
                    agent, matrix_data = future.result()
                    self.travel_matrix[agent] = matrix_data['travel_matrix']
                    self.co2_emissions[agent] = matrix_data['co2_emissions']
                    self.timezone_offsets[agent] = matrix_data['timezone_offsets']
                    self.distances[agent] = matrix_data['distances']
                    self.prices[agent] = matrix_data['prices']
        else:

            print(f"⚠️  Using sequential mode (agents={len(self.agents)}, workers={max_workers})")
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
        

        self.travel_time = self.travel_matrix

        self.action_spaces = {agent: spaces.Discrete(len(self.candidate_locations)) for agent in self.agents}


        obs_size = len(self.candidate_locations) * 6 + 3
        self.observation_spaces = {agent: spaces.Box(low=0, high=1, shape=(obs_size,), dtype=np.float32) for agent in self.agents}

        self.reset()

    def _use_cached_data(self, travel_data):
        self.flight_data_cache = travel_data['flight_data_cache']
        self.training_df = travel_data['training_df']
        self.codes_df = travel_data['codes_df']
        self.city_to_iata = travel_data['city_to_iata']
        self.penalties = travel_data['penalties']
    
    def _load_data_initial(self):

        base_dir = os.path.dirname(os.path.abspath(__file__))
        reinforcementlearning_dir = os.path.abspath(os.path.join(base_dir, '..', '..'))
        
        training_data_path = os.path.join(reinforcementlearning_dir, 'training_data.csv')
        codes_data_path = os.path.join(reinforcementlearning_dir, 'codes.csv')

        self.training_df = pd.read_csv(training_data_path)
        self.codes_df = pd.read_csv(codes_data_path)
        

        self.flight_data_cache = {}
        self.penalties = {
            'avg_time': 1440.0,
            'avg_co2_emissions': 500.0,
            'timezone_offset_diff': 12.0,
            'avg_distance': 15000.0
        }




        self.city_to_iata = {

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
            

            "Abu Dhabi": "AUH",
            "Doha": "DOH",
            "Riyadh": "RUH",
            "Tel Aviv": "TLV",
            "Amman": "AMM",
            "Beirut": "BEY",
            

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
            

            "Sao Paulo": "GRU",
            "Rio de Janeiro": "GIG",
            "Buenos Aires": "EZE",
            "Santiago": "SCL",
            "Lima": "LIM",
            "Bogota": "BOG",
            "Quito": "UIO",
            

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
        origin_iata = self.city_to_iata.get(origin_city)
        dest_iata = self.city_to_iata.get(dest_city)

        if not origin_iata or not dest_iata:

            return self.penalties.get(column, 1000.0)


        if self.flight_data_cache:
            if origin_iata in self.flight_data_cache and dest_iata in self.flight_data_cache[origin_iata]:
                route_data = self.flight_data_cache[origin_iata][dest_iata]
                return route_data.get(column, self.penalties.get(column, 1000.0))
        

        flight = self.training_df[
            (self.training_df['departure_location'] == origin_iata) &
            (self.training_df['arrival_location'] == dest_iata)
        ]

        if not flight.empty:
            value = flight[column].iloc[0]

            if pd.isna(value) or np.isinf(value):
                return self.penalties.get(column, 1000.0)
            return value
        

        return self.penalties.get(column, 1000.0)

    def _get_travel_time(self, origin, destination):
        if origin == destination:
            return 0.0

        return self._get_flight_data(origin, destination, 'avg_time') / 60.0
    
    def _get_co2_emissions(self, origin, destination):
        if origin == destination:
            return 0.0
        return self._get_flight_data(origin, destination, 'avg_co2_emissions')
    
    def _get_timezone_offset(self, origin, destination):
        if origin == destination:
            return 0.0
        return self._get_flight_data(origin, destination, 'timezone_offset_diff')
    
    def _get_distance(self, origin, destination):
        if origin == destination:
            return 0.0
        return self._get_flight_data(origin, destination, 'avg_distance')
    
    def _get_price(self, origin, destination):

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
        

        observations = {agent: self.observe(agent) for agent in self.agents}
        infos = {agent: {} for agent in self.agents}
        return observations, infos

    def observe(self, agent):



        
        num_cities = len(self.candidate_locations)
        distances = []
        timezones = []
        flight_times = []
        co2_vals = []
        prices = []
        combined = []
        
        for city in self.candidate_locations:
            distance = self.distances[agent][city]
            timezone = self.timezone_offsets[agent][city]
            flight_time = self.travel_matrix[agent][city]
            co2 = self.co2_emissions[agent][city]
            price = self.prices[agent][city]
            
            distances.append(distance)
            timezones.append(timezone)
            flight_times.append(flight_time)
            co2_vals.append(co2)
            prices.append(price)
            combined.append(distance + timezone + flight_time + co2 + price)
        


        obs_features = []
        

        def normalize_feature(feature_list):
            arr = np.array(feature_list, dtype=np.float32)
            max_val = arr.max()
            if max_val > 0 and not np.isnan(max_val) and not np.isinf(max_val):
                return (arr / max_val).tolist()
            return arr.tolist()
        

        norm_distances = normalize_feature(distances)
        norm_timezones = normalize_feature(timezones)
        norm_flight_times = normalize_feature(flight_times)
        norm_co2 = normalize_feature(co2_vals)
        norm_prices = normalize_feature(prices)
        norm_combined = normalize_feature(combined)
        

        for i in range(num_cities):
            obs_features.extend([
                norm_distances[i],
                norm_timezones[i],
                norm_flight_times[i],
                norm_co2[i],
                norm_prices[i],
                norm_combined[i]
            ])
        

        obs_features.extend([
            self.start_day_of_week / 6.0,
            self.end_day_of_week / 6.0,
            self.total_event_hours / 24.0
        ])
        
        obs = np.array(obs_features, dtype=np.float32)
        

        obs = np.nan_to_num(obs, nan=0.0, posinf=1.0, neginf=0.0)
        
        return obs
    
    def step(self, actions):

        self.actions = actions
        

        self.dones = {agent: True for agent in self.agents}
        self.dones["__all__"] = True
        

        votes = [self.candidate_locations[actions[agent]] for agent in self.agents]
        chosen_city = max(set(votes), key=votes.count)
        

        agent_costs = {}
        for agent in self.agents:
            distance = self.distances[agent][chosen_city]
            timezone = self.timezone_offsets[agent][chosen_city]
            flight_time = self.travel_matrix[agent][chosen_city]
            co2 = self.co2_emissions[agent][chosen_city]
            price = self.prices[agent][chosen_city]
            


            agent_costs[agent] = (
                0.15 * (distance / 1000) +
                0.15 * timezone +
                0.20 * flight_time +
                0.25 * (co2 / 10) +
                0.25 * (price / 100)
            )
            


            required_buffer_hours = 24
            total_required_time = flight_time + self.total_event_hours + required_buffer_hours
            

            if total_required_time > (self.availability_window_days * 24):
                time_overflow_penalty = (total_required_time - (self.availability_window_days * 24)) / 24
                agent_costs[agent] += 0.5 * time_overflow_penalty
        

        costs_array = np.array(list(agent_costs.values()))
        cost_std = np.std(costs_array)
        variation_penalty = 0.3 * cost_std
        

        self.rewards = {}
        for agent in self.agents:

            self.rewards[agent] = -(agent_costs[agent] + variation_penalty)
        

        observations = {agent: self.observe(agent) for agent in self.agents}
        

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
        

        truncated = {agent: False for agent in self.agents}
        truncated["__all__"] = False
        
        return observations, self.rewards, self.dones, truncated, self.infos

    def _next_agent(self):
        current_idx = self.agents.index(self.agent_selection)
        next_idx = (current_idx + 1) % len(self.agents)
        return self.agents[next_idx]

    def render(self):
        if all(action is not None for action in self.actions.values()):
            print("Votes:", {agent: self.candidate_locations[self.actions[agent]] 
                            for agent in self.agents if agent in self.actions})
            

            votes = [self.candidate_locations[self.actions[agent]] for agent in self.agents]
            vote_counts = {city: votes.count(city) for city in self.candidate_locations}
            print("Vote counts:", vote_counts)
            print("Chosen city:", self.infos[self.agents[0]].get("chosen_city"))

    def observation_space(self, agent):
        return self.observation_spaces[agent]

    def action_space(self, agent):
        return self.action_spaces[agent]