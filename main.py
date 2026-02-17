from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import random
import webbrowser
import asyncio
from pathlib import Path
from typing import Dict, Union

app = FastAPI()

# --- 1. CORS SETTINGS ---
# Essential for allowing your HTML file to talk to this Python server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. DATA STORAGE ---
# This dictionary holds the latest "state" of your health monitor
latest_vitals: Dict[str, Union[int, float, str]] = {
    "hr": 75,
    "spo2": 98,
    "temp": 36.6,
    "status": "System Initializing..."
}

# --- 3. AUTO-LAUNCH DASHBOARD ---
# This function triggers when the server starts
@app.on_event("startup")
async def launch_dashboard():
    # Finds 'index.html' in the same folder as this script
    html_file = Path(__file__).parent / "index.html"
    
    # Wait 1 second to ensure the server is fully ready
    await asyncio.sleep(1)
    
    # Check if the file exists before trying to open it
    if html_file.exists():
        print(f"Opening Dashboard: {html_file.absolute()}")
        webbrowser.open(f"file://{html_file.absolute()}")
    else:
        print("Warning: index.html not found in the current directory.")

# --- 4. ENDPOINTS ---

@app.get("/")
async def root():
    """Home route to verify the server is alive."""
    return {
        "message": "Health Monitor API is Online", 
        "endpoints": {"data": "/vitals", "docs": "/docs"}
    }

@app.get("/vitals")
async def get_vitals():
    """
    This is the heart of the backend. 
    It simulates data and applies basic AI logic.
    """
    global latest_vitals
    
    # Simulate reading from sensors (Later replaced by real IoT data)
    hr = random.randint(70, 95)
    spo2 = random.randint(96, 100)
    temp = round(random.uniform(36.4, 37.2), 1)

    # Basic AI Logic / Thresholding
    status = "Normal"
    if hr > 90:
        status = "Elevated Heart Rate Detected"
    elif spo2 < 95:
        status = "Low Oxygen Levels"
    elif temp > 37.5:
        status = "High Temperature Warning"

    # Update our storage
    latest_vitals = {
        "hr": hr,
        "spo2": spo2,
        "temp": temp,
        "status": status
    }
    
    return latest_vitals

# --- 5. EXECUTION ---
if __name__ == "__main__":
    # Start the server on localhost port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)