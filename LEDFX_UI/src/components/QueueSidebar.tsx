import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { QueueItem } from '../types';

interface QueueSidebarProps {
  open: boolean;
  queue: QueueItem[];
  currentIndex: number;
  autoPlay: boolean;
  onToggleAutoPlay: () => void;
  onRemoveFromQueue: (itemId: string) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export const QueueSidebar: React.FC<QueueSidebarProps> = ({
  open,
  queue,
  currentIndex,
  autoPlay,
  onToggleAutoPlay,
  onRemoveFromQueue,
  onOpenSettings,
  onClose,
}) => {
  return (
    <Drawer
      anchor="right"
      open={open}
      variant="persistent"
      sx={{
        width: 320,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 320,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Warteschlange</Typography>
          <Box>
            <IconButton onClick={onOpenSettings} size="small">
              <SettingsIcon />
            </IconButton>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={autoPlay}
              onChange={onToggleAutoPlay}
              icon={<PauseIcon />}
              checkedIcon={<PlayArrowIcon />}
            />
          }
          label="Auto-Play"
        />

        <Divider sx={{ my: 2 }} />

        {queue.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Keine Effekte in der Warteschlange
          </Typography>
        ) : (
          <List>
            {queue.map((item, index) => (
              <ListItem
                key={item.id}
                sx={{
                  bgcolor: index === currentIndex ? 'action.selected' : 'transparent',
                  borderRadius: 1,
                  mb: 0.5,
                }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={() => onRemoveFromQueue(item.id)}
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={item.displayName}
                  secondary={
                    index === currentIndex && (
                      <Chip label="Aktuell" size="small" color="primary" sx={{ mt: 0.5 }} />
                    )
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
};
