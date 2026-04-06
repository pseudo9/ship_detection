import struct
import datetime
import matplotlib.pyplot as plt
import warnings
import pandas as pd
import numpy as np
import warnings
from scipy.optimize import curve_fit
from sklearn.neighbors import KernelDensity
from sklearn.metrics import r2_score




def process_binary_data(file_bytes: bytes) -> pd.DataFrame:
    """
    Parses binary content and returns a pandas DataFrame with raw data.
    """
    records = []
    offset = 0
    buffer_len = len(file_bytes)
    record_size = 12  # >QHBB size

    while offset + record_size <= buffer_len:
        # Unpack 12 bytes from the current offset
        chunk = file_bytes[offset : offset + record_size]
        timestamp, amplitude, pulse_width, b2 = struct.unpack(">QHBB", chunk)

        dt = datetime.datetime.utcfromtimestamp(timestamp / 1e9)

        records.append({
            "timestamp": dt,
            "amplitude": amplitude,
            "pulse_width": pulse_width * 20, # Applying your multiplier
            "b2": b2
        })
        
        offset += record_size

    return pd.DataFrame(records)

def enrich_data(df: pd.DataFrame):
    """
    Calculates smoothed data and signal attributes.
    """
    if df.empty:
        return df, 0.0, 0.0

    # 1. Calculate Pulse Width Smooth (Moving Average)
    # We use a window of 5 for smoothing, backfilling NaN values
    df["pulse_width_smooth"] = df["pulse_width"].rolling(window=5, min_periods=1).mean()

    # 2. Calculate Pulse Repetition Frequency (PRF)
    # PRF = 1 / (Time difference between pulses in seconds)
    # We calculate the average PRF for the whole file
    time_diffs = df["timestamp"].diff().dt.total_seconds()
    avg_period = time_diffs.mean()
    
    prf = 0.0
    if avg_period > 0:
        prf = 1.0 / avg_period

    # 3. Calculate Radar Rotation Speed
    # NOTE: Calculating rotation speed usually requires Azimuth data.
    # If 'b2' is not azimuth, we cannot calculate this accurately.
    # For now, we will return a placeholder or 0.0.
    radar_speed = 0.0 

    return df, prf, radar_speed




# The pulse width tends to have noice and seem to fluctate in range of +-40 also there is 
# lot of values which equates to 40 which i assume is base line or noice
# this function adda a pulse width clean colum iterate through each second and replace the differnt values with mode

def process_pulse_width(df, threshold):
    # Create the clean column (copy of original)
    # We do this to ensure the DataFrame stays the exact same size
    df['pulse_width_clean'] = df['pulse_width']
    
    grouper = df.groupby(pd.Grouper(key='timestamp', freq='1S'))

    print("Processing seconds...")

    for time_key, group in grouper:
        if group.empty:
            continue

        # 1. Get raw values as a NumPy array
        raw_values = group['pulse_width'].values
        
        # 2. Filter for STATISTICS only (exclude noise/low values)
        # We use Boolean Indexing (not list comprehension) to keep it a NumPy array
        stats_values = raw_values[raw_values > threshold]

        # If no data is left after filtering, skip this second
        if len(stats_values) == 0:
            continue

        # 3. Calculate Percentiles on the filtered data
        lower_percentile = 12.5
        upper_percentile = 87.5
        
        lower_bound = np.percentile(stats_values, lower_percentile)
        upper_bound = np.percentile(stats_values, upper_percentile)
        
        # 4. Get the Central Subset (75% of data)
        # This masking works because stats_values is still a NumPy array
        subset = stats_values[(stats_values >= lower_bound) & (stats_values <= upper_bound)]
        
        if len(subset) == 0:
            continue

        # 5. Check Coefficient of Variation (CV)
        subset_mean = np.mean(subset)
        subset_std = np.std(subset)
        
        if subset_mean == 0:
            continue
            
        cv = (subset_std / subset_mean) * 100
        
        # 6. Apply Replacement logic
        if cv < 10:
            # We found a stable signal!
            target_median = np.median(subset)
            
            range_min = target_median - 30
            range_max = target_median + 30
            
            # --- CRITICAL STEP ---
            # We apply the update to the ORIGINAL group (which includes values < threshold)
            # We only touch values that fall within the median +/- 20 range
            
            mask = (group['pulse_width'] >= range_min) & (group['pulse_width'] <= range_max)
            
            # Get indices and update the main DataFrame
            indices_to_update = group[mask].index
            df.loc[indices_to_update, 'pulse_width_clean'] = target_median

    print("Processing complete.")
    return df


# THe data is hours long inital algorithm is applied to identify in which periods
# one or more ships is in range in sensor based on amplitude values mean and variance


def get_pulse_sets(data, amp_col='amplitude', time_col='timestamp', std_multiplier=1.5,noise_quantile=0.9, gap_tolerance_mins=2):
    """
    Segments data into a list of DataFrames based on signal jumps.
    
    Parameters:
    - std_multiplier: Defines threshold (Mean + std_multiplier * Std_Dev).
    - gap_tolerance_mins: Merges high-signal points if they are closer than this gap.
    """
    # 1. Define Dynamic Threshold
    amp = data[amp_col]

    # keep only the lower `noise_quantile` fraction, e.g. bottom 90%
    cutoff = amp.quantile(noise_quantile)
    noise_region = amp[amp <= cutoff]

    mean_val = noise_region.mean()
    std_val = noise_region.std()
    threshold = mean_val + std_multiplier * std_val
    print(f"Noise-based stats: mean={mean_val:.2f}, std={std_val:.2f}")
    print(f"Calculated Threshold: {threshold:.2f}")
    
#     print(f"Calculated Threshold: {threshold:.2f} (Mean: {mean_val:.2f})")
    
    # 2. Filter High Amplitude Points
    high_signal = data[data[amp_col] > threshold].copy()
    
    if high_signal.empty:
        return []

    # 3. Group Points into Events
    # We calculate the time difference between consecutive high-signal points.
    # If the difference is large (e.g., > 5 mins), it indicates a new pulse set.
    high_signal['time_diff'] = high_signal[time_col].diff()
    
    # A 'New Group' starts where the gap is larger than our tolerance
    gap_tolerance = pd.Timedelta(minutes=gap_tolerance_mins)
    high_signal['group_id'] = (high_signal['time_diff'] > gap_tolerance).cumsum()
    
    # 4. Create List of DataFrames
    pulse_dataframes = []
    for _, group in high_signal.groupby('group_id'):
        # Option A: Return strictly the points above threshold
        # pulse_dataframes.append(group.drop(columns=['time_diff', 'group_id']))
        
        # Option B (Recommended): Return the full slice (start to end) to capture rising edges
        start_t = group[time_col].min()
        end_t = group[time_col].max()
        full_slice = data[(data[time_col] >= start_t) & (data[time_col] <= end_t)]
        pulse_dataframes.append(full_slice)
        
    return pulse_dataframes




# --- 1. Helper Function: Gaussian Model ---
def gaussian_func(x, a, mu, sigma):
    return a * np.exp(-((x - mu)**2) / (2 * sigma**2))

# --- 2. Helper Function: Calculate Bell Score ---
def calculate_bell_score(df_group):
    """
    Fits a Gaussian curve to the amplitude data.
    Returns: R^2 score (1.0 is perfect).
    """
    # Needs time relative to start of group (in seconds)
    time_zero = df_group['timestamp'].min()
    x_data = (df_group['timestamp'] - time_zero).dt.total_seconds().values
    y_data = df_group['amplitude'].values
    
    # Need at least 4 points to fit a 3-parameter curve
    if len(x_data) < 4:
        return 0.0

    # Initial Guesses
    a_guess = np.max(y_data)
    mu_guess = x_data[np.argmax(y_data)]
    sigma_guess = np.std(x_data) if np.std(x_data) > 0 else 0.01

    p0 = [a_guess, mu_guess, sigma_guess]

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            # Fit the curve
            popt, _ = curve_fit(gaussian_func, x_data, y_data, p0=p0, maxfev=600)

        # Calculate R^2 Score
        y_predicted = gaussian_func(x_data, *popt)
        score = r2_score(y_data, y_predicted)
        return score

    except Exception:
        return 0.0

# # --- 3. Main Function ---
# def tag_radar_groups_old(df, time_gap_ms=2.0, pw_tolerance=10, min_points=5, bell_threshold=0.6, pulse_width_treshold = 60):
#     """
#     Tags groups based on Time/PW continuity AND Bell Curve shape.
#     """
    
#     # --- PHASE 1: Grouping (Your Original Logic) ---
    
#     # Sort by Timestamp
#     df = df.sort_values(by='timestamp').reset_index(drop=True)
    
#     # Calculate Differences
#     time_diffs = df['timestamp'].diff().dt.total_seconds() * 1000
#     pw_diffs = df['pulse_width_clean'].diff().abs()
    
#     # Identify Break Points
#     is_new_group = (time_diffs > time_gap_ms) | (pw_diffs > pw_tolerance)
#     is_new_group.iloc[0] = True 
    
#     # Create Initial Group IDs
#     df['group_id'] = is_new_group.cumsum()
    
#     # Filter out "Too Few Points"
#     group_counts = df['group_id'].value_counts()
#     potential_groups = group_counts[group_counts >= min_points].index
    
#     # --- PHASE 2: Bell Curve Validation ---
    
#     valid_bell_groups = []
    
#     print(f"Checking {len(potential_groups)} potential groups for bell shape...")
    
#     # Iterate only through the groups that passed the point-count check
#     # We iterate over unique IDs to avoid reprocessing the whole DF
#     for gid in potential_groups:
#         group_data = df[df['group_id'] == gid]
        
#         # Calculate the score
#         score = calculate_bell_score(group_data)
        
#         # Keep if score is good
#         if score >= bell_threshold:
#             valid_bell_groups.append(gid)
            
#     # --- PHASE 3: Final Tagging ---
    
#     # Convert list to set for faster lookup
#     valid_bell_set = set(valid_bell_groups)
    
#     # Create 'valid_group_id'
#     # If it's in our valid set, keep the ID. Otherwise -1.
#     df['valid_group_id'] = df['group_id'].where(df['group_id'].isin(valid_bell_set), -1)
#     df.loc[df["pulse_width_clean"]>pulse_width_treshold, 'valid_group_id'] = -1

#     # --- PHASE 4: Add Group Timestamp String ---

#     # Initialize the column with a default value (e.g., None or empty string)
#     df['group_timestamp'] = ""

#     # Only process rows that belong to a valid group
#     mask = df['valid_group_id'] != -1

#     if mask.any():
#         # 1. Calculate the start and end for each valid group
#         # We use .astype(str) to format the timestamp for the concatenation
#         group_bounds = df[mask].groupby('valid_group_id')['timestamp'].agg(['min', 'max'])
        
#         # 2. Create the concatenated string: "start_time - end_time"
#         # Using .dt.strftime to make it readable (adjust format as needed)
#         fmt = "%Y-%m-%d %H:%M:%S"
#         group_bounds['combined_str'] = (
#             group_bounds['min'].dt.strftime(fmt) + 
#             " - " + 
#             group_bounds['max'].dt.strftime(fmt)
#         )
        
#         # 3. Map these strings back to the original dataframe
#         df.loc[mask, 'group_timestamp'] = df.loc[mask, 'valid_group_id'].map(group_bounds['combined_str'])

    
    
#     print(f"Found {len(valid_bell_set)} valid bell-curve groups.")

#     df.to
    
#     return df


import pandas as pd
import numpy as np

import pandas as pd
import numpy as np


# def tag_radar_groups(df, amp_threshold=100, pw_threshold=60, min_points=5, cv_threshold=0.1):
    
#     # Sort data
#     df = df.sort_values(by='timestamp').reset_index(drop=True)
    
#     # Initialize columns
#     df['group_id'] = -1
#     df['valid_group_id'] = -1
#     df['pulse_width_smooth'] = np.nan
#     df['group_timestamp'] = ""
#     df['pulse_repetition_time_us'] = np.nan

#     # --- PHASE 1: Your Iterative Logic (Fixed) ---
#     group_id = 0
#     group_buffer = []
    
#     for i, row in df.iterrows():
#         # Check if point is ABOVE the noise floor (The "Up" part of the peak)
#         is_signal = (row['amplitude'] > amp_threshold) and (row['pulse_width'] > pw_threshold)
        
#         if is_signal:
#             group_buffer.append(i)
#         else:
#             # The signal just went "Down" (below threshold). 
#             # This marks the end of a peak. Save the group.
#             if len(group_buffer) >= min_points:
#                 df.loc[group_buffer, "group_id"] = group_id
#                 group_id += 1
            
#             # Reset buffer for the next peak
#             group_buffer = []

#     # CRITICAL FIX: If the file ends while we are still inside a peak, save it.
#     if len(group_buffer) >= min_points:
#         df.loc[group_buffer, "group_id"] = group_id


#     # --- PHASE 2: Check Stability (CV < 0.1 on middle 75%) ---
#     # We loop only through the valid groups we just found
#     found_groups = df[df['group_id'] != -1]['group_id'].unique()
    
#     for gid in found_groups:
#         group_mask = df['group_id'] == gid
#         pw_data = df.loc[group_mask, 'pulse_width']
        
#         # 1. Get the middle 75% (closest to mean)
#         mean_pw = pw_data.mean()
#         dist = (pw_data - mean_pw).abs()
#         count = max(1, int(len(pw_data) * 0.75))
        
#         stable_indices = dist.nsmallest(count).index
#         stable_subset = pw_data.loc[stable_indices]
        
#         # 2. Calculate CV
#         subset_mean = stable_subset.mean()
#         if subset_mean == 0:
#             cv = 1.0 # Avoid div by zero
#         else:
#             cv = stable_subset.std() / subset_mean

#         # 3. If stable, mark as valid and save the smoothed median
#         if cv < cv_threshold:
#             df.loc[group_mask, 'valid_group_id'] = gid
#             df.loc[group_mask, 'pulse_width_smooth'] = stable_subset.median()

#             group_timestamps = df.loc[group_mask, 'timestamp']
#             time_diffs = group_timestamps.diff().dropna()
#             if not time_diffs.empty:
#                 avg_pri_us = time_diffs.dt.total_seconds().mean() * 1_000_000
#                 df.loc[group_mask, 'pulse_repetition_time_us'] = avg_pri_us

#             # --- PHASE 3: Timestamp (Only for valid groups) ---
#             # Extract start and end time for this specific group
#             start_t = df.loc[group_mask, 'timestamp'].min().strftime("%H:%M:%S.%f")[:-3]
#             end_t = df.loc[group_mask, 'timestamp'].max().strftime("%H:%M:%S.%f")[:-3]
#             df.loc[group_mask, 'group_timestamp'] = f"{start_t} - {end_t}"

#             print(df)
#             sys.exit()
#     print(f"Found {group_id} peaks. {len(df[df['valid_group_id']!=-1]['valid_group_id'].unique())} passed stability check.")
    
#     return df


# # --- MAIN FUNCTION ---
# def tag_radar_groups(df, amp_threshold=100, pw_threshold=60, min_points=5, cv_threshold=0.1, bell_threshold=0.7):
    
#     # Sort data
#     df = df.sort_values(by='timestamp').reset_index(drop=True)
    
#     # Initialize columns
#     df['group_id'] = -1
#     df['valid_group_id'] = -1
#     df['pulse_width_smooth'] = np.nan
#     df['group_timestamp'] = ""
#     df['pulse_repetition_time_us'] = np.nan
    
#     # --- PHASE 1: Iterative Grouping (Thresholds) ---
#     group_id = 0
#     group_buffer = []
    
#     for i, row in df.iterrows():
#         # Check if point is ABOVE the noise floor (The "Up" part of the peak)
#         is_signal = (row['amplitude'] > amp_threshold) and (row['pulse_width'] > pw_threshold)
        
#         if is_signal:
#             group_buffer.append(i)
#         else:
#             # The signal just went "Down". End of peak.
#             if len(group_buffer) >= min_points:
#                 df.loc[group_buffer, "group_id"] = group_id
#                 group_id += 1
#             group_buffer = []

#     # End of File Flush
#     if len(group_buffer) >= min_points:
#         df.loc[group_buffer, "group_id"] = group_id


#     # --- PHASE 2: Validation Loop (CV & Bell Score) ---
#     found_groups = df[df['group_id'] != -1]['group_id'].unique()
#     valid_count = 0
    
#     for gid in found_groups:
#         group_mask = df['group_id'] == gid
#         group_data = df[group_mask]
#         pw_data = group_data['pulse_width']
        
#         # --- A. Pulse Width Stability (CV Check) ---
        
#         # 1. Get the middle 75% (closest to mean)
#         mean_pw = pw_data.mean()
#         dist = (pw_data - mean_pw).abs()
#         count = max(1, int(len(pw_data) * 0.75))
        
#         stable_indices = dist.nsmallest(count).index
#         stable_subset = pw_data.loc[stable_indices]
        
#         # 2. Calculate CV
#         subset_mean = stable_subset.mean()
#         if subset_mean == 0:
#             cv = 1.0 
#         else:
#             cv = stable_subset.std() / subset_mean

#         if cv >= cv_threshold:
#             continue # Skip if unstable

#         # --- B. Amplitude Shape (Bell Curve Check) ---
        
#         bell_score = calculate_bell_score(group_data)
        
#         if bell_score < bell_threshold:
#             continue # Skip if it doesn't look like a radar lobe
            
#         # --- C. Success: Mark as Valid ---

#         group_timestamps = df.loc[group_mask, 'timestamp']
#         time_diffs = group_timestamps.diff().dropna()
#         if not time_diffs.empty:
#             avg_pri_us = time_diffs.dt.total_seconds().mean() * 1_000_000
#             df.loc[group_mask, 'pulse_repetition_time_us'] = avg_pri_us
        
#         valid_count += 1
#         df.loc[group_mask, 'valid_group_id'] = gid
#         df.loc[group_mask, 'pulse_width_smooth'] = stable_subset.median()

#         # Timestamp Formatting
#         start_t = df.loc[group_mask, 'timestamp'].min().strftime("%H:%M:%S.%f")[:-3]
#         end_t = df.loc[group_mask, 'timestamp'].max().strftime("%H:%M:%S.%f")[:-3]
#         df.loc[group_mask, 'group_timestamp'] = f"{start_t} - {end_t}"

#         print(df)
#         xx

#     print(f"Processed {len(found_groups)} raw peaks. {valid_count} passed CV and Bell checks.")
    
#     return df



# --- MAIN FUNCTION ---
def tag_radar_groups(df, amp_threshold=100, pw_threshold=60, min_points=5, cv_threshold=0.1, bell_threshold=0.7, pw_mode_tolerance=100):
    
    # Sort data
    df = df.sort_values(by='timestamp').reset_index(drop=True)
    
    # Initialize columns
    df['group_id'] = -1
    df['valid_group_id'] = -1
    df['pulse_width_smooth'] = np.nan
    df['pulse_width_mode'] = np.nan 
    df['est_radar_rotation_time'] = np.nan 
    df['group_timestamp'] = ""
    df['peak_time'] = pd.NaT 
    df['pulse_repetition_time_micro_s'] = np.nan
    
    # --- PHASE 1: Iterative Grouping (Thresholds) ---
    group_id = 0
    group_buffer = []
    
    for i, row in df.iterrows():
        is_signal = (row['amplitude'] > amp_threshold) and (row['pulse_width'] > pw_threshold)
        
        if is_signal:
            group_buffer.append(i)
        else:
            if len(group_buffer) >= min_points:
                df.loc[group_buffer, "group_id"] = group_id
                group_id += 1
            group_buffer = []

    if len(group_buffer) >= min_points:
        df.loc[group_buffer, "group_id"] = group_id


    # --- PHASE 2: Validation Loop (CV & Bell) ---
    found_groups = df[df['group_id'] != -1]['group_id'].unique()
    valid_count = 0
    
    for gid in found_groups:
        group_mask = df['group_id'] == gid
        group_data = df[group_mask]
        pw_data = group_data['pulse_width']
        
        # A. Stability (CV Check)
        mean_pw = pw_data.mean()
        dist = (pw_data - mean_pw).abs()
        count = max(1, int(len(pw_data) * 0.75))
        
        stable_indices = dist.nsmallest(count).index
        stable_subset = pw_data.loc[stable_indices]
        
        subset_mean = stable_subset.mean()
        cv = stable_subset.std() / subset_mean if subset_mean != 0 else 1.0

        if cv >= cv_threshold: continue 

        # B. Amplitude Shape (Bell Curve Check)
        bell_score = calculate_bell_score(group_data)
        if bell_score < bell_threshold: continue 

        group_timestamps = df.loc[group_mask, 'timestamp']
        time_diffs = group_timestamps.diff().dropna()
        if not time_diffs.empty:
            diffs_us = time_diffs.dt.total_seconds() * 1_000_000
                
            # 2. Round to nearest 50
            # Logic: Divide by 50, round to nearest integer, multiply by 50
            rounded_diffs = (diffs_us / 50).round() * 50
            
            # 3. Calculate Mode
            modes = rounded_diffs.mode()
            
            if not modes.empty:
                # If multiple modes exist (e.g., tie between 1000 and 1050), 
                # this takes the first one (lowest value usually).
                pri_mode = modes.iloc[0] 
                df.loc[group_mask, 'pulse_repetition_time_micro_s'] = pri_mode
            
        # C. Success: Mark as Valid
        valid_count += 1
        idx_of_peak = group_data['amplitude'].idxmax()
        peak_timestamp = df.loc[idx_of_peak, 'timestamp']
        
        df.loc[group_mask, 'valid_group_id'] = gid
        df.loc[group_mask, 'pulse_width_smooth'] = stable_subset.median()
        df.loc[group_mask, 'peak_time'] = peak_timestamp

        start_t = df.loc[group_mask, 'timestamp'].min().strftime("%H:%M:%S.%f")[:-3]
        end_t = df.loc[group_mask, 'timestamp'].max().strftime("%H:%M:%S.%f")[:-3]
        df.loc[group_mask, 'group_timestamp'] = f"{start_t} - {end_t}"



    print(f"Processed {len(found_groups)} raw peaks. {valid_count} passed CV and Bell checks.")

    # --- PHASE 3: Iterative Pulse Width Mode Identification ---
    # We use iterative KDE to find the Mode, then snap to the closest observed value.
    
    

    valid_groups_df = df.loc[df['valid_group_id'] != -1, ['valid_group_id', 'pulse_width_smooth']].drop_duplicates()
    remaining_pws = valid_groups_df['pulse_width_smooth'].values
    
    group_mode_map = {}
    identified_modes = []

    while len(remaining_pws) > 0:
        # 1. Reshape for KDE
        X = remaining_pws.reshape(-1, 1)
        
        # 2. Run KDE 
        # Bandwidth: Tolerance/3
        kde = KernelDensity(kernel='gaussian', bandwidth=pw_mode_tolerance/3.0).fit(X)
        
        # 3. High-Resolution Grid Search
        x_grid = np.linspace(min(remaining_pws)-50, max(remaining_pws)+50, 2000)
        log_dens = kde.score_samples(x_grid.reshape(-1, 1))
        dens = np.exp(log_dens)
        
        # 4. Find Peak
        peak_idx = np.argmax(dens)
        kde_peak_value = x_grid[peak_idx]
        
        # 5. Identify the cluster of values near this peak
        close_mask = np.abs(remaining_pws - kde_peak_value) <= pw_mode_tolerance
        cluster_values = remaining_pws[close_mask]
        
        if len(cluster_values) == 0:
            break
            
        # CRITICAL CHANGE: Select value from the list closest to the KDE peak
        # We find the specific observed value that minimizes difference to the calculated peak
        idx_closest = np.argmin(np.abs(cluster_values - kde_peak_value))
        final_mode_val = cluster_values[idx_closest]
        
        identified_modes.append(final_mode_val)
        
        # 6. Assign this REAL observed mode to all groups in the cluster
        # We look back at the original DF to find groups with these PW values
        # Note: We use the KDE peak for clustering (filtering), but assign the final_mode_val
        groups_in_cluster = valid_groups_df[
            np.abs(valid_groups_df['pulse_width_smooth'] - kde_peak_value) <= pw_mode_tolerance
        ]
        
        for gid in groups_in_cluster['valid_group_id']:
            if gid not in group_mode_map:
                group_mode_map[gid] = final_mode_val
        
        # 7. Remove values and repeat
        remaining_pws = remaining_pws[~close_mask]

    print(f"Identified Pulse Width Modes: {identified_modes}")

    # Map the found modes back to the main dataframe
    df['pulse_width_mode'] = -1
    if group_mode_map:
        gid_to_mode = pd.Series(group_mode_map)
        # Using -1 as the default fill value
        df.loc[df['valid_group_id'] != -1, 'pulse_width_mode'] = df['valid_group_id'].map(gid_to_mode).fillna(-1)


    # --- PHASE 4: Grouped Rotation Calculation & Summary ---
    rotation_logs = []
    unique_modes = df['pulse_width_mode'].unique()
    unique_modes = [m for m in unique_modes if m != -1]

    for mode in unique_modes:
        mode_groups = df[df['pulse_width_mode'] == mode][['valid_group_id', 'peak_time']].drop_duplicates()
        mode_groups = mode_groups.sort_values(by='peak_time')
        groups_list = mode_groups.to_dict('records')

        if len(groups_list) > 1:
            for i in range(1, len(groups_list)):
                prev = groups_list[i-1]
                curr = groups_list[i]
                time_diff = (curr['peak_time'] - prev['peak_time']).total_seconds()
                rotation_logs.append({
                    "Pulse Width Mode": mode,
                    "Group Pair": f"{int(prev['valid_group_id'])} - {int(curr['valid_group_id'])}",
                    "Rotation Time (s)": round(time_diff, 1),
                    "Peak Time 1": prev['peak_time'],
                    "Peak Time 2": curr['peak_time']
                })

    if rotation_logs:
        rot_df = pd.DataFrame(rotation_logs)
        rot_df = rot_df.sort_values(by=['Pulse Width Mode', 'Peak Time 1'])
        
        rotation_time_estimate = []
        
        for pw_mode, group_df in rot_df.groupby("Pulse Width Mode"):
            rounded_times = group_df["Rotation Time (s)"].round(1)
            
            if not rounded_times.empty:
                freq_table = rounded_times.value_counts().sort_index().reset_index()
                freq_table.columns = ['Rotation Time', 'Count']
                freq_table['Percentage'] = (freq_table['Count'] / freq_table['Count'].sum()) * 100
                freq_table = freq_table.sort_values(by='Count', ascending=False)
                # Save to specific file for this mode
                filename = f"freq_dist_mode_{int(pw_mode)}{str(datetime.datetime.now()).replace(':', '_')}.csv"
                # freq_table.to_csv(filename, index=False)
                modes = rounded_times.mode()
                est_rotation = modes.iloc[0] if not modes.empty else np.nan
                
                if est_rotation > 3 or est_rotation < 1:
                    est_rotation = np.nan
            else:
                est_rotation = np.nan

            rotation_time_estimate.append({
                "Pulse Width Mode": pw_mode, 
                "Estimated Rotation Time (s)": est_rotation,
                "Sample Count": len(group_df)
            })
        
        rot_df_summary = pd.DataFrame(rotation_time_estimate)
        # rot_df_summary.to_csv("radar_rotation_log_summary.csv", index=False)

        rot_df_summary_dict = dict(zip(rot_df_summary["Pulse Width Mode"], rot_df_summary["Estimated Rotation Time (s)"]))
        print("Rotation Summary:", rot_df_summary_dict)
        
        df["est_radar_rotation_time"] = df["pulse_width_mode"].map(rot_df_summary_dict).fillna(0)
        
        # rot_df.to_csv("radar_rotation_log.csv", index=False)
        print(f"Rotation log saved. Processed {len(unique_modes)} radar modes.")
    else:
        print("No rotation intervals calculated.")
        df["est_radar_rotation_time"] = np.nan

    return df


def is_point_in_polygon(point, polygon):
    """
    Ray-casting algorithm to check if a point is inside a polygon.
    point: Tuple (latitude, longitude)
    polygon: List of Tuples [(lat, lon), ...]
    """
    x, y = point
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        x_inters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= x_inters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside