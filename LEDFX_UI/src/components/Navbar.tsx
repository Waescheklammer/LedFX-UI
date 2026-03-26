import React, { useState, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  ButtonGroup,
  Box,
  Switch,
  CircularProgress,
  Chip,
  Popper,
  Paper,
  MenuList,
  MenuItem,
  ClickAwayListener,
  Grow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { AutopilotStatus } from '../types';

interface NavbarProps {
  onAddEffect: () => void;
  onDeleteEffect: () => void;
  onImport: () => void;
  onUploadPresets: () => void;
  onExportPresets: () => void;
  autopilotStatus: AutopilotStatus | null;
  autopilotLoading: boolean;
  onToggleAutopilot: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onAddEffect,
  onDeleteEffect,
  onImport,
  onUploadPresets,
  onExportPresets,
  autopilotStatus,
  autopilotLoading,
  onToggleAutopilot,
}) => {
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importAnchorRef = useRef<HTMLDivElement>(null);

  const isRunning = autopilotStatus?.state === 'running';
  const isUnavailable = autopilotStatus?.state === 'service_unavailable';

  const handleImportMenuToggle = () => {
    setImportMenuOpen((prevOpen) => !prevOpen);
  };

  const handleImportMenuClose = (event: Event | React.SyntheticEvent) => {
    if (
      importAnchorRef.current &&
      importAnchorRef.current.contains(event.target as HTMLElement)
    ) {
      return;
    }
    setImportMenuOpen(false);
  };

  const handleLedFxImport = () => {
    setImportMenuOpen(false);
    onImport();
  };

  const handleJsonUpload = () => {
    setImportMenuOpen(false);
    onUploadPresets();
  };

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
          Doomvault Lights Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            color="inherit"
            startIcon={<FileUploadIcon />}
            onClick={onExportPresets}
          >
            Export
          </Button>

          <ButtonGroup variant="text" ref={importAnchorRef} aria-label="import button group">
            <Button
              color="inherit"
              startIcon={<DownloadIcon />}
              onClick={handleLedFxImport}
            >
              Import
            </Button>
            <Button
              color="inherit"
              size="small"
              aria-controls={importMenuOpen ? 'import-menu' : undefined}
              aria-expanded={importMenuOpen ? 'true' : undefined}
              aria-haspopup="menu"
              onClick={handleImportMenuToggle}
            >
              <ArrowDropDownIcon />
            </Button>
          </ButtonGroup>

          <Popper
            open={importMenuOpen}
            anchorEl={importAnchorRef.current}
            role={undefined}
            placement="bottom-start"
            transition
            disablePortal
            style={{ zIndex: 1300 }}
          >
            {({ TransitionProps, placement }) => (
              <Grow
                {...TransitionProps}
                style={{
                  transformOrigin:
                    placement === 'bottom-start' ? 'left top' : 'left bottom',
                }}
              >
                <Paper>
                  <ClickAwayListener onClickAway={handleImportMenuClose}>
                    <MenuList id="import-menu" autoFocusItem>
                      <MenuItem onClick={handleLedFxImport}>
                        Von LedFX laden
                      </MenuItem>
                      <MenuItem onClick={handleJsonUpload}>
                        JSON hochladen
                      </MenuItem>
                    </MenuList>
                  </ClickAwayListener>
                </Paper>
              </Grow>
            )}
          </Popper>

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
