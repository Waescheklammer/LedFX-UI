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

export async function activateEffect(sceneName: string) {
  try {
    const response = await axios.put(`${API_BASE}/scenes`, {
      id: sceneName,
      action: 'activate'
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

// Autopilot API-Funktionen
export async function getAutopilotStatus() {
  try {
    const response = await axios.get(`${AUTOPILOT_BASE_URL}/status`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function startAutopilot() {
  try {
    const response = await axios.post(`${AUTOPILOT_BASE_URL}/start`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function stopAutopilot() {
  try {
    const response = await axios.post(`${AUTOPILOT_BASE_URL}/stop`);
    return response.data;
  } catch (error) {
    throw error;
  }
}

