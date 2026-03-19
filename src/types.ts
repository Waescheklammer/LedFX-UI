export interface SubPreset {
  id: string;
  name: string;
  effectName: string;
}

export interface Preset {
  id: string;
  mainTitle: string; // Fester Haupttitel für die Kachel
  name: string; // Aktuell angezeigter Name (kann sich durch Varianten-Wechsel ändern)
  effectName: string; // Aktuell aktiver Effekt-Name für API-Request
  subPresets: SubPreset[]; // Verfügbare Varianten
}

export interface AppSettings {
  queueInterval: number; // in Millisekunden
}

export interface AutopilotStatus {
  state: 'running' | 'idle' | 'service_unavailable';
  current_phase?: string | null;
  last_switch?: string | null;
  frame_count?: number;
  switch_count?: number;
  uptime_s?: number | null;
}


