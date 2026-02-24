import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, CircularProgress, Box } from '@mui/material';
import { Toaster } from 'react-hot-toast';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ConsolePage = lazy(() => import('./pages/ConsolePage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));

const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#0A0A0F' }}>
    <CircularProgress sx={{ color: '#6C8EEF' }} />
  </Box>
);

// Premium dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6C8EEF',
      light: '#8FAAFF',
      dark: '#4A6BD6',
    },
    secondary: {
      main: '#A78BFA',
    },
    success: {
      main: '#34D399',
    },
    error: {
      main: '#F87171',
    },
    warning: {
      main: '#FBBF24',
    },
    background: {
      default: '#0A0A0F',
      paper: 'rgba(18, 18, 28, 0.8)',
    },
    text: {
      primary: '#E2E8F0',
      secondary: '#94A3B8',
    },
    divider: 'rgba(255, 255, 255, 0.06)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      letterSpacing: '-0.02em',
      fontWeight: 600,
    },
    subtitle1: {
      letterSpacing: '-0.01em',
    },
    caption: {
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0A0A0F',
          // Global dark scrollbar
          '& ::-webkit-scrollbar': {
            width: 8,
            height: 8,
          },
          '& ::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '& ::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 4,
          },
          '& ::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255,255,255,0.25)',
          },
          '& ::-webkit-scrollbar-corner': {
            background: 'transparent',
          },
          // cmdk item transition
          '& [cmdk-item]': {
            transition: 'background-color 0.15s ease',
          },
          // cmdk selected item styling
          '& [cmdk-item][data-selected="true"]': {
            backgroundColor: 'rgba(108, 142, 239, 0.15)',
            borderRadius: 6,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(18, 18, 28, 0.8)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(10, 10, 15, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0 0 20px rgba(108, 142, 239, 0.3)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: '#94A3B8',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(18, 18, 28, 0.95)',
          backdropFilter: 'blur(12px)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(18, 18, 28, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(18, 18, 28, 0.9)',
            backdropFilter: 'blur(12px)',
            color: '#E2E8F0',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            fontSize: '0.875rem',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#34D399',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#F87171',
              secondary: '#fff',
            },
          },
        }}
      />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ConsolePage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
