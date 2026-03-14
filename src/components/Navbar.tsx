import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';

interface NavbarProps {
  onAddEffect: () => void;
  onDeleteEffect: () => void;
  onToggleQueue: () => void;
  queueOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onAddEffect,
  onDeleteEffect,
  onToggleQueue,
  queueOpen
}) => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          LedFx Presets
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
          <Button
            color="inherit"
            startIcon={<QueueMusicIcon />}
            onClick={onToggleQueue}
          >
            {queueOpen ? 'Queue ausblenden' : 'Queue anzeigen'}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
