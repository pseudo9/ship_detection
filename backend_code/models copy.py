# CHANGE 1: Added 'String' to the imports
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, create_engine, String, JSON, Boolean
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = "sqlite:///./sensor_data.db" 

Base = declarative_base()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class SignalData(Base):
    __tablename__ = "signal_data"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True) 
    timestamp = Column(DateTime, index=True)
    amplitude = Column(Float)
    pulse_width = Column(Float)

    # Relationship: One SignalData can have One (optional) Attribute
    # uselist=False makes it a 1-to-1 relationship
    # cascade="all, delete-orphan" ensures if you delete the data, the attribute goes too
    attribute = relationship("SignalAttribute", uselist=False, back_populates="signal", cascade="all, delete-orphan")

class SignalAttribute(Base):
    __tablename__ = "signal_attributes"

    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Key points BACK to the SignalData table
    signal_id = Column(Integer, ForeignKey("signal_data.id"), unique=True, nullable=False)
    
    # Calculated Attributes
    pulse_width_smooth = Column(Float)
    pulse_width_mode = Column(Float)
    group_timestamp = Column(String, nullable=True)
    peak_time = Column(DateTime, nullable=True)
    est_radar_rotation_time = Column(Float, nullable=True)

    # Back Link
    signal = relationship("SignalData", back_populates="attribute")


class AISData(Base):
    __tablename__ = "ais_data"
    
    id = Column(Integer, primary_key=True, index=True)
    reception_time = Column(DateTime)
    mmsi = Column(Integer, index=True)
    reception_location = Column(String)
    message_type = Column(Integer)
    
    
    # Extracted from JSON 'message' column
    latitude = Column(Float)
    longitude = Column(Float)
    speed_over_ground = Column(Float)
    course_over_ground = Column(Float)
    navigational_status = Column(Integer)
    ais_class = Column(String)
    is_in_zone = Column(Boolean, default=False)

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()