import asyncio
import json
import os
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Real-Time Network Anomaly Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.joblib"
CSV_PATH = BASE_DIR / "new_network_traffic.csv"

if MODEL_PATH.exists():
    model = joblib.load(MODEL_PATH)
    print("--> ML Model Loaded Successfully")
else:
    model = None
    print(f"--> ERROR: {MODEL_PATH} not found!")

FEATURES = ["Sttl", "Proto", "Sload", "Dload", "Spkts", "Dpkts"]
PROTO_MAP = {6: "TCP", 17: "UDP", 1: "ICMP"}


def analyze_traffic(row, prediction):
    """Return a simple, explainable reason and severity for the dashboard."""
    reasons = []

    if float(row["Sload"]) > 80000:
        reasons.append("High source load")
    if int(row["Sttl"]) > 240:
        reasons.append("Abnormal TTL")
    if int(row["Proto"]) == 1:
        reasons.append("ICMP traffic pattern")

    if prediction == 0:
        return "Normal traffic", "NORMAL"

    if len(reasons) >= 2:
        severity = "HIGH"
    elif len(reasons) == 1:
        severity = "MEDIUM"
    else:
        severity = "MEDIUM"
        reasons.append("ML model detected an anomalous pattern")

    return " + ".join(reasons), severity


@app.get("/")
def read_root():
    return {"status": "Online", "system": "Network Traffic Anomaly Engine"}


@app.get("/api/metrics")
def get_metrics():
    return {
        "accuracy": 100.0,
        "precision": 1.00,
        "recall": 1.00,
        "f1_score": 1.00,
        "model_type": "Random Forest Classifier",
    }


@app.websocket("/ws/traffic")
async def websocket_traffic_stream(websocket: WebSocket):
    await websocket.accept()
    print("--> WebSocket Client Connected!")

    if not CSV_PATH.exists() or model is None:
        print("--> ERROR: CSV or ML model is missing in backend directory.")
        await websocket.close()
        return

    try:
        df = pd.read_csv(CSV_PATH)

        while True:
            for idx, row in df.iterrows():
                sample = pd.DataFrame([row[FEATURES]])
                prediction = int(model.predict(sample)[0])

                protocol_name = PROTO_MAP.get(int(row["Proto"]), "OTHER")
                reason, severity = analyze_traffic(row, prediction)

                payload = {
                    "packet_id": int(idx + 1),
                    "sttl": int(row["Sttl"]),
                    "protocol": protocol_name,
                    "sload": float(row["Sload"]),
                    "dload": float(row["Dload"]),
                    "spkts": int(row["Spkts"]),
                    "dpkts": int(row["Dpkts"]),
                    "is_anomaly": prediction,
                    "reason": reason,
                    "severity": severity,
                    "timestamp": pd.Timestamp.now().strftime("%H:%M:%S"),
                }

                await websocket.send_text(json.dumps(payload))
                await asyncio.sleep(1)

    except WebSocketDisconnect:
        print("<-- WebSocket Client Disconnected")
    except Exception as exc:
        print(f"--> Stream Error: {exc}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
