import React, { useState, useEffect } from 'react';
import { Box, IconButton, Typography, Paper, List, ListItem, ListItemText } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getAutopilotStatus } from '../api/ledfxClient';

interface LogEntry {
  id: string;
  timestamp: Date;
  phase: string;
}

const MAX_LOGS = 30;

export const AutopilotLogSidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Polling alle 1 Sekunde für die Phase
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchPhase = async () => {
      if (document.visibilityState !== 'visible') return;

      try {
        const status = await getAutopilotStatus();
        
        if (status.phase) {
          setLogs(prevLogs => {
            const newLog: LogEntry = {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              phase: status.phase,
            };
            
            // Füge neuen Log hinzu und behalte maximal MAX_LOGS
            const updatedLogs = [newLog, ...prevLogs].slice(0, MAX_LOGS);
            return updatedLogs;
          });
        }
      } catch (error) {
        console.warn('Phase Polling Fehler:', error);
      }
    };

    // Polling alle 1 Sekunde
    intervalId = setInterval(fetchPhase, 1000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

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
                  }}
                >
                  <ListItemText
                    primary={log.phase}
                    secondary={formatTime(log.timestamp)}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: 500,
                    }}
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

