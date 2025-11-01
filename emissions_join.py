import pandas as pd
import os

# Read emissions.csv
emissions_df = pd.read_csv('emissions.csv', low_memory=False)

# Path to the 12 folder
folder_path = '12'

# Get list of all CSV files in the 12 folder
csv_files = [f for f in os.listdir(folder_path) if f.endswith('.csv')]

# Process each file
for file in csv_files:
    # Read the current CSV file
    current_df = pd.read_csv(os.path.join(folder_path, file), low_memory=False)
    
    # Perform inner join
    merged_df = pd.merge(
        emissions_df,
        current_df,
        on=['OAG_SCHEDULE_FINGERPRINT', 'SCHEDULE_FLIGHT_LEG_PK'],
        how='inner'
    )
    
    # Create output filename
    output_filename = f'joined_{file}'
    
    # Save the merged dataframe
    merged_df.to_csv(output_filename, index=False)
    
    print(f'Processed and saved: {output_filename}')