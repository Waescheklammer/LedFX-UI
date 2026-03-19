import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Switch, CircularProgress, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { AutopilotStatus } from '../types';

interface NavbarProps {
  onAddEffect: () => void;
  onDeleteEffect: () => void;
  autopilotStatus: AutopilotStatus | null;
  autopilotLoading: boolean;
  onToggleAutopilot: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onAddEffect,
  onDeleteEffect,
  autopilotStatus,
  autopilotLoading,
  onToggleAutopilot,
}) => {
  const isRunning = autopilotStatus?.state === 'running';
  const isUnavailable = autopilotStatus?.state === 'service_unavailable';

  const getStatusText = () => {
    if (isUnavailable) return 'Service nicht verfügbar';
    return `Autopilot ${isRunning ? 'Aktiv' : 'Inaktiv'}`;
  };

  const getStatusColor = () => {
    if (isUnavailable) return '#ff9800'; // Orange für Warnung
    return isRunning ? '#4caf50' : 'rgba(255,255,255,0.7)';
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          LedFx Presets
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            color="inherit"
            startIcon={<AddIcon />}
            onClick={onAddEffect}
          >
            Neuer Effekt
          </Button>
          <Button
            color="inherit"
            startIcon={<DeleteIcon />}
            onClick={onDeleteEffect}
          >
            Effekt löschen
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            <Typography
              variant="body2"
              sx={{
                color: getStatusColor(),
                fontWeight: isRunning ? 'bold' : 'normal'
              }}
            >
              {getStatusText()}
            </Typography>

            {autopilotLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              <Switch
                checked={isRunning}
                onChange={onToggleAutopilot}
                disabled={autopilotLoading || isUnavailable}
                color="default"
              />
            )}

            {isRunning && autopilotStatus?.current_phase && (
              <Chip
                label={autopilotStatus.current_phase}
                size="small"
                color="success"
                sx={{ fontWeight: 'bold' }}
              />
            )}
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};


