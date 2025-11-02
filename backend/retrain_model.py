#!/usr/bin/env python3
# Use: /opt/homebrew/Caskroom/miniconda/base/bin/python3 retrain_model.py
"""
Retrain the PPO model with the fixed per-feature normalization.

The old model used global max normalization which lost relative relationships.
The new normalization preserves relative differences between cities.

Usage:
    python retrain_model.py
"""

import os
import sys
from stable_baselines3 import PPO
from supersuit import pettingzoo_env_to_vec_env_v1, concat_vec_envs_v1

# Import from backend (same as main.py)
# The travel_environment module is in backend/travel_environment
from travel_environment.env.travel_environment import TravelEnvironment

def main():
    print("=" * 80)
    print("RETRAINING MODEL WITH FIXED PER-FEATURE NORMALIZATION")
    print("=" * 80)
    print()
    print("Changes:")
    print("  ✅ Per-feature normalization (preserves relative relationships)")
    print("  ✅ Model can now distinguish 'much better' from 'slightly better'")
    print("  ✅ Should choose European cities for European attendees")
    print()
    
    # Use the same scenario as the original training
    scenario = {
        "attendees": {
            "Mumbai": 2,
            "Shanghai": 3,
            "Hong Kong": 1,
            "Singapore": 2,
            "Sydney": 2
        },
        "availability_window": {
            "start": "2025-12-10T09:00:00Z",
            "end": "2025-12-15T17:00:00Z"
        },
        "event_duration": {
            "days": 0,
            "hours": 4
        }
    }
    
    # Create environment with new normalization
    print("📦 Creating environment...")
    parallel_env = TravelEnvironment(scenario)
    
    print(f"✈️  Loaded {len(parallel_env.candidate_locations)} candidate destinations")
    print(f"📍 QRT Headquarters (start locations): 13 cities")
    print()
    
    # Convert to vectorized environment
    print("🔄 Converting to vectorized environment...")
    vec_env = pettingzoo_env_to_vec_env_v1(parallel_env)
    vec_env = concat_vec_envs_v1(vec_env, num_vec_envs=1, num_cpus=1, base_class="stable_baselines3")
    
    # Create model with same hyperparameters as original expanded model
    print("🤖 Creating PPO model...")
    model = PPO(
        "MlpPolicy",
        vec_env,
        verbose=1,
        learning_rate=0.0003,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.01,
        tensorboard_log="./ppo_travel_tensorboard_retrained/"
    )
    
    # Train the model
    print()
    print("=" * 80)
    print("TRAINING MODEL (300,000 timesteps)")
    print("=" * 80)
    print()
    print("This may take 30-60 minutes depending on your CPU...")
    print()
    
    model.learn(total_timesteps=300000)
    
    # Save the model - save directly to backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(backend_dir, "trained_ppo_travel_model_expanded.zip")
    
    # Backup old model if it exists
    if os.path.exists(model_path):
        backup_path = model_path.replace(".zip", "_backup.zip")
        print(f"📦 Backing up old model to {os.path.basename(backup_path)}...")
        os.rename(model_path, backup_path)
    
    model.save(model_path.replace(".zip", ""))
    
    # Stable-baselines3 saves as .zip automatically
    print()
    print("=" * 80)
    print(f"✅ Model saved to: {model_path}")
    print("=" * 80)
    print()
    print("📝 Next steps:")
    print(f"   1. Restart the backend server (it will auto-load the new model)")
    print(f"   2. Test with a request - model should now choose better cities!")
    print()
    
    # Quick test
    print("🧪 Testing model...")
    obs, info = parallel_env.reset()
    actions = {}
    for agent in parallel_env.agents:
        agent_obs = obs[agent]
        action, _states = model.predict(agent_obs, deterministic=True)
        actions[agent] = action
    
    observations, rewards, dones, truncated, infos = parallel_env.step(actions)
    
    if parallel_env.agents:
        first_agent = parallel_env.agents[0]
        if first_agent in infos and 'chosen_city' in infos[first_agent]:
            chosen = infos[first_agent]['chosen_city']
            print(f"   Test result: Model chose '{chosen}' for test scenario")
            print()
    
    print("✅ Retraining complete!")

if __name__ == "__main__":
    main()

