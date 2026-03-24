import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Chip,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { Preset, SubPreset } from '../types';

interface ImportConfigDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (presets: Preset[]) => void;
  existingPresets: Preset[];
}

interface ImportedScene {
  key: string; // Scene-Key aus config.json
  displayName: string; // name-Property aus Scene
  isDuplicate: boolean; // Bereits vorhanden?
  parentKey: string; // Zuordnung zu anderem Scene-Key (leer = eigener Effekt)
}

export const ImportConfigDialog: React.FC<ImportConfigDialogProps> = ({
  open,
  onClose,
  onImport,
  existingPresets,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [scenes, setScenes] = useState<ImportedScene[]>([]);
  const [error, setError] = useState<string>('');

  const steps = ['Datei hochladen', 'Gruppierung festlegen'];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const config = JSON.parse(content);

        // Validierung: Prüfe ob scenes-Key existiert
        if (!config.scenes || typeof config.scenes !== 'object') {
          setError('Ungültige config.json: "scenes"-Objekt nicht gefunden');
          setScenes([]);
          return;
        }

        // Alle existierenden effectNames sammeln (für Duplikat-Erkennung)
        const existingEffectNames = new Set<string>();
        existingPresets.forEach((preset) => {
          existingEffectNames.add(preset.effectName);
          preset.subPresets.forEach((sub) => existingEffectNames.add(sub.effectName));
        });

        // Scene-Keys extrahieren und zu ImportedScene konvertieren
        const sceneKeys = Object.keys(config.scenes);
        const importedScenes: ImportedScene[] = sceneKeys.map((key) => ({
          key,
          displayName: config.scenes[key]?.name || key,
          isDuplicate: existingEffectNames.has(key),
          parentKey: '', // Default: keine Zuordnung
        }));

        setScenes(importedScenes);

        if (importedScenes.length === 0) {
          setError('Keine Scenes in der config.json gefunden');
        } else if (importedScenes.every((s) => s.isDuplicate)) {
          setError('Alle Scenes existieren bereits (Duplikate werden übersprungen)');
        }
      } catch (err) {
        setError('Fehler beim Parsen der JSON-Datei: Ungültiges Format');
        setScenes([]);
        console.error('JSON Parse Error:', err);
      }
    };

    reader.onerror = () => {
      setError('Fehler beim Lesen der Datei');
      setScenes([]);
    };

    reader.readAsText(selectedFile);
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleParentChange = (sceneKey: string, parentKey: string) => {
    setScenes((prevScenes) =>
      prevScenes.map((scene) =>
        scene.key === sceneKey ? { ...scene, parentKey } : scene
      )
    );
  };

  const handleImport = () => {
    // Nur nicht-duplizierte Scenes importieren
    const validScenes = scenes.filter((s) => !s.isDuplicate);

    // Map: Scene-Key -> Preset-ID (für Zuordnung)
    const keyToPresetId = new Map<string, string>();

    // Erstelle Presets
    const newPresets: Preset[] = [];

    // 1. Zuerst alle Parent-Presets erstellen
    validScenes.forEach((scene) => {
      if (scene.parentKey === '') {
        // Eigenständiger Effekt oder Parent für andere
        const presetId = crypto.randomUUID();
        keyToPresetId.set(scene.key, presetId);

        const preset: Preset = {
          id: presetId,
          mainTitle: scene.key,
          name: scene.key,
          effectName: scene.key,
          subPresets: [],
        };
        newPresets.push(preset);
      }
    });

    // 2. Dann alle Child-Scenes als SubPresets hinzufügen
    validScenes.forEach((scene) => {
      if (scene.parentKey !== '') {
        const parentPresetId = keyToPresetId.get(scene.parentKey);
        if (!parentPresetId) return; // Parent nicht gefunden (sollte nicht passieren)

        const subPreset: SubPreset = {
          id: crypto.randomUUID(),
          name: scene.key,
          effectName: scene.key,
        };

        // Finde Parent-Preset und füge SubPreset hinzu
        const parentPreset = newPresets.find((p) => p.id === parentPresetId);
        if (parentPreset) {
          parentPreset.subPresets.push(subPreset);
        }
      }
    });

    onImport(newPresets);
    handleReset();
  };

  const handleReset = () => {
    setActiveStep(0);
    setFile(null);
    setScenes([]);
    setError('');
    onClose();
  };

  // Prüfe ob eine Scene als Parent verwendet wird
  const isParent = (sceneKey: string): boolean => {
    return scenes.some((s) => s.parentKey === sceneKey);
  };

  // Verfügbare Parent-Optionen für eine Scene (keine Zirkularität)
  const getAvailableParents = (currentSceneKey: string): ImportedScene[] => {
    return scenes.filter((s) => {
      // Nicht sich selbst
      if (s.key === currentSceneKey) return false;
      // Keine Duplikate als Parent
      if (s.isDuplicate) return false;
      // Keine Scenes die bereits Children sind (nur flache Verschachtelung)
      return s.parentKey === '';
    });
  };

  const canProceedToNext =
    scenes.length > 0 &&
    scenes.some((s) => !s.isDuplicate) &&
    !error;

  const canImport = scenes.some((s) => !s.isDuplicate);

  const nonDuplicateCount = scenes.filter((s) => !s.isDuplicate).length;

  return (
    <Dialog open={open} onClose={handleReset} maxWidth="md" fullWidth>
      <DialogTitle>
        Config.json importieren
        <Stepper activeStep={activeStep} sx={{ mt: 2 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>

      <DialogContent>
        {activeStep === 0 && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Lade eine config.json-Datei hoch. Alle Scenes werden als neue
              Effekte importiert. Im nächsten Schritt kannst du Gruppierungen
              festlegen.
            </Alert>

            <Button
              variant="contained"
              component="label"
              startIcon={<FileUploadIcon />}
              fullWidth
              sx={{ mb: 2 }}
            >
              Datei auswählen
              <input
                type="file"
                accept=".json"
                hidden
                onChange={handleFileChange}
              />
            </Button>

            {file && (
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                Datei: {file.name}
              </Typography>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {scenes.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Gefundene Scenes: {scenes.length}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {nonDuplicateCount} neue • {scenes.length - nonDuplicateCount}{' '}
                  Duplikate (werden übersprungen)
                </Typography>

                <List dense sx={{ maxHeight: 300, overflow: 'auto', mt: 2 }}>
                  {scenes.map((scene) => (
                    <ListItem
                      key={scene.key}
                      sx={{
                        opacity: scene.isDuplicate ? 0.5 : 1,
                        textDecoration: scene.isDuplicate ? 'line-through' : 'none',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                          {scene.key}
                        </Typography>
                        {scene.isDuplicate && (
                          <Chip label="Duplikat" size="small" color="warning" />
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Lege fest, welche Scenes gruppiert werden sollen. Ohne Zuordnung
              wird jede Scene ein eigener Effekt. Mit Zuordnung wird eine Scene
              zur Variante eines anderen importierten Effekts.
            </Alert>

            <List sx={{ maxHeight: 500, overflow: 'auto' }}>
              {scenes
                .filter((s) => !s.isDuplicate)
                .map((scene) => (
                  <ListItem key={scene.key} sx={{ display: 'block', mb: 2 }}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                          {scene.key}
                        </Typography>
                        {isParent(scene.key) && (
                          <Chip label="Parent" size="small" color="primary" />
                        )}
                        {scene.parentKey && (
                          <Chip label="Variante" size="small" color="secondary" />
                        )}
                      </Box>

                      <FormControl fullWidth size="small">
                        <InputLabel>Zugehörigkeit</InputLabel>
                        <Select
                          value={scene.parentKey}
                          onChange={(e) => handleParentChange(scene.key, e.target.value)}
                          label="Zugehörigkeit"
                          disabled={isParent(scene.key)} // Parents können keine Children sein
                        >
                          <MenuItem value="">
                            <em>Keine – Eigener Effekt</em>
                          </MenuItem>
                          {getAvailableParents(scene.key).map((parent) => (
                            <MenuItem key={parent.key} value={parent.key}>
                              {parent.key}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {isParent(scene.key) && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Wird als Haupt-Effekt angelegt (hat Varianten zugeordnet)
                        </Typography>
                      )}
                    </Paper>
                  </ListItem>
                ))}
            </List>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleReset}>Abbrechen</Button>
        {activeStep > 0 && <Button onClick={handleBack}>Zurück</Button>}
        {activeStep === 0 && (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={!canProceedToNext}
          >
            Weiter
          </Button>
        )}
        {activeStep === 1 && (
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={!canImport}
          >
            {nonDuplicateCount} Scene(s) importieren
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};




