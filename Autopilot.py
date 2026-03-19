"""
autopilot.py – Echtzeit-Phasenerkennung + LedFX Steuerung
===========================================================
Nutzt phase_classifier.pkl + scaler.pkl direkt für Echtzeit-Inferenz
über ein USB-Audiogerät. Kein librosa, kein test_model.py.

Zustände:
  idle     – Autopilot inaktiv, LedFX wird nicht verändert
  running  – Echtzeit-Analyse läuft, LedFX wird gesteuert

REST-Endpunkte (für das Frontend):
  GET  /status   – aktueller Zustand + letzte Phase
  POST /start    – Autopilot starten
  POST /stop     – Autopilot stoppen (→ idle)
  GET  /devices  – verfügbare Audio-Input-Geräte
  GET  /config   – aktuelle Konfiguration
  POST /config   – Konfiguration zur Laufzeit ändern (nur im idle)

Abhängigkeiten:
  pip install fastapi uvicorn sounddevice numpy scikit-learn joblib requests
"""

import os
import sys
import json
import time
import threading
import argparse
from collections import deque
from datetime import datetime

import numpy as np
import sounddevice as sd
import joblib
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn


# ─────────────────────────────────────────────
# Konstanten – müssen mit train_model.py übereinstimmen
# ─────────────────────────────────────────────
SAMPLE_RATE   = 22050
FRAME_MS      = 100
FRAME_SAMPLES = int(SAMPLE_RATE * FRAME_MS / 1000)

FEATURES = [
    "rms", "bass", "mid", "high",
    "bass_ratio", "onset", "energy_slope", "spectral_centroid",
]
WINDOW = 5   # muss mit WINDOW aus train_model.py übereinstimmen

BASS_LOW,  BASS_HIGH = 20,   250
MID_LOW,   MID_HIGH  = 250,  4000
HIGH_LOW             = 4000


# ─────────────────────────────────────────────
# Feature-Extraktion (identisch zu test_model.py)
# ─────────────────────────────────────────────
def extract_features(chunk: np.ndarray, rms_history: deque) -> list:
    rms = float(np.sqrt(np.mean(chunk ** 2)))

    fft_mag = np.abs(np.fft.rfft(chunk, n=FRAME_SAMPLES))
    freqs   = np.fft.rfftfreq(FRAME_SAMPLES, d=1.0 / SAMPLE_RATE)

    bass_mask = (freqs >= BASS_LOW) & (freqs < BASS_HIGH)
    mid_mask  = (freqs >= MID_LOW)  & (freqs < MID_HIGH)
    high_mask = (freqs >= HIGH_LOW)

    bass = float(np.mean(fft_mag[bass_mask])) if np.any(bass_mask) else 0.0
    mid  = float(np.mean(fft_mag[mid_mask]))  if np.any(mid_mask)  else 0.0
    high = float(np.mean(fft_mag[high_mask])) if np.any(high_mask) else 0.0

    total_energy      = bass + mid + high + 1e-9
    bass_ratio        = bass / total_energy
    spectral_centroid = float(np.sum(freqs * fft_mag) / (np.sum(fft_mag) + 1e-9))
    onset             = float(max(rms - rms_history[-1], 0.0)) if rms_history else 0.0

    if len(rms_history) >= 2:
        arr   = np.array(list(rms_history))
        slope = float(np.polyfit(np.arange(len(arr), dtype=float), arr, 1)[0])
    else:
        slope = 0.0

    return [rms, bass, mid, high, bass_ratio, onset, slope, spectral_centroid]


def build_input_vector(feature_history: deque) -> np.ndarray:
    current  = list(feature_history)[-1]
    lags     = list(feature_history)[:-1][::-1]
    while len(lags) < WINDOW:
        lags.append([0.0] * len(FEATURES))
    lag_flat = [v for lag in lags[:WINDOW] for v in lag]
    return np.array([current + lag_flat], dtype=np.float32)


# ─────────────────────────────────────────────
# Config laden
# ─────────────────────────────────────────────
DEFAULT_CONFIG_PATH = "config.json"

def load_config(path: str) -> dict:
    if not os.path.isfile(path):
        print(f"Fehler: config.json nicht gefunden: {path}")
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ─────────────────────────────────────────────
# Erstes USB-Audio-Input-Device finden
# ─────────────────────────────────────────────
def find_usb_device() -> int:
    for i, dev in enumerate(sd.query_devices()):
        if "usb" in dev["name"].lower() and dev["max_input_channels"] > 0:
            print(f"  USB-Device gefunden: [{i}] {dev['name']}")
            return i
    fallback = sd.default.device[0]
    print(f"  Kein USB-Device gefunden – Fallback: [{fallback}] {sd.query_devices(fallback)['name']}")
    return fallback


# ─────────────────────────────────────────────
# LedFX – Effect per PUT setzen
# ─────────────────────────────────────────────
def ledfx_set_phase(phase: str, cfg: dict):
    ledfx     = cfg["ledfx"]
    base_url  = ledfx["base_url"].rstrip("/")
    virtual   = ledfx["virtual_id"]
    phase_cfg = ledfx["phases"].get(phase)

    if phase_cfg is None:
        return

    effect_type = phase_cfg.get("type", "")

    if effect_type == "off":
        try:
            requests.delete(
                f"{base_url}/api/virtuals/{virtual}/effects",
                timeout=1,
            )
        except Exception as e:
            print(f"  [LedFX] DELETE Fehler: {e}")
        return

    try:
        r = requests.put(
            f"{base_url}/api/virtuals/{virtual}/effects",
            json={
                "type":   effect_type,
                "config": phase_cfg.get("config", {}),
            },
            timeout=1,
        )
        if r.status_code not in (200, 201):
            print(f"  [LedFX] {r.status_code}: {r.text[:80]}")
    except Exception as e:
        print(f"  [LedFX] Verbindungsfehler: {e}")


# ─────────────────────────────────────────────
# Shared State
# ─────────────────────────────────────────────
class AutopilotState:
    def __init__(self):
        self.lock          = threading.Lock()
        self.running       = False
        self.current_phase = None
        self.last_switch   = None
        self.frame_count   = 0
        self.switch_count  = 0
        self.started_at    = None
        self.stop_event    = threading.Event()
        self.thread        = None

    def to_dict(self) -> dict:
        with self.lock:
            return {
                "state":         "running" if self.running else "idle",
                "current_phase": self.current_phase,
                "last_switch":   self.last_switch,
                "frame_count":   self.frame_count,
                "switch_count":  self.switch_count,
                "uptime_s":      round(time.time() - self.started_at, 1)
                                 if self.started_at else None,
            }


STATE  = AutopilotState()
CFG    = {}
MODEL  = None
SCALER = None


# ─────────────────────────────────────────────
# Echtzeit Inference-Loop (läuft in eigenem Thread)
# ─────────────────────────────────────────────
def inference_loop(cfg: dict, model, scaler, state: AutopilotState):
    vote_window = cfg["smoothing"]["vote_window"]
    cooldown    = cfg["smoothing"]["cooldown_frames"]
    conf_min    = cfg["smoothing"]["confidence_min"]

    device_idx = find_usb_device()

    rms_history     = deque(maxlen=WINDOW)
    feature_history = deque(maxlen=WINDOW + 1)
    vote_buffer     = deque(maxlen=vote_window)
    current_phase   = None
    frames_since    = 0
    frame_i         = 0

    print(f"\n[Autopilot] Gestartet – Device [{device_idx}]  "
          f"vote_window={vote_window}  cooldown={cooldown}  conf>={conf_min}")

    try:
        with sd.InputStream(
            device=device_idx,
            channels=1,
            samplerate=SAMPLE_RATE,
            blocksize=FRAME_SAMPLES,
            dtype="float32",
        ) as stream:

            while not state.stop_event.is_set():
                chunk, _ = stream.read(FRAME_SAMPLES)
                chunk    = chunk[:, 0]  # stereo → mono

                feats = extract_features(chunk, rms_history)
                rms_history.append(feats[0])
                feature_history.append(feats)
                frame_i      += 1
                frames_since += 1

                with state.lock:
                    state.frame_count = frame_i

                # Warmup: warten bis genug History da ist
                if frame_i < WINDOW:
                    continue

                # Prediction
                x         = build_input_vector(feature_history)
                x         = scaler.transform(x)
                raw_phase = model.predict(x)[0]

                # Smoothing via Mehrheitsvote
                vote_buffer.append(raw_phase)
                votes      = list(vote_buffer)
                winner     = max(set(votes), key=votes.count)
                confidence = votes.count(winner) / len(votes)

                # Phasenwechsel nur bei: Cooldown + Konfidenz erreicht
                if (winner != current_phase
                        and frames_since >= cooldown
                        and confidence >= conf_min):

                    current_phase = winner
                    frames_since  = 0
                    ts            = datetime.now().strftime("%H:%M:%S")

                    print(f"  [{ts}] → {winner:<12} conf:{confidence:.0%}  "
                          f"rms:{feats[0]:.3f}  bass_ratio:{feats[4]:.2f}")

                    ledfx_set_phase(winner, cfg)

                    with state.lock:
                        state.current_phase = winner
                        state.last_switch   = ts
                        state.switch_count += 1

    except Exception as e:
        print(f"[Autopilot] Fehler im Loop: {e}")
    finally:
        with state.lock:
            state.running       = False
            state.current_phase = None
            state.started_at    = None
        print("[Autopilot] Gestoppt.")


# ─────────────────────────────────────────────
# FastAPI Server
# ─────────────────────────────────────────────
app = FastAPI(title="Autopilot", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/status")
def get_status():
    return STATE.to_dict()


@app.post("/start")
def start_autopilot():
    with STATE.lock:
        if STATE.running:
            raise HTTPException(409, "Autopilot läuft bereits.")
        STATE.running      = True
        STATE.started_at   = time.time()
        STATE.frame_count  = 0
        STATE.switch_count = 0
        STATE.stop_event.clear()

    STATE.thread = threading.Thread(
        target=inference_loop,
        args=(CFG, MODEL, SCALER, STATE),
        daemon=True,
    )
    STATE.thread.start()
    return {"status": "started"}


@app.post("/stop")
def stop_autopilot():
    with STATE.lock:
        if not STATE.running:
            raise HTTPException(409, "Autopilot läuft nicht.")
    STATE.stop_event.set()
    STATE.thread.join(timeout=5)
    with STATE.lock:
        STATE.running       = False
        STATE.current_phase = None
        STATE.started_at    = None
    return {"status": "stopped"}


@app.get("/devices")
def list_devices():
    return {
        "input_devices": [
            {
                "index":    i,
                "name":     d["name"],
                "channels": d["max_input_channels"],
                "is_usb":   "usb" in d["name"].lower(),
            }
            for i, d in enumerate(sd.query_devices())
            if d["max_input_channels"] > 0
        ]
    }


@app.get("/config")
def get_config():
    return CFG


class ConfigPatch(BaseModel):
    data: dict

@app.post("/config")
def update_config(patch: ConfigPatch):
    with STATE.lock:
        if STATE.running:
            raise HTTPException(409, "Erst /stop aufrufen bevor Config geändert wird.")
    CFG.update(patch.data)
    return {"status": "updated", "config": CFG}


# ─────────────────────────────────────────────
# Startup
# ─────────────────────────────────────────────
def main():
    global CFG, MODEL, SCALER

    parser = argparse.ArgumentParser(description="Autopilot – LedFX Echtzeit-Steuerung")
    parser.add_argument("--config", default=DEFAULT_CONFIG_PATH,
                        help="Pfad zur config.json (default: ./config.json)")
    args = parser.parse_args()

    CFG = load_config(args.config)

    model_dir   = CFG["model_dir"]
    model_path  = os.path.join(model_dir, "phase_classifier.pkl")
    scaler_path = os.path.join(model_dir, "scaler.pkl")

    if not os.path.isfile(model_path):
        print(f"Fehler: {model_path} nicht gefunden.")
        sys.exit(1)

    MODEL  = joblib.load(model_path)
    SCALER = joblib.load(scaler_path)

    print("=" * 55)
    print("  Autopilot – LedFX Echtzeit-Steuerung")
    print("=" * 55)
    print(f"  Modell  : {model_path}")
    print(f"  LedFX   : {CFG['ledfx']['base_url']}  →  virtual: {CFG['ledfx']['virtual_id']}")
    print(f"  Phasen  : {list(CFG['ledfx']['phases'].keys())}")
    print("\n  Verfügbare Input-Devices:")
    for i, d in enumerate(sd.query_devices()):
        if d["max_input_channels"] > 0:
            tag = "  ◀ USB" if "usb" in d["name"].lower() else ""
            print(f"    [{i}] {d['name']}{tag}")

    host = CFG["server"]["host"]
    port = CFG["server"]["port"]
    print(f"\n  Server  : http://{host}:{port}")
    print(f"  Docs    : http://localhost:{port}/docs")
    print("=" * 55 + "\n")

    uvicorn.run(app, host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()