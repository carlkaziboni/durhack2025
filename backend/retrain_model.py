#!/usr/bin/env python3


import os
import sys
from stable_baselines3 import PPO
from supersuit import pettingzoo_env_to_vec_env_v1, concat_vec_envs_v1



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


    print("📦 Creating environment...")
    parallel_env = TravelEnvironment(scenario)

    print(f"✈️  Loaded {len(parallel_env.candidate_locations)} candidate destinations")
    print(f"📍 QRT Headquarters (start locations): 13 cities")
    print()


    print("🔄 Converting to vectorized environment...")
    vec_env = pettingzoo_env_to_vec_env_v1(parallel_env)
    vec_env = concat_vec_envs_v1(vec_env, num_vec_envs=1, num_cpus=1, base_class="stable_baselines3")


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


    print()
    print("=" * 80)
    print("TRAINING MODEL (300,000 timesteps)")
    print("=" * 80)
    print()
    print("This may take 30-60 minutes depending on your CPU...")
    print()

    model.learn(total_timesteps=300000)


    backend_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(backend_dir, "trained_ppo_travel_model_expanded.zip")


    if os.path.exists(model_path):
        backup_path = model_path.replace(".zip", "_backup.zip")
        print(f"📦 Backing up old model to {os.path.basename(backup_path)}...")
        os.rename(model_path, backup_path)

    model.save(model_path.replace(".zip", ""))


    print()
    print("=" * 80)
    print(f"✅ Model saved to: {model_path}")
    print("=" * 80)
    print()
    print("📝 Next steps:")
    print(f"   1. Restart the backend server (it will auto-load the new model)")
    print(f"   2. Test with a request - model should now choose better cities!")
    print()


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

