import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { Preset } from '../types';

interface AddEffectDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, effectName: string, mainTitle?: string, parentPresetId?: string) => void;
  presets: Preset[];
}

export const AddEffectDialog: React.FC<AddEffectDialogProps> = ({
  open,
  onClose,
  onAdd,
  presets,
}) => {
  const [name, setName] = useState('');
  const [effectName, setEffectName] = useState('');
  const [mainTitle, setMainTitle] = useState('');
  const [parentPresetId, setParentPresetId] = useState<string>('');

  const handleSubmit = () => {
    if (name.trim() && effectName.trim()) {
      onAdd(
        name.trim(),
        effectName.trim(),
        mainTitle.trim() || undefined,
        parentPresetId || undefined
      );
      setName('');
      setEffectName('');
      setMainTitle('');
      setParentPresetId('');
      onClose();
    }
  };

  const isNewTile = !parentPresetId;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Neuen Effekt hinzufügen</DialogTitle>
      <DialogContent>
        <FormControl fullWidth variant="outlined" sx={{ mb: 2, mt: 1 }}>
          <InputLabel>Zugehörigkeit (Optional)</InputLabel>
          <Select
            value={parentPresetId}
            onChange={(e: any) => setParentPresetId(e.target.value)}
            label="Zugehörigkeit (Optional)"
          >
            <MenuItem value="">
              <em>Keine - Neue Kachel erstellen</em>
            </MenuItem>
            {presets.map((preset) => (
              <MenuItem key={preset.id} value={preset.id}>
                {preset.mainTitle} - {preset.name}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>
            Ohne Zugehörigkeit wird eine neue Kachel erstellt. Mit Zugehörigkeit
            wird der Effekt als Variante zu einer bestehenden Kachel hinzugefügt.
          </FormHelperText>
        </FormControl>

        {isNewTile && (
          <TextField
            margin="dense"
            label="Haupttitel (Kachel)"
            type="text"
            fullWidth
            variant="outlined"
            value={mainTitle}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMainTitle(e.target.value)}
            sx={{ mb: 2 }}
            helperText="Fester Titel für die Kachel (z.B. 'Wohnzimmer')"
          />
        )}

        <TextField
          autoFocus
          margin="dense"
          label={isNewTile ? "Varianten-Name (z.B. 'Standard')" : "Varianten-Name"}
          type="text"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />

        <TextField
          margin="dense"
          label="Effekt-Name (für API)"
          type="text"
          fullWidth
          variant="outlined"
          value={effectName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEffectName(e.target.value)}
          helperText="Name des Effekts, der an LedFx gesendet wird"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!name.trim() || !effectName.trim()}
        >
          Hinzufügen
        </Button>
      </DialogActions>
    </Dialog>
  );
};
