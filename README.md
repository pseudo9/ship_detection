# 🛳️ SeaSentry

SeaSentry is a full-stack web platform for maritime surveillance in the Oslofjord region that fuses **Marine Radar Detector (MRD)** signal data with **Automatic Identification System (AIS)** vessel tracking data into a unified, real-time domain awareness system.

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19, TypeScript, Vite | UI framework and build tooling |
| **Mapping** | Leaflet, leaflet-timedimension | Interactive maps with time animation |
| **Charting** | Canvas API, Plotly, uPlot, Recharts | Signal visualization |
| **UI Kit** | Material UI (MUI) v7 | Component library |
| **State** | Zustand | Global state management |
| **Styling** | Tailwind CSS, inline styles | Responsive theming |
| **Backend** | FastAPI, Uvicorn | REST API server |
| **ORM** | SQLAlchemy 2.0 | Database abstraction |
| **Database** | TimescaleDB (PostgreSQL 16) | Time-series optimized storage |
| **Signal Processing** | NumPy, SciPy, scikit-learn, Pandas | Signal processing and analysis |
| **Container** | Docker Compose | Database deployment |

---

## 🚀 Getting Started

### Prerequisites

- **Docker** and **Docker Compose** (for TimescaleDB)
- **Python 3.11+** with `pip`
- **Node.js 18+** with `npm`

### 1. Database Setup (TimescaleDB)

```bash
cd backend_code
docker compose up -d
```

This starts a TimescaleDB container on port `5432` with:
- User: `postgres`
- Password: `postgres`
- Database: `sensor_data`

### 2. Backend Setup

```bash
cd backend_code

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate       # macOS/Linux
# venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.

> **Note:** AIS data must be uploaded **before** radar data for the same date. The radar processing pipeline cross-references AIS timestamps for temporal alignment.

### 3. Frontend Setup

```bash
cd frontend_code

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

> The frontend expects the backend at `http://localhost:8000`. Update `.env.local` (`VITE_API_BASE_URL`) if your backend is on a different host/port.

---



