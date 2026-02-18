from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import random
import webbrowser
import asyncio
from pathlib import Path
from typing import Dict, Union

app = FastAPI()

# --- 1. CORS SETTINGS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. PERSISTENT STATE ---
# We use a global state to keep track of the "drifting" values
state = {
    "hr": 72.0,
    "spo2": 98.0,
    "temp": 36.6,
    "max_hr_limit": 150 # Default limit
}

# --- 3. AUTO-LAUNCH DASHBOARD ---
@app.on_event("startup")
async def launch_dashboard():
    html_file = Path(__file__).parent / "index.html"
    await asyncio.sleep(1.5)
    if html_file.exists():
        webbrowser.open(f"file://{html_file.absolute()}")

# --- 4. ENDPOINTS ---

@app.get("/vitals")
async def get_vitals():
    """
    Generates realistic, smoothed health data using Random Walk.
    """
    global state
    
    # Smooth Drifting (Random Walk)
    # Heart rate drifts by +/- 2 BPM, clamped between 60 and 160
    state["hr"] = max(60, min(160, state["hr"] + random.uniform(-2, 2)))
    
    # SpO2 drifts slightly, clamped between 94 and 100
    state["spo2"] = max(94, min(100, state["spo2"] + random.uniform(-0.2, 0.2)))
    
    # Temp drifts by 0.1 increments
    state["temp"] = max(36.1, min(39.0, state["temp"] + random.uniform(-0.05, 0.05)))

    # AI Status Logic
    status = "Normal"
    if state["hr"] > state["max_hr_limit"]:
        status = f"CRITICAL: Heart Rate above {state['max_hr_limit']} BPM"
    elif state["hr"] > 100:
        status = "Alert: Tachycardia (Resting)"
    elif state["spo2"] < 95:
        status = "Warning: Low Oxygen Saturation"
    elif state["temp"] > 37.8:
        status = "Warning: Fever detected"

    return {
        "hr": round(state["hr"]),
        "spo2": round(state["spo2"], 1),
        "temp": round(state["temp"], 1),
        "status": status
    }

@app.post("/update_settings")
async def update_settings(config: Dict = Body(...)):
    """
    Endpoint to receive settings from your HTML page.
    """
    global state
    if "max_hr" in config:
        state["max_hr_limit"] = int(config["max_hr"])
        print(f"Backend updated: Max HR limit set to {state['max_hr_limit']}")
    return {"message": "Settings updated successfully"}

if __name__ == "__main__":
    print("VitalAI Backend running at http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)