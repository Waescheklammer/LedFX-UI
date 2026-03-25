import React, { useState, useEffect } from 'react';
import { Box, IconButton, Typography, Paper, List, ListItem, ListItemText } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getAutopilotStatus } from '../api/ledfxClient';

interface LogEntry {
  id: string;
  timestamp: Date;
  phase: string;
  scene?: string;  // Neu: Aktivierte Scene
}

interface AutopilotLogSidebarProps {
  isRunning: boolean;
}

const MAX_LOGS = 30;

export const AutopilotLogSidebar: React.FC<AutopilotLogSidebarProps> = ({ isRunning }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Polling alle 1 Sekunde für die Phase – NUR wenn Autopilot läuft
  useEffect(() => {
    if (!isRunning) return;

    const fetchPhase = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const status = await getAutopilotStatus();
        
        // Nur neuen Log erstellen wenn Phase UND Scene vorhanden sind
        const phase = status.current_phase || status.phase;
        const scene = status.current_scene;
        
        if (phase) {
          setLogs(prevLogs => {
            // Prüfe ob letzter Log identisch ist (verhindert Duplikate)
            const lastLog = prevLogs[0];
            if (lastLog && lastLog.phase === phase && lastLog.scene === scene) {
              return prevLogs;  // Keine Änderung
            }

            const newLog: LogEntry = {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              phase: phase,
              scene: scene || undefined,
            };
            
            return [newLog, ...prevLogs].slice(0, MAX_LOGS);
          });
        }
      } catch (error) {
        console.warn('Phase Polling Fehler:', error);
      }
    };

    const intervalId = setInterval(fetchPhase, 1000);

    return () => clearInterval(intervalId);
  }, [isRunning]);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getPhaseColor = (phase: string): string => {
    const phaseLower = phase.toLowerCase();
    if (phaseLower.includes('silence')) return '#9e9e9e';  // Grau
    if (phaseLower.includes('build') || phaseLower.includes('buildup')) return '#ff9800';  // Orange
    if (phaseLower.includes('bass') || phaseLower.includes('hard')) return '#f44336';  // Rot
    return '#2196f3';  // Blau (default)
  };

  return (
    <>
      {/* Sidebar */}
      <Box
        sx={{
          position: 'fixed',
          right: 0,
          top: 64, // Unterhalb der Navbar
          height: 'calc(100vh - 64px)',
          width: isOpen ? 350 : 0,
          backgroundColor: 'background.paper',
          boxShadow: isOpen ? '-4px 0 8px rgba(0,0,0,0.1)' : 'none',
          transition: 'width 0.3s ease-in-out',
          overflow: 'hidden',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          <Typography variant="h6">Autopilot Logs</Typography>
          <Typography variant="caption">
            {logs.length} {logs.length === 1 ? 'Eintrag' : 'Einträge'}
          </Typography>
        </Box>

        {/* Log Liste */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
          {logs.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Keine Logs vorhanden
              </Typography>
            </Box>
          ) : (
            <List dense>
              {logs.map((log) => (
                <ListItem
                  key={log.id}
                  sx={{
                    mb: 0.5,
                    backgroundColor: 'background.default',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: `4px solid ${getPhaseColor(log.phase)}`,
                  }}
                >
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="body2" fontWeight={600} sx={{ color: getPhaseColor(log.phase) }}>
                          {log.phase}
                        </Typography>
                        {log.scene && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            → {log.scene}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={formatTime(log.timestamp)}
                    secondaryTypographyProps={{
                      variant: 'caption',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Box>

      {/* Toggle Button */}
      <Box
        sx={{
          position: 'fixed',
          right: isOpen ? 350 : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          transition: 'right 0.3s ease-in-out',
          zIndex: 1001,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: '8px 0 0 8px',
            overflow: 'hidden',
          }}
        >
          <IconButton
            onClick={toggleSidebar}
            sx={{
              color: 'inherit',
              borderRadius: 0,
              width: 32,
              height: 64,
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {isOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Paper>
      </Box>
    </>
  );
};
