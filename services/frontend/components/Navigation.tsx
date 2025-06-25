import React from 'react';
import { AppBar, Toolbar, Typography, IconButton, Box, Tooltip, Button } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useRouter } from 'next/router';
import { useTheme } from '../contexts/ThemeContext';

const Navigation: React.FC = () => {
  const router = useRouter();
  const { mode, toggleTheme } = useTheme();

  const handleSettingsClick = () => {
    router.push('/settings');
  };

  const handleHomeClick = () => {
    router.push('/');
  };

  const handleAnalysisClick = () => {
    router.push('/analysis');
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={handleHomeClick}
        >
          eCFR Navigator
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            color="inherit"
            startIcon={<AssessmentIcon />}
            onClick={handleAnalysisClick}
            sx={{ textTransform: 'none' }}
          >
            Analysis
          </Button>
          <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton
              color="inherit"
              aria-label="toggle theme"
              onClick={toggleTheme}
            >
              {mode === 'light' ? <Brightness4Icon /> : <Brightness7Icon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton
              color="inherit"
              aria-label="settings"
              onClick={handleSettingsClick}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;