import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddToQueueIcon from '@mui/icons-material/AddToQueue';
import { Preset } from '../types';
import { activateEffect } from '../api/ledfxClient';

interface PresetCardProps {
  preset: Preset;
  onVariantChange: (presetId: string, variantId: string) => void;
  onAddToQueue: (presetId: string, variantId?: string) => void;
  onManualActivation: () => void;
}

export const PresetCard: React.FC<PresetCardProps> = ({
  preset,
  onVariantChange,
  onAddToQueue,
  onManualActivation
}) => {
  const [expanded, setExpanded] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleCardClick = async () => {
    try {
      await activateEffect(preset.effectName);
      console.log(`Aktiviere Preset: ${preset.effectName}`);
      onManualActivation(); // Auto-Play unterbrechen
    } catch (error) {
      console.error('Fehler beim Aktivieren des Presets:', error);
    }
  };

  const handleVariantClick = async (
    event: React.MouseEvent,
    variantId: string
  ) => {
    event.stopPropagation();
    onVariantChange(preset.id, variantId);
    onManualActivation(); // Auto-Play unterbrechen
    setExpanded(false);
  };

  const handleQueueMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleQueueMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAddToQueue = (variantId?: string) => {
    onAddToQueue(preset.id, variantId);
    handleQueueMenuClose();
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={handleCardClick} sx={{ flexGrow: 1 }}>
        <CardContent>
          <Typography
            variant="overline"
            component="div"
            textAlign="center"
            sx={{ color: 'text.secondary', mb: 1 }}
          >
            {preset.mainTitle}
          </Typography>
          <Typography variant="h6" component="div" textAlign="center">
            {preset.name}
          </Typography>
        </CardContent>
      </CardActionArea>

      {/* Queue-Button */}
      <Box sx={{ px: 2, pb: 1, display: 'flex', justifyContent: 'center', borderTop: 1, borderColor: 'divider' }}>
        <IconButton
          size="small"
          onClick={handleQueueMenuOpen}
          color="primary"
        >
          <AddToQueueIcon />
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleQueueMenuClose}
      >
        <MenuItem onClick={() => handleAddToQueue()}>
          {preset.name} (Aktuell)
        </MenuItem>
        {preset.subPresets.map((variant) => (
          <MenuItem key={variant.id} onClick={() => handleAddToQueue(variant.id)}>
            {variant.name}
          </MenuItem>
        ))}
      </Menu>

      {preset.subPresets.length > 0 && (
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Accordion
            expanded={expanded}
            onChange={(_event: React.SyntheticEvent, isExpanded: boolean) => setExpanded(isExpanded)}
            disableGutters
            elevation={0}
            sx={{
              backgroundColor: 'transparent',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ minHeight: 48 }}
            >
              <Typography variant="body2">Varianten</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <List dense>
                {preset.subPresets.map((subPreset) => (
                  <ListItem key={subPreset.id} disablePadding>
                    <ListItemButton
                      onClick={(e: React.MouseEvent) =>
                        handleVariantClick(e, subPreset.id)
                      }
                    >
                      <ListItemText primary={subPreset.name} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
    </Card>
  );
};
