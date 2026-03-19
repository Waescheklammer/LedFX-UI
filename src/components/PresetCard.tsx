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
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Preset } from '../types';

interface PresetCardProps {
  preset: Preset;
  onVariantChange: (presetId: string, variantId: string) => void;
  onManualEffectActivation: (effectName: string) => void;
}

export const PresetCard: React.FC<PresetCardProps> = ({
  preset,
  onVariantChange,
  onManualEffectActivation,
}) => {
  const [expanded, setExpanded] = useState(false);

  const handleCardClick = async () => {
    onManualEffectActivation(preset.effectName);
  };

  const handleVariantClick = async (
    event: React.MouseEvent,
    variantId: string
  ) => {
    event.stopPropagation();
    onVariantChange(preset.id, variantId);
    setExpanded(false);
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
