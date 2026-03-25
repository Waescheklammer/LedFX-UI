import React, { useState, useEffect } from 'react';
import { Container, Grid, Box, Snackbar, Alert } from '@mui/material';
import { Navbar } from './components/Navbar';
import { PresetCard } from './components/PresetCard';
import { AddEffectDialog } from './components/AddEffectDialog';
import { DeleteEffectDialog } from './components/DeleteEffectDialog';
import { ImportConfigDialog } from './components/ImportConfigDialog';
import { AutopilotLogSidebar } from './components/AutopilotLogSidebar';
import { Preset, SubPreset, AutopilotStatus } from './types';
import { activateEffect, getAutopilotStatus, startAutopilot, stopAutopilot } from './api/ledfxClient.ts';
import { POLLING_INTERVAL_MS } from './config';

const STORAGE_KEY_PRESETS = 'ledfx_presets';

function App() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [autopilotStatus, setAutopilotStatus] = useState<AutopilotStatus | null>(null);
  const [autopilotLoading, setAutopilotLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Globaler Handler für unbehandelte Promise Rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.warn('Unhandled Promise Rejection gefangen:', event.reason);
      
      // Verhindere die Standard-Fehlerbehandlung
      event.preventDefault();
      
      // Optional: Toast für kritische Fehler
      if (event.reason && typeof event.reason.message === 'string' && 
          !event.reason.message.includes('Autopilot')) {
        setSnackbar({ 
          open: true, 
          message: 'Ein unerwarteter Fehler ist aufgetreten', 
          severity: 'error' 
        });
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

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
    let intervalId: NodeJS.Timeout;

    const fetchStatus = async () => {
      // Nur wenn das Tab/Fenster sichtbar ist
      if (document.visibilityState !== 'visible') return;

      try {
        const status = await getAutopilotStatus();
        setAutopilotStatus(status);
      } catch (error) {
        // Stiller Fehler - nur loggen, kein Toast/Alert für Polling-Fehler
        console.warn('Autopilot Status Polling Fehler (wird ignoriert):', error);
        
        // Bei Netzwerkfehlern Status als unavailable setzen
        setAutopilotStatus({ state: 'service_unavailable' });
      }
    };

    // Initial fetch mit Delay für bessere Startup-Performance
    const initialFetch = () => {
      setTimeout(() => {
        fetchStatus().catch(error => {
          console.warn('Initial Autopilot Status Fetch Fehler:', error);
          setAutopilotStatus({ state: 'service_unavailable' });
        });
      }, 1000); // 1 Sekunde warten nach App-Start
    };

    initialFetch();

    // Polling alle 10s
    intervalId = setInterval(() => {
      fetchStatus().catch(error => {
        // Promise rejection explizit behandeln
        console.warn('Autopilot Polling Fehler:', error);
      });
    }, POLLING_INTERVAL_MS);

    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Toggle Autopilot
  const handleToggleAutopilot = async () => {
    const isRunning = autopilotStatus?.state === 'running';
    const isUnavailable = autopilotStatus?.state === 'service_unavailable';
    
    if (isUnavailable) {
      setSnackbar({ 
        open: true, 
        message: 'Autopilot Service ist nicht verfügbar. Überprüfe, ob der Service läuft.', 
        severity: 'error' 
      });
      return;
    }

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
      try {
        const status = await getAutopilotStatus();
        setAutopilotStatus(status);
      } catch (statusError) {
        console.warn('Status Update nach Toggle fehlgeschlagen:', statusError);
        // Status wird durch Polling aktualisiert, daher nicht kritisch
      }

    } catch (error: any) {
      let message = 'Unbekannter Fehler beim Autopilot-Toggle';
      
      if (typeof error?.message === 'string') {
        message = error.message;
      } else if (error?.response?.data?.detail) {
        message = error.response.data.detail;
      } else if (error?.response?.data?.message) {
        message = error.response.data.message;
      }

      setSnackbar({ open: true, message, severity: 'error' });
      console.error('Autopilot Toggle Fehler:', error);
      
      // Bei Fehlern Status als unavailable setzen
      setAutopilotStatus({ state: 'service_unavailable' });
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

  const handleImportScenes = (importedPresets: Preset[]) => {
    setPresets([...presets, ...importedPresets]);
    setSnackbar({
      open: true,
      message: `${importedPresets.length} Effekt(e) erfolgreich importiert`,
      severity: 'success',
    });
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
        onImport={() => setImportDialogOpen(true)}
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

      <ImportConfigDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImportScenes}
        existingPresets={presets}
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

      <AutopilotLogSidebar />
    </Box>
  );
}

export default App;
