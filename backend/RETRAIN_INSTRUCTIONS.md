# How to Retrain the Model

## Problem

The model was trained with **global max normalization** which destroyed relative relationships between cities. After fixing to **per-feature normalization**, the model needs to be retrained to learn the new observation space.

## Quick Retrain

1. **Make sure you're in the backend directory:**

   ```bash
   cd /Users/glen/Desktop/durhack2025/backend
   ```

2. **Activate your Python environment** (the one with stable-baselines3 installed):

   ```bash
   # If using conda:
   conda activate durhack2025

   # Or if using venv:
   source venv/bin/activate
   ```

3. **Run the retraining script:**

   ```bash
   python retrain_model.py
   ```

4. **Wait for training** (takes 30-60 minutes depending on CPU)

5. **Restart the backend server** - it will automatically load the new model

## What Changed

**Before (broken):**

- All features normalized by global max
- Frankfurt CO2=6.7kg → normalized to ~0.03
- KL CO2=195kg → normalized to ~0.50
- Model couldn't see 29x difference!

**After (fixed):**

- Each feature normalized by its own max
- Frankfurt CO2=6.7kg → 6.7/195 = 0.034
- KL CO2=195kg → 195/195 = 1.0
- Model can clearly see 29x difference!

## Expected Results

After retraining, the model should:

- ✅ Choose Frankfurt over Kuala Lumpur for European attendees
- ✅ Choose Paris/London when all attendees are from Europe
- ✅ Better understand relative differences in CO2/distance
- ✅ Make more geographically sensible choices

## Note

The old model (`trained_ppo_travel_model_expanded.zip`) will be backed up to `trained_ppo_travel_model_expanded_backup.zip` automatically.
