# ── Autopilot Backend ──────────────────────────────────
# Python 3.11-slim als Basis (klein & schnell)
FROM python:3.11-slim

# System-Abhängigkeiten für sounddevice (PortAudio) + scipy
RUN apt-get update && apt-get install -y --no-install-recommends \
        libportaudio2 \
        libportaudiocpp0 \
        portaudio19-dev \
        libsndfile1 \
        alsa-utils \
        libasound2 \
        libasound2-plugins \
        pulseaudio-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python-Dependencies zuerst (Docker-Layer-Cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Anwendung + Modelle kopieren
COPY Autopilot.py .
COPY models/ ./models/
COPY docker-config.json ./config.json

# Port für FastAPI
EXPOSE 8080

# Health-Check: prüft ob /status erreichbar ist
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import requests; r=requests.get('http://localhost:8080/status'); assert r.status_code==200" || exit 1

# Starten
CMD ["python", "Autopilot.py", "--config", "config.json"]

