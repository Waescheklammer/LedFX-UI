import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { Preset } from '../types';

interface DeleteEffectDialogProps {
  open: boolean;
  onClose: () => void;
  onDelete: (presetId: string, variantId?: string) => void;
  presets: Preset[];
}

export const DeleteEffectDialog: React.FC<DeleteEffectDialogProps> = ({
  open,
  onClose,
  onDelete,
  presets,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);
  const showVariantSelect = selectedPreset && selectedPreset.subPresets.length > 0;

  const handleDelete = () => {
    if (selectedPresetId) {
      onDelete(selectedPresetId, selectedVariantId || undefined);
      setSelectedPresetId('');
      setSelectedVariantId('');
      onClose();
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    setSelectedVariantId(''); // Reset Varianten-Auswahl
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Effekt entfernen</DialogTitle>
      <DialogContent>
        <FormControl fullWidth variant="outlined" sx={{ mb: 2, mt: 1 }}>
          <InputLabel>Kachel auswählen</InputLabel>
          <Select
            value={selectedPresetId}
            onChange={(e: any) => handlePresetChange(e.target.value)}
            label="Kachel auswählen"
          >
            <MenuItem value="">
              <em>Bitte wählen...</em>
            </MenuItem>
            {presets.map((preset) => (
              <MenuItem key={preset.id} value={preset.id}>
                {preset.mainTitle} - {preset.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {showVariantSelect && (
          <FormControl fullWidth variant="outlined">
            <InputLabel>Variante entfernen (Optional)</InputLabel>
            <Select
              value={selectedVariantId}
              onChange={(e: any) => setSelectedVariantId(e.target.value)}
              label="Variante entfernen (Optional)"
            >
              <MenuItem value="">
                <em>Gesamte Kachel löschen</em>
              </MenuItem>
              {selectedPreset.subPresets.map((variant) => (
                <MenuItem key={variant.id} value={variant.id}>
                  {variant.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Ohne Auswahl wird die gesamte Kachel gelöscht. Mit Auswahl wird nur
              die Variante entfernt.
            </FormHelperText>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={!selectedPresetId}
        >
          Löschen
        </Button>
      </DialogActions>
    </Dialog>
  );
};
