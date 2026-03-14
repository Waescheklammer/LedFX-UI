import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import { AppSettings } from '../types';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onClose,
  settings,
  onSave,
}) => {
  const [intervalSeconds, setIntervalSeconds] = useState(
    settings.queueInterval / 1000
  );

  const handleSave = () => {
    onSave({
      ...settings,
      queueInterval: intervalSeconds * 1000,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Einstellungen</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Warteschlangen-Intervall"
          type="number"
          fullWidth
          variant="outlined"
          value={intervalSeconds}
          onChange={(e) => setIntervalSeconds(Number(e.target.value))}
          InputProps={{
            endAdornment: <InputAdornment position="end">Sekunden</InputAdornment>,
          }}
          helperText="Zeit zwischen automatischen Effektwechseln"
          sx={{ mt: 2 }}
          inputProps={{ min: 1, max: 3600 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button onClick={handleSave} variant="contained">
          Speichern
        </Button>
      </DialogActions>
    </Dialog>
  );
};
