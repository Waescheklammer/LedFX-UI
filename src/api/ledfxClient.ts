import axios from 'axios';
import { AUTOPILOT_BASE_URL } from '../config';

const API_BASE = '/api'; // Proxy leitet an localhost:8888

export async function getLedFxStatus() {
  try {
    const response = await axios.get(`${API_BASE}/status`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function activateEffect(effectName: string) {
  try {
    const response = await axios.post(`${API_BASE}/effects`, {
      effect: effectName,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

// Autopilot API-Funktionen
export async function getAutopilotStatus() {
  try {
    const response = await axios.get(`${AUTOPILOT_BASE_URL}/status`, {
      timeout: 5000, // 5 Sekunden Timeout
    });
    return response.data;
  } catch (error) {
    // Behandle spezielle Fehlertypen
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        console.warn('Autopilot Service nicht verfügbar');
        return { state: 'service_unavailable' };
      }
    }
    console.error('Autopilot Status Fehler:', error);
    throw error;
  }
}

export async function startAutopilot() {
  try {
    const response = await axios.post(`${AUTOPILOT_BASE_URL}/start`, {}, {
      timeout: 10000, // 10 Sekunden Timeout
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        throw new Error('Autopilot Service ist nicht verfügbar');
      }
    }
    console.error('Autopilot Start Fehler:', error);
    throw error;
  }
}

export async function stopAutopilot() {
  try {
    const response = await axios.post(`${AUTOPILOT_BASE_URL}/stop`, {}, {
      timeout: 10000, // 10 Sekunden Timeout  
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
        throw new Error('Autopilot Service ist nicht verfügbar');
      }
    }
    console.error('Autopilot Stop Fehler:', error);
    throw error;
  }
}

