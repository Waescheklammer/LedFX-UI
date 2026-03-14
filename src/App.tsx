import React, { useState, useEffect } from 'react';
import { Container, Grid, Box } from '@mui/material';
import { Navbar } from './components/Navbar';
import { PresetCard } from './components/PresetCard';
import { AddEffectDialog } from './components/AddEffectDialog';
import { DeleteEffectDialog } from './components/DeleteEffectDialog';
import { Preset, SubPreset } from './types';

const STORAGE_KEY = 'ledfx_presets';

function App() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Lade Presets aus localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }, [presets]);

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar
        onAddEffect={() => setAddDialogOpen(true)}
        onDeleteEffect={() => setDeleteDialogOpen(true)}
      />

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        <Grid container spacing={3} columns={4}>
          {presets.map((preset) => (
            <Grid item xs={1} key={preset.id}>
              <PresetCard preset={preset} onVariantChange={handleVariantChange} />
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
    </Box>
  );
}

export default App;
