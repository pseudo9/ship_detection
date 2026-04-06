from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from models import get_db, SignalAttribute, SignalData, AISData, ShipFingerprint
from process import *
import json
import io
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to specific origins if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

min_active_period = 5 # minimum active period for a ships signal to be considered for processing 
pulse_width_treshhold = 40


@app.post("/upload-sensor-data/")
async def upload_sensor_data(file: UploadFile = File(...), db: Session = Depends(get_db)):

    print(file)
    if not file.filename.endswith(".bin"):
        raise HTTPException(status_code=400, detail="Only .bin files are allowed")

    # try:
    # 1. Read file content into memory
    content = await file.read()
    
    # 2. Parse binary to DataFrame
    raw_df = process_binary_data(content)

    if raw_df.empty:
        raise HTTPException(status_code=400, detail="Parsed file contains no data")

    unique_sensor_dates = raw_df["timestamp"].dt.date.dropna().unique()
    if len(unique_sensor_dates) > 1:
        raise HTTPException(
                status_code=400,
                detail="You can upload data for only one day at a time",
            )

    sensor_date = unique_sensor_dates[0]
    day_start = datetime.combine(sensor_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    ais_exists_for_date = (
        db.query(AISData.id)
        .filter(AISData.reception_time >= day_start)
        .filter(AISData.reception_time < day_end)
        .first()
    )

    if not ais_exists_for_date:
        print("Ais data for this date is not uploaded prease upload ais data first.")
        raise HTTPException(
                status_code=400,
                detail="Ais data for this date is not uploaded prease upload ais data first.",
            )

    radar_pulses = get_pulse_sets(raw_df, amp_col='amplitude', time_col='timestamp', std_multiplier=5, gap_tolerance_mins=4)
        
    # filter out only signals from ships that have lasted more than min_active_period
    for pulse in radar_pulses:
        td = pulse.timestamp.max() - pulse.timestamp.min()
        if td>timedelta(minutes = 1):
            print(td)
            
    radar_pulses = [
        pulse
        for pulse in radar_pulses
        if pulse.timestamp.max() - pulse.timestamp.min() >timedelta(minutes=min_active_period)
    ]

    print(len(radar_pulses), radar_pulses[0].columns)
    print(raw_df.columns)


    if not len(radar_pulses):
            raise HTTPException(status_code=400, detail="System unable to recognise any radar signals in uploaded data")
    
    raw_df = pd.concat(radar_pulses)
    
    # radar_pulses[0] = process_pulse_width(radar_pulses[0], pulse_width_treshhold)
    # new_groups = tag_radar_groups(radar_pulses[0], time_gap_ms=4.0, pw_tolerance=30, min_points=5, bell_threshold=0.8)

    processed_df_list = []
    i = 0
    for rad_pulse in radar_pulses:
        i+=1
        new_groups = tag_radar_groups(rad_pulse, amp_threshold=500, pw_threshold=60, min_points=5, cv_threshold=0.2)
        # print(new_groups)
        # new_groups.to_csv(f"test{i}.csv")
        processed_df = new_groups.loc[:, ["timestamp", "amplitude", "pulse_width", "pulse_width_smooth", "group_timestamp", "peak_time", "pulse_width_mode", "est_radar_rotation_time", "pulse_repetition_time_micro_s"]]
        processed_df_list.append(processed_df)
        # break



    final_df = pd.concat(processed_df_list) 
    final_df = final_df.loc[final_df["amplitude"]>500] 
    print(len(final_df))
    # return

    final_df = final_df.replace({np.nan: None})

    
    # 1) Bulk insert SignalData
    signal_df = final_df[["timestamp", "amplitude", "pulse_width"]].copy()
    signal_df["filename"] = file.filename

    signal_dicts = signal_df.to_dict(orient="records")
    db.bulk_insert_mappings(SignalData, signal_dicts)
    db.commit()

    # 2) Fetch inserted (id, timestamp) for this upload window
    # (assumes timestamps are within this file’s min/max range)
    start_ts = final_df["timestamp"].min()
    end_ts = final_df["timestamp"].max()

    inserted_rows = (
    db.query(SignalData.id, SignalData.timestamp)
    .filter(SignalData.filename == file.filename)
    .filter(SignalData.timestamp >= start_ts)
    .filter(SignalData.timestamp <= end_ts)
    .all()
    )

    # Map timestamp -> list of ids (timestamps might repeat)
    ts_to_ids = {}
    for sid, ts in inserted_rows:
        ts_to_ids.setdefault(ts, []).append(sid)

    # 3) Bulk insert SignalAttribute for valid rows only
    attr_df = final_df[final_df["pulse_width_smooth"].notna()].copy()
    attr_df = attr_df.loc[~(attr_df["est_radar_rotation_time"]==0), :]

    attr_dicts = []
    if not attr_df.empty:
        for row in attr_df.to_dict(orient="records"):
            ts = row["timestamp"]
            ids = ts_to_ids.get(ts)
            if not ids:
                continue
            signal_id = ids.pop()  # consume one id for this timestamp

            attr_dicts.append({
                "signal_id": signal_id,
                "signal_timestamp": ts,
                "pulse_width_smooth": row["pulse_width_smooth"],
                "pulse_width_mode": row["pulse_width_mode"],
                "group_timestamp": row["group_timestamp"],
                "peak_time": row["peak_time"],
                "est_radar_rotation_time": row["est_radar_rotation_time"],
                "pulse_repetition_time_micro_s" : row["pulse_repetition_time_micro_s"]
            })

    if attr_dicts:
        db.bulk_insert_mappings(SignalAttribute, attr_dicts)
        db.commit()

    return {
    "status": "success",
    "filename": file.filename,
    "records_processed": len(final_df),
    "valid_signals_identified": int(final_df["pulse_width_smooth"].notna().sum()),
    }

    # data_objects = []
    # for _, row in final_df.iterrows():
    #     # 1. Create the Main Data Object (Always happens)
    #     signal_entry = SignalData(
    #         filename=file.filename,
    #         timestamp=row['timestamp'],
    #         amplitude=row['amplitude'],
    #         pulse_width=row['pulse_width']
    #     )
    #     # 2. Check if this is a "Valid Group" row
    #     # If pulse_width_smooth is present, it means it passed validation
    #     if row['pulse_width_smooth'] is not None:
    #         # Create the Attribute Object and link it
    #         signal_entry.attribute = SignalAttribute(
    #             pulse_width_smooth=row['pulse_width_smooth'],
    #             pulse_width_mode=row['pulse_width_mode'],
    #             group_timestamp=row['group_timestamp'],
    #             peak_time=row['peak_time'],
    #             est_radar_rotation_time=row['est_radar_rotation_time']
    #         )

    #     data_objects.append(signal_entry)
    # # return
    # db.add_all(data_objects)
    # db.commit()
    # return {
    #         "status": "success",
    #         "filename": file.filename,
    #         "records_processed": len(data_objects),
    #         "valid_signals_identified": len([d for d in data_objects if d.attribute is not None])
    #     }





@app.delete("/clear-all-data/", status_code=status.HTTP_200_OK)
async def clear_all_data(db: Session = Depends(get_db)):
    try:
        # Delete children first (SignalAttribute) then parent (SignalData)
        # to avoid Foreign Key constraint errors.
        db.query(SignalAttribute).delete()
        db.query(SignalData).delete()
        db.query(AISData).delete()
        
        db.commit()
        return {"message": "All sensor data, AIS data, and saved reports have been cleared."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")
    






SENSOR_RANGE_AREA = [
    (59.595574362762164, 10.599478202033964), 
    (59.57155601955038, 10.601453094501752), 
    (59.57063442476659, 10.662134057916324), 
    (59.59674128924907, 10.659840051737666)
]


@app.post("/upload-ais-data/")
async def upload_ais_data(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 1. Validation
    if not file.filename.endswith(('.txt', '.tsv', '.csv')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload a .tsv, .txt, or .csv file")

    # 2. Read file content
    content = await file.read()
    content_str = content.decode('utf-8')
    
    # 3. Detect format: CSV (with header) vs space-delimited
    first_line = content_str.strip().split('\n')[0].strip()
    is_csv_format = first_line.lower().startswith('reception_time,')

    # 4. Parse rows into a uniform list of (reception_time, mmsi, message_type, msg_dict)
    parsed_rows = []

    if is_csv_format:
        # New CSV format: reception_time,mmsi,message_type,message
        df_raw = pd.read_csv(io.StringIO(content_str))
        for _, row in df_raw.iterrows():
            try:
                reception_time = pd.to_datetime(row['reception_time'])
                mmsi = int(row['mmsi'])
                message_type = int(row['message_type'])
                msg = json.loads(row['message'])
                parsed_rows.append((reception_time, mmsi, message_type, msg))
            except (json.JSONDecodeError, ValueError, KeyError):
                continue  # Skip malformed rows
    else:
        # Legacy space-delimited format: timestamp mmsi message_type json_str
        for line in content_str.strip().split('\n'):
            if not line.strip():
                continue
            parts = line.split(' ', 3)
            if len(parts) < 4:
                continue  # Skip malformed lines
            
            timestamp_str, mmsi_str, message_type_str, json_str = parts
            
            try:
                msg = json.loads(json_str)
                reception_time = pd.to_datetime(timestamp_str)
                mmsi = int(mmsi_str)
                message_type = int(message_type_str)
                parsed_rows.append((reception_time, mmsi, message_type, msg))
            except (json.JSONDecodeError, ValueError):
                continue  # Skip lines with invalid data

    # 5. Process parsed rows & Check Location
    processed_records = []
    ais_db_entries = []

    for reception_time, mmsi, message_type, msg in parsed_rows:
        # Extract Coordinates safely
        lat = msg.get('latitude')
        lon = msg.get('longitude')
        
        # Check if ship is inside the sensor range
        in_zone = False
        if lat is not None and lon is not None:
            in_zone = is_point_in_polygon((lat, lon), SENSOR_RANGE_AREA)

        # A. Prepare Data for CSV (Flattened structure)
        record_dict = {
            "reception_time": reception_time,
            "mmsi": mmsi,
            "latitude": lat,
            "longitude": lon,
            "is_in_zone": in_zone,
            "speed_over_ground": msg.get('speedOverGround'),
            "course_over_ground": msg.get('courseOverGround'),
            "message_type": message_type
        }
        processed_records.append(record_dict)

        # B. Prepare Data for Database
        new_entry = AISData(
            reception_time=reception_time,
            mmsi=mmsi,
            reception_location=msg.get('stream'),  # Use 'stream' field from JSON
            message_type=message_type,
            latitude=lat,
            longitude=lon,
            speed_over_ground=msg.get('speedOverGround'),
            course_over_ground=msg.get('courseOverGround'),
            navigational_status=msg.get('navigationalStatus'),
            ais_class=msg.get('aisClass'),
            is_in_zone=in_zone,
            to_bow=msg.get('dimensionA'),
            to_stern=msg.get('dimensionB'),
            to_port=msg.get('dimensionC'),
            to_starboard=msg.get('dimensionD'),
            true_heading=msg.get('trueHeading'),
            ship_width = msg.get('shipWidth'),
            ship_length = msg.get('shipLength'),
            ship_name = msg.get('name')
        )
        ais_db_entries.append(new_entry)

    # 6. Save Processed Data to CSV
    processed_df = pd.DataFrame(processed_records)
    output_filename = f"processed_{file.filename}.csv"
    processed_df.to_csv(output_filename, index=False)
    print(f"Processed data with zone flags saved to: {output_filename}")

    # 7. Bulk insert to Database
    db.bulk_save_objects(ais_db_entries)
    db.commit()

    return {
        "status": "success",
        "filename": file.filename,
        "records_imported": len(ais_db_entries),
        "ships_in_zone": int(processed_df['is_in_zone'].sum()),
        "processed_file": output_filename
    }


@app.get("/get-ais-data/")
def get_ais_data(db: Session = Depends(get_db)):
    try:
        # Query all AIS data where is_in_zone is True
        query = db.query(AISData).filter(AISData.is_in_zone == True).all()

        if not query:
            return {
                "status": "success",
                "record_count": 0,
                "data": []
            }

        # Convert to dictionary format
        data = []
        for record in query:
            data.append({
                "id": record.id,
                "reception_time": record.reception_time.isoformat() if record.reception_time else None,
                "mmsi": record.mmsi,
                "reception_location": record.reception_location,
                "message_type": record.message_type,
                "latitude": record.latitude,
                "longitude": record.longitude,
                "speed_over_ground": record.speed_over_ground,
                "course_over_ground": record.course_over_ground,
                "navigational_status": record.navigational_status,
                "ais_class": record.ais_class,
                "is_in_zone": record.is_in_zone
            })

        return {
            "status": "success",
            "record_count": len(data),
            "data": data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving AIS data: {str(e)}")


@app.get("/get-ais-map-plot-data/")
def get_ais_map_plot_data(
    start_time: str = Query(..., description="Format: YYYY-MM-DD HH:MM:SS"), 
    end_time: str = Query(..., description="Format: YYYY-MM-DD HH:MM:SS"),
    db: Session = Depends(get_db)
):
    try:
        # Convert strings to datetime objects
        start_dt = pd.to_datetime(start_time)
        end_dt = pd.to_datetime(end_time)

        # Query AIS data where is_in_zone is True and within time range
        query = (
            db.query(AISData)
            .filter(AISData.reception_time >= start_dt)
            .filter(AISData.reception_time <= end_dt)
            .filter(AISData.message_type == 1)
            .order_by(AISData.mmsi, AISData.reception_time.asc())
            .all()
        )

        if not query:
            return {
                "status": "success and no records found",
                "time_range": f"{start_time} to {end_time}",
                "record_count": 0,
                "data": {}
            }

        # Convert to dictionary format and group by MMSI
        from collections import defaultdict
        grouped_data = defaultdict(list)
        
        for record in query:
            grouped_data[str(record.mmsi)].append({
                "reception_time": record.reception_time.astimezone().replace(tzinfo=None).isoformat(timespec='seconds') + 'Z' if record.reception_time else None,
                "mmsi": record.mmsi,
                "reception_location": record.reception_location,
                "message_type": record.message_type,
                "latitude": record.latitude,
                "longitude": record.longitude,
                "speed_over_ground": record.speed_over_ground,
                "course_over_ground": record.course_over_ground,
                "navigational_status": record.navigational_status,
                "ais_class": record.ais_class,
                "is_in_zone": record.is_in_zone,
                "true_heading": record.true_heading,
            })

        # Create an array of unique MMSIs
        unique_mmsis = list(grouped_data.keys())

                    # Collect one message_type 5 record for each unique MMSI, store separately
        mmsi_msg_type5_records = {}
        unique_mmsis = list(grouped_data.keys())
        for mmsi_key in unique_mmsis:
            type5_record = db.query(AISData).filter(
                AISData.mmsi == int(mmsi_key),
                AISData.message_type == 5
            ).first()
            if type5_record:
                mmsi_msg_type5_records[mmsi_key] = {
                    "ship_width": getattr(type5_record, "ship_width", None),
                    "ship_length": getattr(type5_record, "ship_length", None),
                    "ship_name": getattr(type5_record, "ship_name", None),
                }
        
        # Add ship info from mmsi_msg_type5_records to each record in grouped_data
        for mmsi_key, group in grouped_data.items():
            ship_info = mmsi_msg_type5_records.get(mmsi_key)
            if ship_info:
                    for rec in group:
                        rec['ship_name'] = ship_info.get('ship_name') if ship_info.get('ship_name') else None
                        rec['ship_length'] = ship_info.get('ship_length') if ship_info.get('ship_length') else None
                        rec['ship_width'] = ship_info.get('ship_width') if ship_info.get('ship_width') else None


        return {
            "status": "success",
            "time_range": f"{start_time} to {end_time}",
            "total_records": len(query),
            "unique_ships": len(grouped_data),
            "data": dict(grouped_data)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving AIS data: {str(e)}")


@app.get("/retrieve-radar-data/")
def retrieve_radar_data(
    start_time: str = Query(..., description="Format: YYYY-MM-DD HH:MM:SS"), 
    end_time: str = Query(..., description="Format: YYYY-MM-DD HH:MM:SS"),
    db: Session = Depends(get_db)
):
    try:
        # 1. Convert strings to datetime objects
        start_dt = pd.to_datetime(start_time)
        end_dt = pd.to_datetime(end_time)

        # --- QUERY 1: RADAR DATA ---
        query_radar = (
            db.query(
                SignalData.filename,
                SignalData.timestamp,
                SignalData.amplitude,
                SignalData.pulse_width,
                SignalAttribute.pulse_width_mode,
                SignalAttribute.est_radar_rotation_time
            )
            .outerjoin(SignalAttribute, SignalData.id == SignalAttribute.signal_id)
            .filter(SignalData.timestamp >= start_dt)
            .filter(SignalData.timestamp <= end_dt)
        )

        df_radar = pd.read_sql(query_radar.statement, db.bind)

        # Process Radar Data
        if not df_radar.empty:
            df_signals = df_radar[["filename", "timestamp", "amplitude", "pulse_width"]].copy()
            # Convert timestamps to ISO format for JSON serialization
            df_signals['timestamp'] = df_signals['timestamp'].apply(lambda ts: ts.isoformat())
            
            # Per SeaSentry pipeline: each unique pulse_width_mode = one distinct radar
            # Group by pulse_width_mode to get one row per radar with its attributes
            df_attr_valid = df_radar[["pulse_width_mode", "est_radar_rotation_time"]].dropna()
            if not df_attr_valid.empty:
                df_attributes = (
                    df_attr_valid.groupby("pulse_width_mode", as_index=False)
                    .agg({"est_radar_rotation_time": lambda x: x.mode().iloc[0] if not x.mode().empty else x.iloc[0]})
                )
            else:
                df_attributes = pd.DataFrame(columns=["pulse_width_mode", "est_radar_rotation_time"])
        else:
            df_signals = pd.DataFrame()
            df_attributes = pd.DataFrame()


        # --- QUERY 2: AIS DATA (New Logic) ---
        # Fetch MMSI and Location where is_in_zone is True within time limit
        query_ais = (
            db.query(AISData.mmsi, AISData.reception_location)
            .filter(AISData.reception_time >= start_dt)
            .filter(AISData.reception_time <= end_dt)
            .filter(AISData.is_in_zone == True) # Only ships inside the polygon
        )

        df_ais = pd.read_sql(query_ais.statement, db.bind)
        
        # Get unique combinations of MMSI and Location
        if not df_ais.empty:
            df_ais_unique = df_ais.drop_duplicates()
        else:
            df_ais_unique = pd.DataFrame(columns=["mmsi", "reception_location"])


        # --- RETURN COMBINED RESULT ---
        return {
            "status": "success",
            "time_range": f"{start_time} to {end_time}",
            
            # Radar Results
            "radar_signal_count": len(df_signals),
            "radar_unique_attributes": df_attributes.to_dict(orient="records"),
            "radar_signal_data": df_signals.to_dict(orient="records"),
            
            # AIS Results
            "ais_ships_in_zone_count": len(df_ais_unique),
            "ais_unique_ships": df_ais_unique.to_dict(orient="records")
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving data: {str(e)}")


@app.get("/get-sensor-data/")
def get_sensor_data(db: Session = Depends(get_db)):
    try:
        # Query the database for timestamps and amplitudes
        query = db.query(SignalData.timestamp, SignalData.amplitude).all()

        if not query:
            raise HTTPException(status_code=404, detail="No sensor data found")

        # Extract timestamps and amplitudes into separate arrays
        # Convert timestamps to strings for JSON serialization
        x = [record.timestamp.isoformat() for record in query]
        y = [record.amplitude for record in query]

        # Return the data as JSON
        return JSONResponse(content={"x": x, "y": y})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving sensor data: {str(e)}")

@app.get("/api/export-signals")
def export_signals_api(
    start_date: datetime, 
    end_date: datetime, 
    db: Session = Depends(get_db)
):
    """
    Endpoint to download signal data as a CSV based on time range.
    Uses Pandas to format the data.
    """
    
    # 1. Query the database
    # We use outerjoin to ensure we get signals even if they have no attributes
    query = db.query(SignalData, SignalAttribute).\
        outerjoin(SignalAttribute, SignalData.id == SignalAttribute.signal_id).\
        filter(SignalData.timestamp >= start_date).\
        filter(SignalData.timestamp <= end_date)

    # 2. Flatten the data into a list of dictionaries
    data = []
    
    # Iterate through results
    for signal, attr in query.all():
        row = {
            # From SignalData
            "id": signal.id,
            "filename": signal.filename,
            "timestamp": signal.timestamp,
            "amplitude": signal.amplitude,
            "pulse_width": signal.pulse_width,
            # Default Attributes to None
            "pw_smooth": None,
            "pw_mode": None,
            "group_timestamp": None,
            "peak_time": None,
            "radar_rotation": None
        }
        
        # If attribute exists, fill it in
        if attr:
            row.update({
                "pw_smooth": attr.pulse_width_smooth,
                "pw_mode": attr.pulse_width_mode,
                "group_timestamp": attr.group_timestamp,
                "peak_time": attr.peak_time,
                "radar_rotation": attr.est_radar_rotation_time,
                "pulse_repetition_time_micro_s" : attr.pulse_repetition_time_micro_s
            })
        
        data.append(row)

    # 3. Check if data exists
    if not data:
        raise HTTPException(status_code=404, detail="No data found for the given time range.")

    # 4. Convert to DataFrame
    df = pd.DataFrame(data)

    # 5. Write DataFrame to an in-memory buffer (not a file on disk)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    # Reset stream position to the beginning so it can be read
    stream.seek(0)

    # 6. Generate a dynamic filename
    filename = f"export_{start_date.strftime('%Y%m%d')}-{end_date.strftime('%Y%m%d')}.csv"

    # 7. Return the file as a download
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    
    return response


@app.get("/api/generate-report")
def generate_report(
    start_time: str = Query(..., description="Format: YYYY-MM-DD HH:MM:SS"),
    end_time: str = Query(..., description="Format: YYYY-MM-DD HH:MM:SS"),
    db: Session = Depends(get_db)
):
    """
    Generate a scenario analysis report combining AIS and MRD radar data.
    For each ship, finds the radar fingerprints that occurred during that ship's
    overlap time window so radars are associated per-ship.
    """
    try:
        start_dt = pd.to_datetime(start_time)
        end_dt = pd.to_datetime(end_time)

        # --- 1. RADAR DATA (MRD) — full time range, keep timestamps for per-ship matching ---
        query_radar = (
            db.query(
                SignalData.timestamp,
                SignalAttribute.pulse_width_mode,
                SignalAttribute.est_radar_rotation_time,
                SignalAttribute.pulse_repetition_time_micro_s,
            )
            .join(SignalAttribute, SignalData.id == SignalAttribute.signal_id)
            .filter(SignalData.timestamp >= start_dt)
            .filter(SignalData.timestamp <= end_dt)
            .filter(SignalAttribute.pulse_width_mode.isnot(None))
        )
        df_radar = pd.read_sql(query_radar.statement, db.bind)

        # Normalize radar timestamps to timezone-naive for consistent comparison
        if not df_radar.empty and df_radar["timestamp"].dt.tz is not None:
            df_radar["timestamp"] = df_radar["timestamp"].dt.tz_localize(None)

        # Total unique radars across entire timeframe (for the header)
        # Per the SeaSentry pipeline, each unique pulse_width_mode = one distinct radar
        total_unique_radars = 0
        if not df_radar.empty:
            total_unique_radars = int(df_radar["pulse_width_mode"].nunique())
            print(f"[DEBUG] Radar timestamp range: {df_radar['timestamp'].min()} to {df_radar['timestamp'].max()}")

        # --- 2. AIS DATA ---
        query_ais = (
            db.query(AISData)
            .filter(AISData.reception_time >= start_dt)
            .filter(AISData.reception_time <= end_dt)
            .order_by(AISData.mmsi, AISData.reception_time.asc())
            .all()
        )

        # Group AIS records by MMSI
        from collections import defaultdict
        ships_all = defaultdict(list)
        for record in query_ais:
            ships_all[str(record.mmsi)].append(record)

        # --- 3. Build per-ship report with time-matched radar fingerprints ---
        ship_reports = []
        for mmsi, records in ships_all.items():
            # Filter records where is_in_zone == True for overlap calculation
            in_zone_records = [r for r in records if r.is_in_zone]
            if not in_zone_records:
                continue

            # Overlap time: min and max reception_time of in-zone records
            in_zone_times = [r.reception_time for r in in_zone_records]
            overlap_start = min(in_zone_times)
            overlap_end = max(in_zone_times)

            # Normalize overlap times to timezone-naive for consistent comparison
            if hasattr(overlap_start, 'tzinfo') and overlap_start.tzinfo is not None:
                overlap_start = overlap_start.replace(tzinfo=None)
            if hasattr(overlap_end, 'tzinfo') and overlap_end.tzinfo is not None:
                overlap_end = overlap_end.replace(tzinfo=None)

            # Speed range from ALL records in the time window for this ship
            speeds = [r.speed_over_ground for r in records if r.speed_over_ground is not None]
            speed_min = round(min(speeds), 2) if speeds else None
            speed_max = round(max(speeds), 2) if speeds else None

            # Course range from ALL records
            courses = [r.course_over_ground for r in records if r.course_over_ground is not None]
            course_min = round(min(courses), 2) if courses else None
            course_max = round(max(courses), 2) if courses else None

            # --- Find radar fingerprints that overlap with this ship's time window ---
            # Per SeaSentry pipeline: unique pulse_width_mode = unique radar.
            # est_radar_rotation_time and pulse_repetition_time are attributes of that radar.
            ship_fingerprints = []
            if not df_radar.empty:
                print(f"[DEBUG] Ship {mmsi}: overlap_start={overlap_start}, overlap_end={overlap_end}")
                print(f"[DEBUG] Radar data points in range: {len(df_radar)}, timestamp dtype: {df_radar['timestamp'].dtype}")

                # Filter radar data to this ship's overlap window
                mask = (df_radar["timestamp"] >= overlap_start) & (df_radar["timestamp"] <= overlap_end)
                df_ship_radar = df_radar.loc[mask]
                print(f"[DEBUG] Ship {mmsi}: matched {len(df_ship_radar)} radar points in overlap window")

                if not df_ship_radar.empty:
                    # Group by pulse_width_mode (the radar identifier) and aggregate secondary attributes
                    for pw_mode, grp in df_ship_radar.groupby("pulse_width_mode"):
                        # Take the mode/most common rotation time and PRT for this radar
                        rot_vals = grp["est_radar_rotation_time"].dropna()
                        prt_vals = grp["pulse_repetition_time_micro_s"].dropna()

                        est_rotation = float(rot_vals.mode().iloc[0]) if not rot_vals.empty else None
                        est_prt = float(prt_vals.mode().iloc[0]) if not prt_vals.empty else None

                        ship_fingerprints.append({
                            "pulse_width_mode": float(pw_mode),
                            "est_radar_rotation_time": est_rotation,
                            "pulse_repetition_time_micro_s": est_prt,
                        })

            ship_reports.append({
                "mmsi": mmsi,
                "overlap_start": overlap_start.strftime("%H:%M") if overlap_start else None,
                "overlap_end": overlap_end.strftime("%H:%M") if overlap_end else None,
                "speed_min": speed_min,
                "speed_max": speed_max,
                "course_min": course_min,
                "course_max": course_max,
                "number_of_radars": len(ship_fingerprints),
                "fingerprints": ship_fingerprints,
                "length": None,
                "beam": None,
            })

            # Ship dimensions from message type 5
            type5_record = db.query(AISData).filter(
                AISData.mmsi == mmsi,
                AISData.message_type == 5,
                AISData.to_bow.isnot(None),
                AISData.to_stern.isnot(None),
            ).first()

            if type5_record:
                if type5_record.to_bow is not None and type5_record.to_stern is not None:
                    ship_reports[-1]["length"] = type5_record.to_bow + type5_record.to_stern
                if type5_record.to_port is not None and type5_record.to_starboard is not None:
                    ship_reports[-1]["beam"] = type5_record.to_port + type5_record.to_starboard

        number_of_ships = len(ship_reports)

        # --- 4. DATE EXTRACTION ---
        report_date = start_dt.strftime("%Y-%m-%d")
        report_start_time = start_dt.strftime("%H:%M")
        report_end_time = end_dt.strftime("%H:%M")

        return {
            "status": "success",
            "report": {
                "date": report_date,
                "start_time": report_start_time,
                "end_time": report_end_time,
                "number_of_ships": number_of_ships,
                "number_of_radars": total_unique_radars,
                "ships": ship_reports,
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


# ─── Pydantic models for save-report ───
class FingerprintIn(BaseModel):
    pulse_width_mode: Optional[float] = None
    est_radar_rotation_time: Optional[float] = None
    pulse_repetition_time_micro_s: Optional[float] = None

class ShipIn(BaseModel):
    mmsi: str
    overlap_start: Optional[str] = None
    overlap_end: Optional[str] = None
    speed_min: Optional[float] = None
    speed_max: Optional[float] = None
    course_min: Optional[float] = None
    course_max: Optional[float] = None
    number_of_radars: Optional[int] = None
    length: Optional[float] = None
    beam: Optional[float] = None
    fingerprints: List[FingerprintIn] = []

class ReportIn(BaseModel):
    date: str
    start_time: str
    end_time: str
    number_of_ships: Optional[int] = None
    number_of_radars: Optional[int] = None
    ships: List[ShipIn] = []


@app.post("/api/save-report")
def save_report(payload: ReportIn, db: Session = Depends(get_db)):
    """
    Save user-edited report data to the ship_fingerprints table.
    Each ship–fingerprint pair becomes one row.
    Ships with no fingerprints get one row with null fingerprint columns.
    """
    try:
        rows = []
        now = datetime.utcnow()

        for ship in payload.ships:
            base = {
                "report_date": payload.date,
                "report_start_time": payload.start_time,
                "report_end_time": payload.end_time,
                "mmsi": ship.mmsi,
                "overlap_start": ship.overlap_start,
                "overlap_end": ship.overlap_end,
                "speed_min": ship.speed_min,
                "speed_max": ship.speed_max,
                "course_min": ship.course_min,
                "course_max": ship.course_max,
                "length": ship.length,
                "beam": ship.beam,
                "created_at": now,
            }

            if ship.fingerprints:
                for fp in ship.fingerprints:
                    row = {**base,
                        "pulse_width_mode": fp.pulse_width_mode,
                        "est_radar_rotation_time": fp.est_radar_rotation_time,
                        "pulse_repetition_time_micro_s": fp.pulse_repetition_time_micro_s,
                    }
                    rows.append(row)
            else:
                rows.append(base)

        db.bulk_insert_mappings(ShipFingerprint, rows)
        db.commit()

        return {"status": "success", "rows_saved": len(rows)}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving report: {str(e)}")


@app.get("/api/saved-reports")
def get_saved_reports(db: Session = Depends(get_db)):
    """
    Retrieve all saved ship fingerprint records.
    """
    try:
        records = db.query(ShipFingerprint).order_by(ShipFingerprint.created_at.desc()).all()
        data = []
        for r in records:
            data.append({
                "id": r.id,
                "report_date": r.report_date,
                "report_start_time": r.report_start_time,
                "report_end_time": r.report_end_time,
                "mmsi": r.mmsi,
                "overlap_start": r.overlap_start,
                "overlap_end": r.overlap_end,
                "speed_min": r.speed_min,
                "speed_max": r.speed_max,
                "course_min": r.course_min,
                "course_max": r.course_max,
                "length": r.length,
                "beam": r.beam,
                "pulse_width_mode": r.pulse_width_mode,
                "est_radar_rotation_time": r.est_radar_rotation_time,
                "pulse_repetition_time_micro_s": r.pulse_repetition_time_micro_s,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
        return {"status": "success", "count": len(data), "data": data}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving saved reports: {str(e)}")
