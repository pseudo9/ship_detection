import os
from sqlalchemy import (
    Column, Integer, Float, DateTime, String, Boolean,
    create_engine, text, ForeignKeyConstraint, UniqueConstraint, Index
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/sensor_data",
)

Base = declarative_base()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class SignalData(Base):
    __tablename__ = "signal_data"

    # Composite PK (Timescale requirement)
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, primary_key=True, nullable=False)

    filename = Column(String, index=True, nullable=False)
    amplitude = Column(Float)
    pulse_width = Column(Float)

    attribute = relationship(
        "SignalAttribute",
        uselist=False,
        back_populates="signal",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_signal_data_timestamp", "timestamp"),  # non-unique index OK
    )


class SignalAttribute(Base):
    __tablename__ = "signal_attributes"

    id = Column(Integer, primary_key=True)

    # Composite reference to SignalData PK
    signal_id = Column(Integer, nullable=False)
    signal_timestamp = Column(DateTime, nullable=False)

    __table_args__ = (
        ForeignKeyConstraint(
            ["signal_id", "signal_timestamp"],
            ["signal_data.id", "signal_data.timestamp"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("signal_id", "signal_timestamp", name="uq_signal_attr_signal"),
    )

    pulse_width_smooth = Column(Float)
    pulse_width_mode = Column(Float)
    group_timestamp = Column(String, nullable=True)
    peak_time = Column(DateTime, nullable=True)
    est_radar_rotation_time = Column(Float, nullable=True)
    pulse_repetition_time_micro_s =  Column(Integer, nullable=True)
    signal = relationship("SignalData", back_populates="attribute")


class AISData(Base):
    __tablename__ = "ais_data"

    # Composite PK (Timescale requirement)
    id = Column(Integer, primary_key=True, autoincrement=True)
    reception_time = Column(DateTime, primary_key=True, nullable=False)

    mmsi = Column(Integer, index=True)
    reception_location = Column(String)
    message_type = Column(Integer)

    latitude = Column(Float)
    longitude = Column(Float)
    speed_over_ground = Column(Float)
    course_over_ground = Column(Float)
    navigational_status = Column(Integer)
    ais_class = Column(String)
    is_in_zone = Column(Boolean, default=False, nullable=False)
    true_heading = Column(Integer, nullable=True)

    # Ship dimensions from AIS message type 5
    to_bow = Column(Integer, nullable=True)
    to_stern = Column(Integer, nullable=True)
    to_port = Column(Integer, nullable=True)
    to_starboard = Column(Integer, nullable=True)

    # Ship width, length and name from AIS message type 5
    ship_width = Column(Integer, nullable=True)
    ship_length = Column(Integer, nullable=True)
    ship_name = Column(String, nullable=True)


class ShipFingerprint(Base):
    __tablename__ = "ship_fingerprints"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Report context
    report_date = Column(String, nullable=False)
    report_start_time = Column(String, nullable=False)
    report_end_time = Column(String, nullable=False)

    # Ship details (user-editable)
    mmsi = Column(String, nullable=False)
    overlap_start = Column(String, nullable=True)
    overlap_end = Column(String, nullable=True)
    speed_min = Column(Float, nullable=True)
    speed_max = Column(Float, nullable=True)
    course_min = Column(Float, nullable=True)
    course_max = Column(Float, nullable=True)
    length = Column(Float, nullable=True)
    beam = Column(Float, nullable=True)

    # Radar fingerprint (user-editable)
    pulse_width_mode = Column(Float, nullable=True)
    est_radar_rotation_time = Column(Float, nullable=True)
    pulse_repetition_time_micro_s = Column(Float, nullable=True)

    created_at = Column(DateTime, nullable=False)


def init_db(drop = False) -> None:
    # Create tables fresh
    if drop:
        Base.metadata.drop_all(bind=engine)
        print("🗑️  Tables dropped.")

    Base.metadata.create_all(bind=engine)
    print("🆕 Tables created.")

    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb;"))
        conn.execute(text("SELECT create_hypertable('signal_data', 'timestamp', if_not_exists => TRUE);"))
        conn.execute(text("SELECT create_hypertable('ais_data', 'reception_time', if_not_exists => TRUE);"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db(drop = True)
    print("✅ OK")
