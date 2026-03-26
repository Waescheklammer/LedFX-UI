import React, { useState, useRef } from 'react';
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
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Preset, SubPreset } from '../types';
import { validatePresetsJson } from '../utils/validation';

interface UploadPresetsDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (presets: Preset[]) => void;
}

interface UploadedPreset extends Preset {
  parentKey: string; // Zuordnung zu anderem Preset (leer = eigener Effekt)
}

export const UploadPresetsDialog: React.FC<UploadPresetsDialogProps> = ({
  open,
  onClose,
  onUpload,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [presets, setPresets] = useState<UploadedPreset[]>([]);
  const [error, setError] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = ['JSON hochladen', 'Gruppierung festlegen'];

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setValidationErrors([]);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      
      const validation = validatePresetsJson(parsed);
      
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setError('Die hochgeladene Datei ist ungültig');
        setPresets([]);
        return;
      }

      // Konvertiere zu UploadedPresets mit parentKey
      const uploadedPresets: UploadedPreset[] = validation.presets.map((preset) => ({
        ...preset,
        parentKey: '',
      }));

      setPresets(uploadedPresets);
    } catch (err: any) {
      setError('Fehler beim Parsen der JSON-Datei: ' + (err.message || 'Unbekannter Fehler'));
      setPresets([]);
      setValidationErrors([]);
      console.error('JSON Parse Error:', err);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleNext = () => {
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleParentChange = (presetId: string, parentId: string) => {
    setPresets((prevPresets) =>
      prevPresets.map((preset) =>
        preset.id === presetId ? { ...preset, parentKey: parentId } : preset
      )
    );
  };

  const handleUpload = () => {
    // Map: Preset-ID -> Preset-ID (für Zuordnung)
    const idToNewId = new Map<string, string>();

    // Erstelle finale Presets
    const finalPresets: Preset[] = [];

    // 1. Zuerst alle Parent-Presets erstellen
    presets.forEach((preset) => {
      if (preset.parentKey === '') {
        // Eigenständiger Effekt oder Parent für andere
        const newId = crypto.randomUUID();
        idToNewId.set(preset.id, newId);

        const finalPreset: Preset = {
          id: newId,
          mainTitle: preset.mainTitle,
          name: preset.name,
          effectName: preset.effectName,
          subPresets: [...preset.subPresets], // Ursprüngliche SubPresets behalten
        };
        finalPresets.push(finalPreset);
      }
    });

    // 2. Dann alle Child-Presets als SubPresets hinzufügen
    presets.forEach((preset) => {
      if (preset.parentKey !== '') {
        const parentPresetId = idToNewId.get(preset.parentKey);
        if (!parentPresetId) return; // Parent nicht gefunden (sollte nicht passieren)

        const subPreset: SubPreset = {
          id: crypto.randomUUID(),
          name: preset.name,
          effectName: preset.effectName,
        };

        // Finde Parent-Preset und füge SubPreset hinzu
        const parentPreset = finalPresets.find((p) => p.id === parentPresetId);
        if (parentPreset) {
          parentPreset.subPresets.push(subPreset);
        }
      }
    });

    onUpload(finalPresets);
    handleReset();
  };

  const handleReset = () => {
    setActiveStep(0);
    setPresets([]);
    setError('');
    setValidationErrors([]);
    onClose();
  };

  // Prüfe ob ein Preset als Parent verwendet wird
  const isParent = (presetId: string): boolean => {
    return presets.some((p) => p.parentKey === presetId);
  };

  // Verfügbare Parent-Optionen für ein Preset (keine Zirkularität)
  const getAvailableParents = (currentPresetId: string): UploadedPreset[] => {
    return presets.filter((p) => {
      // Nicht sich selbst
      if (p.id === currentPresetId) return false;
      // Keine Presets die bereits Children sind (nur flache Verschachtelung)
      return p.parentKey === '';
    });
  };

  const canProceedToNext = presets.length > 0 && !error;

  const getTotalSubPresetsCount = (preset: UploadedPreset): number => {
    return preset.subPresets.length;
  };

  return (
    <Dialog open={open} onClose={handleReset} maxWidth="md" fullWidth>
      <DialogTitle>
        JSON-Presets hochladen
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
              Lade eine zuvor exportierte JSON-Datei hoch. Im nächsten Schritt kannst du
              Gruppierungen festlegen.
            </Alert>

            <Alert severity="warning" sx={{ mb: 3 }}>
              ⚠️ Alle bestehenden Presets werden beim Import ersetzt!
            </Alert>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <Button
              variant="contained"
              startIcon={<UploadFileIcon />}
              fullWidth
              sx={{ mb: 2 }}
              onClick={handleFileSelect}
            >
              JSON-Datei auswählen
            </Button>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {validationErrors.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'error.light' }}>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Validierungsfehler:
                </Typography>
                <List dense>
                  {validationErrors.map((err, idx) => (
                    <ListItem key={idx} sx={{ py: 0.5 }}>
                      <Typography variant="caption" color="error">
                        • {err}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}

            {presets.length > 0 && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Gefundene Presets: {presets.length}
                </Typography>

                <List dense sx={{ maxHeight: 300, overflow: 'auto', mt: 2 }}>
                  {presets.map((preset) => (
                    <ListItem key={preset.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>
                          {preset.mainTitle}
                        </Typography>
                        {getTotalSubPresetsCount(preset) > 0 && (
                          <Chip
                            label={`${getTotalSubPresetsCount(preset)} Varianten`}
                            size="small"
                            color="primary"
                          />
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
              Lege fest, welche Presets gruppiert werden sollen. Ohne Zuordnung wird jedes
              Preset ein eigener Effekt. Mit Zuordnung wird ein Preset zur Variante eines
              anderen Presets.
            </Alert>

            <List sx={{ maxHeight: 500, overflow: 'auto' }}>
              {presets.map((preset) => (
                <ListItem key={preset.id} sx={{ display: 'block', mb: 2 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                        {preset.mainTitle}
                      </Typography>
                      {isParent(preset.id) && (
                        <Chip label="Parent" size="small" color="primary" />
                      )}
                      {preset.parentKey && (
                        <Chip label="Variante" size="small" color="secondary" />
                      )}
                      {getTotalSubPresetsCount(preset) > 0 && (
                        <Chip
                          label={`${getTotalSubPresetsCount(preset)} Sub-Varianten`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    <FormControl fullWidth size="small">
                      <InputLabel>Zugehörigkeit</InputLabel>
                      <Select
                        value={preset.parentKey}
                        onChange={(e) => handleParentChange(preset.id, e.target.value)}
                        label="Zugehörigkeit"
                        disabled={isParent(preset.id)} // Parents können keine Children sein
                      >
                        <MenuItem value="">
                          <em>Keine – Eigener Effekt</em>
                        </MenuItem>
                        {getAvailableParents(preset.id).map((parent) => (
                          <MenuItem key={parent.id} value={parent.id}>
                            {parent.mainTitle}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {isParent(preset.id) && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1, display: 'block' }}
                      >
                        Wird als Haupt-Effekt angelegt (hat weitere Varianten zugeordnet)
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
          <Button onClick={handleNext} variant="contained" disabled={!canProceedToNext}>
            Weiter
          </Button>
        )}
        {activeStep === 1 && (
          <Button onClick={handleUpload} variant="contained">
            {presets.length} Preset(s) importieren
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

