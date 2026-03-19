import React, { useState, useEffect } from 'react';
import { Container, Grid, Box, Snackbar, Alert } from '@mui/material';
import { Navbar } from './components/Navbar';
import { PresetCard } from './components/PresetCard';
import { AddEffectDialog } from './components/AddEffectDialog';
import { DeleteEffectDialog } from './components/DeleteEffectDialog';
import { Preset, SubPreset, AutopilotStatus } from './types';
import { activateEffect, getAutopilotStatus, startAutopilot, stopAutopilot } from './api/ledfxClient';
import { POLLING_INTERVAL_MS } from './config';

const STORAGE_KEY_PRESETS = 'ledfx_presets';

function App() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [autopilotStatus, setAutopilotStatus] = useState<AutopilotStatus | null>(null);
  const [autopilotLoading, setAutopilotLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Lade Presets aus localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (stored) {
      try {
        setPresets(JSON.parse(stored));
      } catch (error) {
        console.error('Fehler beim Laden der Presets:', error);
      }
    }
  }, []);

  // Speichere Presets in localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
  }, [presets]);

  // Autopilot Status Polling (alle 10s, pausiert bei inaktivem Tab)
  useEffect(() => {
    const fetchStatus = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const status = await getAutopilotStatus();
        setAutopilotStatus(status);
      } catch (error) {
        console.error('Fehler beim Autopilot-Status-Abruf:', error);
      }
    };

    // Initial fetch
    fetchStatus();

    // Polling alle 10s
    const interval = setInterval(fetchStatus, POLLING_INTERVAL_MS);

    // Cleanup
    return () => clearInterval(interval);
  }, []);

  // Toggle Autopilot
  const handleToggleAutopilot = async () => {
    const isRunning = autopilotStatus?.state === 'running';
    setAutopilotLoading(true);

    try {
      if (isRunning) {
        await stopAutopilot();
        setSnackbar({ open: true, message: 'Autopilot gestoppt', severity: 'success' });
      } else {
        await startAutopilot();
        setSnackbar({ open: true, message: 'Autopilot gestartet', severity: 'success' });
      }

      // Status sofort aktualisieren
      const status = await getAutopilotStatus();
      setAutopilotStatus(status);
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || 'Fehler beim Autopilot-Toggle';
      setSnackbar({ open: true, message, severity: 'error' });
      console.error('Autopilot Toggle Fehler:', error);
    } finally {
      setAutopilotLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleAddEffect = (
    name: string,
    effectName: string,
    mainTitle?: string,
    parentPresetId?: string
  ) => {
    if (!parentPresetId) {
      // Neue Kachel (Preset) erstellen
      const newPreset: Preset = {
        id: crypto.randomUUID(),
        mainTitle: mainTitle || name,
        name,
        effectName,
        subPresets: [],
      };
      setPresets([...presets, newPreset]);
    } else {
      // Variante zu bestehender Kachel hinzufügen
      setPresets(
        presets.map((preset) => {
          if (preset.id === parentPresetId) {
            const newVariant: SubPreset = {
              id: crypto.randomUUID(),
              name,
              effectName,
            };
            return {
              ...preset,
              subPresets: [...preset.subPresets, newVariant],
            };
          }
          return preset;
        })
      );
    }
  };

  const handleVariantChange = async (presetId: string, variantId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    const selectedVariant = preset.subPresets.find((v) => v.id === variantId);
    if (!selectedVariant) return;

    // Aktiviere den Effekt und stoppe Autopilot
    await handleManualEffectActivation(selectedVariant.effectName);

    // Update die Presets (Variante wird zur Hauptvariante)
    setPresets(
      presets.map((p) => {
        if (p.id === presetId) {
          // Die aktuelle Variante wird zu einer SubPreset
          const currentAsSubPreset: SubPreset = {
            id: crypto.randomUUID(),
            name: p.name,
            effectName: p.effectName,
          };

          // Die ausgewählte Variante wird zur Hauptvariante
          return {
            ...p,
            name: selectedVariant.name,
            effectName: selectedVariant.effectName,
            subPresets: [
              currentAsSubPreset,
              ...p.subPresets.filter((v) => v.id !== variantId),
            ],
          };
        }
        return p;
      })
    );
  };

  const handleDeleteEffect = (presetId: string, variantId?: string) => {
    if (!variantId) {
      // Gesamte Kachel löschen
      setPresets(presets.filter((preset) => preset.id !== presetId));
    } else {
      // Nur Variante löschen
      setPresets(
        presets.map((preset) => {
          if (preset.id === presetId) {
            return {
              ...preset,
              subPresets: preset.subPresets.filter((v) => v.id !== variantId),
            };
          }
          return preset;
        })
      );
    }
  };

  // Handler für manuelle Effekt-Aktivierung - stoppt Autopilot falls aktiv
  const handleManualEffectActivation = async (effectName: string) => {
    // Stoppt Autopilot falls aktiv
    if (autopilotStatus?.state === 'running') {
      try {
        await stopAutopilot();
        const status = await getAutopilotStatus();
        setAutopilotStatus(status);
        setSnackbar({ open: true, message: 'Autopilot durch manuelle Aktivierung gestoppt', severity: 'info' });
      } catch (error) {
        console.error('Fehler beim Stoppen des Autopiloten:', error);
      }
    }

    // Aktiviere den Effekt
    try {
      await activateEffect(effectName);
      console.log(`Aktiviere Preset: ${effectName}`);
    } catch (error) {
      console.error('Fehler beim Aktivieren des Presets:', error);
      setSnackbar({ open: true, message: 'Fehler beim Aktivieren des Effekts', severity: 'error' });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar
        onAddEffect={() => setAddDialogOpen(true)}
        onDeleteEffect={() => setDeleteDialogOpen(true)}
        autopilotStatus={autopilotStatus}
        autopilotLoading={autopilotLoading}
        onToggleAutopilot={handleToggleAutopilot}
      />

      <Container
        maxWidth="xl"
        sx={{
          mt: 4,
          mb: 4,
          flexGrow: 1,
        }}
      >
        <Grid container spacing={3} columns={4}>
          {presets.map((preset) => (
            <Grid item xs={1} key={preset.id}>
              <PresetCard
                preset={preset}
                onVariantChange={handleVariantChange}
                onManualEffectActivation={handleManualEffectActivation}
              />
            </Grid>
          ))}
        </Grid>
      </Container>

      <AddEffectDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddEffect}
        presets={presets}
      />

      <DeleteEffectDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onDelete={handleDeleteEffect}
        presets={presets}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
