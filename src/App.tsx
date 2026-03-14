import React, { useState, useEffect, useRef } from 'react';
import { Container, Grid, Box } from '@mui/material';
import { Navbar } from './components/Navbar';
import { PresetCard } from './components/PresetCard';
import { AddEffectDialog } from './components/AddEffectDialog';
import { DeleteEffectDialog } from './components/DeleteEffectDialog';
import { QueueSidebar } from './components/QueueSidebar';
import { SettingsDialog } from './components/SettingsDialog';
import { Preset, SubPreset, QueueItem, AppSettings } from './types';
import { activateEffect } from './api/ledfxClient';

const STORAGE_KEY_PRESETS = 'ledfx_presets';
const STORAGE_KEY_QUEUE = 'ledfx_queue';
const STORAGE_KEY_SETTINGS = 'ledfx_settings';

const DEFAULT_SETTINGS: AppSettings = {
  queueInterval: 10000, // 10 Sekunden
  autoPlay: false,
};

function App() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [queueOpen, setQueueOpen] = useState(true);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Lade Queue aus localStorage
  useEffect(() => {
    const storedQueue = localStorage.getItem(STORAGE_KEY_QUEUE);
    if (storedQueue) {
      try {
        setQueue(JSON.parse(storedQueue));
      } catch (error) {
        console.error('Fehler beim Laden der Queue:', error);
      }
    }
  }, []);

  // Lade Settings aus localStorage
  useEffect(() => {
    const storedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings));
      } catch (error) {
        console.error('Fehler beim Laden der Settings:', error);
      }
    }
  }, []);

  // Speichere Presets in localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
  }, [presets]);

  // Speichere Queue in localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
  }, [queue]);

  // Speichere Settings in localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  // Auto-Play Logic
  useEffect(() => {
    // Cleanup vorheriger Timer
    if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }

    if (!settings.autoPlay || queue.length === 0) return;

    // Starte Auto-Play Timer
    autoPlayTimerRef.current = setInterval(async () => {
      const nextIndex = (currentQueueIndex + 1) % queue.length;
      const nextItem = queue[nextIndex];

      try {
        await activateEffect(nextItem.effectName);
        console.log(`Auto-Play: ${nextItem.displayName}`);
      } catch (error) {
        console.error('Fehler beim Auto-Play:', error);
      }

      setCurrentQueueIndex(nextIndex);
    }, settings.queueInterval);

    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
      }
    };
  }, [settings.autoPlay, settings.queueInterval, queue, currentQueueIndex]);

  // Handler für manuelle Aktivierung - unterbricht Auto-Play
  const handleManualActivation = () => {
    if (settings.autoPlay) {
      setSettings({ ...settings, autoPlay: false });
      console.log('Auto-Play durch manuelle Aktivierung unterbrochen');
    }
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

  const handleVariantChange = (presetId: string, variantId: string) => {
    setPresets(
      presets.map((preset) => {
        if (preset.id === presetId) {
          const selectedVariant = preset.subPresets.find((v) => v.id === variantId);
          if (!selectedVariant) return preset;

          // Die aktuelle Variante wird zu einer SubPreset
          const currentAsSubPreset: SubPreset = {
            id: crypto.randomUUID(),
            name: preset.name,
            effectName: preset.effectName,
          };

          // Die ausgewählte Variante wird zur Hauptvariante
          return {
            ...preset,
            name: selectedVariant.name,
            effectName: selectedVariant.effectName,
            subPresets: [
              currentAsSubPreset,
              ...preset.subPresets.filter((v) => v.id !== variantId),
            ],
          };
        }
        return preset;
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

  const handleAddToQueue = (presetId: string, variantId?: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    let displayName: string;
    let effectName: string;

    if (variantId) {
      const variant = preset.subPresets.find((v) => v.id === variantId);
      if (!variant) return;
      displayName = `${preset.mainTitle} - ${variant.name}`;
      effectName = variant.effectName;
    } else {
      displayName = `${preset.mainTitle} - ${preset.name}`;
      effectName = preset.effectName;
    }

    const newItem: QueueItem = {
      id: crypto.randomUUID(),
      presetId,
      variantId,
      displayName,
      effectName,
    };

    setQueue([...queue, newItem]);
  };

  const handleRemoveFromQueue = (itemId: string) => {
    const newQueue = queue.filter((item) => item.id !== itemId);
    setQueue(newQueue);

    // Passe Index an wenn nötig
    if (currentQueueIndex >= newQueue.length && newQueue.length > 0) {
      setCurrentQueueIndex(0);
    }
  };

  const handleToggleAutoPlay = () => {
    setSettings({ ...settings, autoPlay: !settings.autoPlay });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar
        onAddEffect={() => setAddDialogOpen(true)}
        onDeleteEffect={() => setDeleteDialogOpen(true)}
        onToggleQueue={() => setQueueOpen(!queueOpen)}
        queueOpen={queueOpen}
      />

      <Container
        maxWidth="xl"
        sx={{
          mt: 4,
          mb: 4,
          flexGrow: 1,
          mr: queueOpen ? '320px' : 0,
          transition: 'margin-right 0.3s',
        }}
      >
        <Grid container spacing={3} columns={4}>
          {presets.map((preset) => (
            <Grid item xs={1} key={preset.id}>
              <PresetCard
                preset={preset}
                onVariantChange={handleVariantChange}
                onAddToQueue={handleAddToQueue}
                onManualActivation={handleManualActivation}
              />
            </Grid>
          ))}
        </Grid>
      </Container>

      <QueueSidebar
        open={queueOpen}
        queue={queue}
        currentIndex={currentQueueIndex}
        autoPlay={settings.autoPlay}
        onToggleAutoPlay={handleToggleAutoPlay}
        onRemoveFromQueue={handleRemoveFromQueue}
        onOpenSettings={() => setSettingsDialogOpen(true)}
        onClose={() => setQueueOpen(false)}
      />

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

      <SettingsDialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        settings={settings}
        onSave={setSettings}
      />
    </Box>
  );
}

export default App;
