"""
autopilot.py – Echtzeit-Phasenerkennung + LedFX Steuerung
===========================================================
Nutzt phase_classifier.pkl + scaler.pkl direkt für Echtzeit-Inferenz
über ein USB-Audiogerät. Kein librosa, kein test_model.py.

Phasen: silence | buildup | hardbass

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
import random
import threading
import argparse
from collections import deque
import queue
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
# Feature-Extraktion
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
    # Identisch zu test_model.py – time-first, exakt wie das Modell trainiert wurde
    current = list(feature_history)[-1]
    lags    = list(feature_history)[:-1][::-1]
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
# Audio-Input-Device auswählen
#
# config.json: "audio_source" kann sein:
#   "usb"        – erstes USB-Input-Device (Mikrofon/Interface)
#   "system"     – Systemsound / Loopback (z.B. was im Browser spielt)
#                  Sucht nach "stereo mix", "wave out mix", "loopback",
#                  "wasapi" oder "what u hear" (Windows-typisch)
#   "device_index: 3"  – direkt per Index (aus GET /devices)
#   "default"    – sounddevice Standard-Input
# ─────────────────────────────────────────────
def find_audio_device(cfg: dict) -> int:
    source = cfg.get("audio", {}).get("source", "usb").lower()

    # Direkt per Index
    if source.startswith("device_index:"):
        idx = int(source.split(":")[1].strip())
        print(f"  Audio-Device (manuell): [{idx}] {sd.query_devices(idx)['name']}")
        return idx

    # Standard-Input
    if source == "default":
        idx = sd.default.device[0]
        print(f"  Audio-Device (default): [{idx}] {sd.query_devices(idx)['name']}")
        return idx

    # Systemsound / Loopback
    if source == "system":
        # Erkennt: VB-Cable, Stereo Mix, WASAPI-Loopback
        keywords = [
            "cable output", "vb-audio", "vb audio",
            "stereo mix", "wave out", "what u hear",
            "loopback", "wasapi",
            "sonar - stream", "sonar - game", "sonar - chat",
        ]
        for i, dev in enumerate(sd.query_devices()):
            name_lower = dev["name"].lower()
            if dev["max_input_channels"] > 0 and any(kw in name_lower for kw in keywords):
                print(f"  Audio-Device (system loopback): [{i}] {dev['name']}")
                return i
        print("  ⚠ Kein Loopback-Device gefunden!")
        print("    Verfügbare Input-Devices (GET /devices für vollständige Liste):")
        for i, dev in enumerate(sd.query_devices()):
            if dev["max_input_channels"] > 0:
                print(f"    [{i}] {dev['name']}")
        print("    Tipp 1: Stereo Mix in Windows Soundeinstellungen aktivieren")
        print("    Tipp 2: VB-Cable installieren: https://vb-audio.com/Cable/")
        print("    Tipp 3: In config.json setzen: audio.source = 'device_index: X'")
        fallback = sd.default.device[0]
        print(f"  Fallback auf Default: [{fallback}] {sd.query_devices(fallback)['name']}")
        return fallback

    # USB (default)
    for i, dev in enumerate(sd.query_devices()):
        if "usb" in dev["name"].lower() and dev["max_input_channels"] > 0:
            print(f"  Audio-Device (USB): [{i}] {dev['name']}")
            return i
    fallback = sd.default.device[0]
    print(f"  Kein USB-Device gefunden – Fallback: [{fallback}] {sd.query_devices(fallback)['name']}")
    return fallback


# ─────────────────────────────────────────────
# LedFX – zufällige Scene pro Phase aktivieren
#
# config.json Struktur pro Phase:
#   "silence":  { "scenes": ["scene_id_1", "scene_id_2"] }
#   "buildup":  { "scenes": ["scene_id_3", "scene_id_4"] }
#   "hardbass": { "scenes": ["scene_id_5", "scene_id_6"] }
#
# → Eine zufällige ID aus der Liste wird per PUT aktiviert:
#   PUT /api/scenes  { "id": "<scene_id>", "action": "activate" }
# ─────────────────────────────────────────────
# ─────────────────────────────────────────────
# LedFX HTTP-Worker – dauerhaft laufender Thread
# Vermeidet Thread-Start-Overhead bei jedem Phasenwechsel
# ─────────────────────────────────────────────
_ledfx_queue: queue.Queue = queue.Queue()

def _ledfx_worker():
    """Läuft dauerhaft, wartet auf Jobs in der Queue und feuert sofort."""
    session = requests.Session()  # Session wiederverwenden = schneller
    while True:
        job = _ledfx_queue.get()
        if job is None:  # Shutdown-Signal
            break
        base_url, scene_id, phase = job
        try:
            r = session.put(
                f"{base_url}/api/scenes",
                json={"id": scene_id, "action": "activate"},
                timeout=2,
            )
            if r.status_code in (200, 201):
                print(f"  [LedFX] ✓ scene aktiviert → phase={phase}  id={scene_id}")
            else:
                print(f"  [LedFX] {r.status_code}: {r.text[:120]}")
        except Exception as e:
            print(f"  [LedFX] Verbindungsfehler: {e}")
        finally:
            _ledfx_queue.task_done()

# Worker-Thread beim Import starten
_ledfx_worker_thread = threading.Thread(target=_ledfx_worker, daemon=True)
_ledfx_worker_thread.start()


def ledfx_set_phase(phase: str, cfg: dict):
    base_url  = cfg["ledfx"]["base_url"].rstrip("/")
    phase_cfg = cfg["ledfx"]["phases"].get(phase)

    if phase_cfg is None:
        print(f"  [LedFX] Phase '{phase}' nicht in config.json – übersprungen.")
        return

    scenes = phase_cfg.get("scenes", [])

    if not scenes:
        print(f"  [LedFX] Phase '{phase}': keine scenes definiert – übersprungen.")
        return

    scene_id = random.choice(scenes)

    # Nur in Queue einreihen – Worker feuert sofort, kein Thread-Start-Overhead
    _ledfx_queue.put((base_url, scene_id, phase))


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

    device_idx = find_audio_device(cfg)

    rms_history     = deque(maxlen=WINDOW)
    feature_history = deque(maxlen=WINDOW + 1)
    vote_buffer     = deque(maxlen=vote_window)
    current_phase   = None
    frames_since    = 0
    frame_i         = 0

    print(f"\n[Autopilot] Gestartet – Device [{device_idx}]  "
          f"vote_window={vote_window}  cooldown={cooldown}  conf>={conf_min}")

    try:
        # WASAPI erzwingen – nötig für Loopback-Devices auf Windows
        # (WDM-KS unterstützt keine Blocking API)
        try:
            wasapi_info = sd.query_hostapis(sd.query_devices(device_idx)["hostapi"])
            hostapi_idx = sd.query_devices(device_idx)["hostapi"]
        except Exception:
            hostapi_idx = None

        # Native Samplerate des Devices ermitteln
        dev_info      = sd.query_devices(device_idx)
        native_sr     = int(dev_info["default_samplerate"])
        capture_block = int(native_sr * FRAME_MS / 1000)
        max_ch        = dev_info["max_input_channels"]
        channels      = min(2, max_ch)

        # resample_poly braucht ganzzahlige up/down Faktoren
        # 48000→22050: up=147, down=320  (ggT=1)  – vorberechnet, nicht pro Frame
        from math import gcd
        from scipy.signal import resample_poly
        _gcd  = gcd(native_sr, SAMPLE_RATE)
        rs_up = SAMPLE_RATE  // _gcd
        rs_dn = native_sr    // _gcd
        need_resample = (native_sr != SAMPLE_RATE)

        print(f"  [Audio] Device native SR: {native_sr} Hz  "
              f"→ resample_poly {rs_up}/{rs_dn} auf {SAMPLE_RATE} Hz")

        stream_kwargs = dict(
            device=device_idx,
            channels=channels,
            samplerate=native_sr,
            blocksize=capture_block,
            dtype="float32",
        )

        with sd.InputStream(**stream_kwargs) as stream:

            while not state.stop_event.is_set():
                chunk, _ = stream.read(capture_block)
                # Stereo → Mono
                chunk = chunk.mean(axis=1) if chunk.ndim > 1 else chunk.flatten()
                # Resampling – resample_poly ist sehr schnell (FIR-Filter)
                if need_resample:
                    chunk = resample_poly(chunk, rs_up, rs_dn)
                # Auf exakte FRAME_SAMPLES Länge bringen
                if len(chunk) > FRAME_SAMPLES:
                    chunk = chunk[:FRAME_SAMPLES]
                elif len(chunk) < FRAME_SAMPLES:
                    chunk = np.pad(chunk, (0, FRAME_SAMPLES - len(chunk)))

                # Normalisierung: chunk auf librosa-kompatiblen Pegel skalieren
                # librosa normalisiert intern auf peak ~1.0, sounddevice nicht
                # → wir skalieren auf einen fixen RMS-Zielwert damit der Scaler
                #   dieselben Feature-Größenordnungen wie beim Training sieht
                gain = cfg.get("audio", {}).get("gain", 1.0)
                if gain != 1.0:
                    chunk = chunk * gain
                # Peak-Normalisierung: skaliert auf peak=1.0 wie librosa
                if cfg.get("audio", {}).get("normalize", True):
                    peak = np.max(np.abs(chunk))
                    if peak > 0.001:
                        chunk = chunk / peak

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
    print(f"  LedFX   : {CFG['ledfx']['base_url']}")
    print(f"  Audio   : {CFG.get('audio', {}).get('source', 'usb')}")
    print(f"  Phasen  :")
    for phase, pcfg in CFG["ledfx"]["phases"].items():
        scenes = pcfg.get("scenes", [])
        print(f"    {phase:<12} → {len(scenes)} scene(s): {scenes}")
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
