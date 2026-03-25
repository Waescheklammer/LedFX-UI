"""
Model-Test – Phasenerkennung auf einer Audiodatei
==================================================
Lädt eine MP3/WAV-Datei, extrahiert Features und gibt die erkannten
Phasen mit Timestamp in der Konsole aus. Kein Mikrofon, keine LedFX API.

Abhängigkeiten:
  pip install numpy librosa scikit-learn joblib
"""

import numpy as np
import librosa
import joblib
import argparse
import os
import sys
from collections import deque
from datetime import timedelta


# ─────────────────────────────────────────────
# Konfiguration – muss mit Phase 3 übereinstimmen
# ─────────────────────────────────────────────
SAMPLE_RATE   = 22050
FRAME_MS      = 100
FRAME_SAMPLES = int(SAMPLE_RATE * FRAME_MS / 1000)

FEATURES = [
    "rms", "bass", "mid", "high",
    "bass_ratio", "onset", "energy_slope", "spectral_centroid",
]
WINDOW = 5

BASS_LOW,  BASS_HIGH = 20,   250
MID_LOW,   MID_HIGH  = 250,  4000
HIGH_LOW             = 4000

COOLDOWN_FRAMES  = 20   # mind. N Frames bevor Phase wechseln darf (= 2s)
VOTE_WINDOW      = 11   # Mehrheitsvote über N Frames (ungerade!)
CONFIDENCE_MIN   = 0.55 # mind. X% der Votes müssen für neue Phase sein

PHASE_COLORS = {
    "silence":   "\033[90m",    # grau
    "hard_bass": "\033[91m",    # rot
    "build_up":  "\033[33m",    # gelb
}
RESET = "\033[0m"


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
    current = list(feature_history)[-1]
    lags    = list(feature_history)[:-1][::-1]
    while len(lags) < WINDOW:
        lags.append([0.0] * len(FEATURES))
    lag_flat = [v for lag in lags[:WINDOW] for v in lag]
    return np.array([current + lag_flat], dtype=np.float32)


def fmt_time(seconds: float) -> str:
    td = timedelta(seconds=int(seconds))
    ms = int((seconds % 1) * 1000)
    return f"{str(td)}.{ms:03d}"


# ─────────────────────────────────────────────
# Hauptfunktion
# ─────────────────────────────────────────────
def run(audio_path: str, model_dir: str):

    # Modell laden
    model_path  = os.path.join(model_dir, "phase_classifier.pkl")
    scaler_path = os.path.join(model_dir, "scaler.pkl")

    if not os.path.isfile(model_path):
        print(f"Fehler: {model_path} nicht gefunden.")
        print("Erst Phase 3 ausführen: py train_model.py ...")
        sys.exit(1)

    model  = joblib.load(model_path)
    scaler = joblib.load(scaler_path)

    # Audio laden
    print(f"\nLade  : {audio_path}")
    audio, sr = librosa.load(audio_path, sr=SAMPLE_RATE, mono=True)
    duration  = len(audio) / SAMPLE_RATE
    n_frames  = len(audio) // FRAME_SAMPLES
    print(f"Dauer : {fmt_time(duration)}  |  {n_frames} Frames\n")

    print(f"  {'Zeit':<14} {'Phase':<14} {'rms':>6}  {'bass':>6}  {'slope':>8}")
    print("  " + "─" * 54)

    rms_history     = deque(maxlen=WINDOW)
    feature_history = deque(maxlen=WINDOW + 1)
    vote_buffer     = deque(maxlen=VOTE_WINDOW)  # Smoothing-Puffer
    current_phase   = None
    frames_since_switch = 0

    for i in range(n_frames):
        chunk   = audio[i * FRAME_SAMPLES : (i + 1) * FRAME_SAMPLES]
        elapsed = i * FRAME_MS / 1000.0

        feats = extract_features(chunk, rms_history)
        rms_history.append(feats[0])
        feature_history.append(feats)
        frames_since_switch += 1

        if i < WINDOW:
            continue

        x         = build_input_vector(feature_history)
        x         = scaler.transform(x)
        raw_phase = model.predict(x)[0]
        vote_buffer.append(raw_phase)

        # Mehrheitsvote: häufigste Phase im Puffer
        votes      = list(vote_buffer)
        winner     = max(set(votes), key=votes.count)
        confidence = votes.count(winner) / len(votes)

        # Phasenwechsel nur wenn: Cooldown abgelaufen + Konfidenz hoch genug
        if (winner != current_phase
                and frames_since_switch >= COOLDOWN_FRAMES
                and confidence >= CONFIDENCE_MIN):
            current_phase       = winner
            frames_since_switch = 0

            color = PHASE_COLORS.get(winner, "")
            rms   = feats[0]
            bass  = feats[4]   # bass_ratio
            slope = feats[6]   # energy_slope

            print(
                f"  {fmt_time(elapsed):<14} "
                f"{color}{winner:<14}{RESET} "
                f"  conf:{confidence:.0%}  "
                f"{rms:>6.3f}  {bass:>6.2f}  {slope:>+8.4f}"
            )

    print("\nFertig.\n")


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Phasenerkennung auf einer Audiodatei testen"
    )
    parser.add_argument(
        "audio",
        help="Audiodatei (MP3, WAV, …)"
    )
    parser.add_argument(
        "--model-dir",
        default=".",
        help="Ordner mit phase_classifier.pkl + scaler.pkl (default: .)"
    )
    args = parser.parse_args()
    run(args.audio, args.model_dir)


if __name__ == "__main__":
    main()
