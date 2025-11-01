import pandas as pd
import os

# Read emissions.csv and select required columns
emissions_df = pd.read_csv('emissions.csv', low_memory=False)
emissions_subset = emissions_df[['SCHEDULED_FLIGHT_LEG_PK', 'ESTIMATED_CO2_TOTAL_TONNES']]

# Path to the 12 folder
folder_path = '12'

# Get list of all CSV files in the 12 folder
csv_files = [f for f in os.listdir(folder_path) if f.endswith('.csv')]

# List to store all merged dataframes
merged_dfs = []

# Process each file
for file in csv_files:
    # Read the current CSV file and select required columns
    current_df = pd.read_csv(os.path.join(folder_path, file), low_memory=False)
    current_subset = current_df[['OAG_SCHEDULE_FINGERPRINT', 'DEPCTRY', 'ARRCTRY', 'ELPTIM', 'STOPS', 'DISTANCE']]
    
    # Define column name mappings
    left_on = ['SCHEDULED_FLIGHT_LEG_PK']
    right_on = ['OAG_SCHEDULE_FINGERPRINT']
    
    # Perform inner join using different column names
    merged_df = pd.merge(
        emissions_subset,
        current_subset,
        left_on=left_on,
        right_on=right_on,
        how='inner'
    )
    
    # Remove SCHEDULED_FLIGHT_LEG_PK from the merged dataframe
    merged_df = merged_df.drop('SCHEDULED_FLIGHT_LEG_PK', axis=1)
    
    # Add the merged dataframe to our list
    merged_dfs.append(merged_df)
    print(f'Processed: {file}')

# Concatenate all merged dataframes
final_df = pd.concat(merged_dfs, ignore_index=True)

# Save the final concatenated dataframe
final_df.to_csv('final_merged_data.csv', index=False)
print(f'Saved final merged data to: final_merged_data.csv')