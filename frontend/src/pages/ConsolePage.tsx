import { useEffect, useState, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Grid,
  Button,
  Stack,
  Skeleton,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import KeyboardCommandKeyIcon from '@mui/icons-material/KeyboardCommandKey';
import { motion, AnimatePresence } from 'framer-motion';
import { authAPI, schemaAPI } from '../services/api';
import { useAppStore } from '../store/appStore';
import toast from 'react-hot-toast';
import SQLEditor from '../components/Editor/SQLEditor';
import DatabaseSelector from '../components/Selector/DatabaseSelector';
import ResultsPanel from '../components/Results/ResultsPanel';
import QueryHistory from '../components/History/QueryHistory';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import CommandPalette from '../components/CommandPalette/CommandPalette';
import type { QueryResponse, RedisCommandResponse } from '../types';
import { format } from 'sql-formatter';

// Lazy load Redis components — only loaded when user switches to Redis mode
const RedisCommandForm = lazy(() => import('../components/Redis/RedisCommandForm'));
const RedisResultsPanel = lazy(() => import('../components/Redis/RedisResultsPanel'));
const RedisCacheClearer = lazy(() => import('../components/Redis/RedisCacheClearer'));
const RedisHistory = lazy(() => import('../components/Redis/RedisHistory'));

const RedisFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
    <CircularProgress size={28} />
  </Box>
);

const ConsolePage = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const {
    user,
    setUser,
    showHistory,
    setShowHistory,
    setCurrentQuery,
    currentQuery,
    managerMode,
    setManagerMode,
    isExecuting,
    selectedDatabase,
    setSelectedDatabase,
    editorHeight,
    setEditorHeight,
    executeRef,
    cancelRef,
  } = useAppStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [currentResult, setCurrentResult] = useState<QueryResponse | null>(null);
  const [redisResult, setRedisResult] = useState<RedisCommandResponse | null>(null);
  const [refreshingConfig, setRefreshingConfig] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [databaseOptions, setDatabaseOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const resultsPanelRef = useRef<HTMLDivElement>(null);
  const redisResultsPanelRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const dbTabRef = useRef<HTMLDivElement>(null);
  const redisTabRef = useRef<HTMLDivElement>(null);
  const pillContainerRef = useRef<HTMLDivElement>(null);

  // Auto-collapse history on mobile
  useEffect(() => {
    if (isMobile && showHistory) {
      setShowHistory(false);
    }
  }, [isMobile]);

  // Measure actual tab widths for pill indicator
  useEffect(() => {
    const activeRef = managerMode === 'db' ? dbTabRef.current : redisTabRef.current;
    const container = pillContainerRef.current;
    if (!activeRef || !container) return;
    const containerRect = container.getBoundingClientRect();
    const tabRect = activeRef.getBoundingClientRect();
    setPillStyle({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    });
  }, [managerMode]);

  // Fetch database options for command palette
  useEffect(() => {
    const fetchDbs = async () => {
      try {
        const config = await schemaAPI.getConfiguration();
        setDatabaseOptions(
          config.primary.databases.map((db: any) => ({ value: db.name, label: db.label }))
        );
      } catch {
        // Ignore
      }
    };
    fetchDbs();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authAPI.getCurrentUser();
        setUser(currentUser);
      } catch {
        navigate('/login');
      }
    };
    checkAuth();
  }, []);

  // Resizable editor handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = e.clientY - resizeRef.current.startY;
      const newHeight = Math.max(200, Math.min(800, resizeRef.current.startHeight + delta));
      setEditorHeight(newHeight);
    };
    const handleMouseUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
        setIsDragging(false);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setEditorHeight]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    resizeRef.current = { startY: e.clientY, startHeight: editorHeight };
    setIsDragging(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [editorHeight]);

  const handleResizeDoubleClick = useCallback(() => {
    setEditorHeight(400);
  }, [setEditorHeight]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
      setCurrentQuery('');
      navigate('/login');
      toast.success('Logged out successfully');
    } catch {
      toast.error('Logout failed');
    }
  };

  const handleRefreshConfig = async () => {
    setRefreshingConfig(true);
    try {
      schemaAPI.clearCache();
      await schemaAPI.getConfiguration();
      toast.success('Configuration refreshed successfully!');
      window.location.reload();
    } catch {
      toast.error('Failed to refresh configuration');
    } finally {
      setRefreshingConfig(false);
    }
  };

  const handleQueryExecute = useCallback((result: QueryResponse) => {
    setCurrentResult(result);
    setTimeout(() => {
      resultsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }, []);

  const handleRedisResult = useCallback((result: RedisCommandResponse) => {
    setRedisResult(result);
    setTimeout(() => {
      redisResultsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }, []);

  // Keyboard shortcut handlers
  const handleFormatSQL = useCallback(() => {
    try {
      if (!currentQuery.trim()) return;
      const formatted = format(currentQuery, {
        language: 'postgresql',
        tabWidth: 2,
        keywordCase: 'upper',
        linesBetweenQueries: 2,
      });
      setCurrentQuery(formatted);
      toast.success('SQL formatted');
    } catch {
      toast.error('Failed to format SQL');
    }
  }, [currentQuery, setCurrentQuery]);

  const handleExecuteShortcut = useCallback(() => {
    executeRef.current?.();
  }, [executeRef]);

  const handleCancelShortcut = useCallback(() => {
    cancelRef.current?.();
  }, [cancelRef]);

  const shortcutHandlers = useMemo(() => ({
    onExecute: handleExecuteShortcut,
    onFormat: handleFormatSQL,
    onToggleHistory: () => setShowHistory(!showHistory),
    onCancel: handleCancelShortcut,
    onCommandPalette: () => setCommandPaletteOpen(true),
  }), [handleExecuteShortcut, handleFormatSQL, showHistory, setShowHistory, handleCancelShortcut]);

  useKeyboardShortcuts(shortcutHandlers);

  if (!user) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#0A0A0F' }}>
        <Skeleton variant="rectangular" height={48} />
        <Box sx={{ p: 3 }}>
          <Skeleton variant="rounded" height={60} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={300} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecute={handleExecuteShortcut}
        onFormat={handleFormatSQL}
        onCancel={handleCancelShortcut}
        onToggleHistory={() => setShowHistory(!showHistory)}
        onSwitchMode={(mode) => setManagerMode(mode)}
        onNavigateUsers={() => navigate('/users')}
        onSelectDatabase={(db) => setSelectedDatabase(db)}
        databases={databaseOptions}
        currentMode={managerMode}
        isExecuting={isExecuting}
        isMaster={user.role === 'MASTER'}
      />

      {/* Compact AppBar */}
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ minHeight: 48 }}>
          <Typography variant="h6" component="div" noWrap sx={{ fontSize: '1rem' }}>
            {managerMode === 'db' ? 'Dual DB Manager' : 'Redis Manager'}
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {/* Animated pill toggle */}
          <Box
            ref={pillContainerRef}
            sx={{
              display: 'flex',
              bgcolor: 'rgba(255,255,255,0.06)',
              borderRadius: '20px',
              p: '3px',
              position: 'relative',
            }}
          >
            {(['db', 'redis'] as const).map((mode) => (
              <Box
                key={mode}
                ref={mode === 'db' ? dbTabRef : redisTabRef}
                onClick={() => setManagerMode(mode)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: '17px',
                  cursor: 'pointer',
                  position: 'relative',
                  zIndex: 1,
                  color: managerMode === mode ? '#fff' : 'rgba(255,255,255,0.5)',
                  transition: 'color 0.2s',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  userSelect: 'none',
                }}
              >
                {mode === 'db' ? <StorageIcon sx={{ fontSize: 16 }} /> : <MemoryIcon sx={{ fontSize: 16 }} />}
                {mode === 'db' ? 'DB' : 'Redis'}
              </Box>
            ))}
            {/* Sliding indicator */}
            <motion.div
              layoutId="mode-indicator"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                position: 'absolute',
                top: 3,
                left: pillStyle.left || 3,
                width: pillStyle.width || '50%',
                height: 'calc(100% - 6px)',
                borderRadius: 17,
                background: 'rgba(108, 142, 239, 0.3)',
                border: '1px solid rgba(108, 142, 239, 0.4)',
              }}
            />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={1} alignItems="center">
            {user.role === 'MASTER' && (
              <Button
                color="inherit"
                startIcon={<PeopleIcon />}
                onClick={() => navigate('/users')}
                size="small"
              >
                Users
              </Button>
            )}

            <Button
              color="inherit"
              startIcon={<HistoryIcon />}
              onClick={() => setShowHistory(!showHistory)}
              size="small"
            >
              History
              <Typography
                component="span"
                sx={{
                  ml: 0.5,
                  fontSize: '0.6rem',
                  color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'monospace',
                }}
              >
                ⌘H
              </Typography>
            </Button>

            <IconButton
              size="small"
              onClick={() => setCommandPaletteOpen(true)}
              sx={{ color: 'rgba(255,255,255,0.6)' }}
              title="Command Palette (⌘K)"
            >
              <KeyboardCommandKeyIcon sx={{ fontSize: 18 }} />
            </IconButton>

            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ p: 0 }}
            >
              <Avatar
                alt={user.name}
                src={user.picture}
                sx={{ width: 28, height: 28 }}
              />
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              <MenuItem disabled>
                <Box>
                  <Typography variant="subtitle2">{user.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem
                onClick={() => { handleRefreshConfig(); setAnchorEl(null); }}
                disabled={refreshingConfig}
              >
                <RefreshIcon fontSize="small" sx={{ mr: 1 }} />
                {refreshingConfig ? 'Refreshing...' : 'Refresh Config'}
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <AnimatePresence mode="wait">
              {managerMode === 'db' ? (
                <motion.div
                  key="db"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  <Grid container spacing={2} sx={{ flexGrow: 1, overflow: 'hidden' }}>
                    <Grid item xs={12} md={showHistory ? 8 : 12} sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <Box sx={{ overflowY: 'auto', flex: 1 }}>
                        <Stack spacing={2} sx={{ p: 1 }}>
                          <DatabaseSelector onExecute={handleQueryExecute} />

                          {/* Resizable SQL Editor */}
                          <Box sx={{ height: editorHeight, position: 'relative' }}>
                            <SQLEditor />
                            {/* Drag handle */}
                            <Box
                              onMouseDown={handleResizeStart}
                              onDoubleClick={handleResizeDoubleClick}
                              sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: 6,
                                cursor: 'row-resize',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                transition: 'background-color 0.15s, box-shadow 0.15s',
                                bgcolor: isDragging ? 'rgba(108, 142, 239, 0.25)' : 'transparent',
                                boxShadow: isDragging ? '0 0 8px rgba(108, 142, 239, 0.4)' : 'none',
                                '&:hover': { bgcolor: 'rgba(108, 142, 239, 0.2)' },
                                '&::after': {
                                  content: '""',
                                  width: 40,
                                  height: 3,
                                  borderRadius: 2,
                                  bgcolor: isDragging ? 'rgba(108, 142, 239, 0.6)' : 'rgba(255,255,255,0.15)',
                                  transition: 'background-color 0.15s',
                                },
                              }}
                            />
                          </Box>

                          {currentResult && (
                            <motion.div
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <Box ref={resultsPanelRef}>
                                <ResultsPanel result={currentResult} />
                              </Box>
                            </motion.div>
                          )}
                        </Stack>
                      </Box>
                    </Grid>

                    {showHistory && !isMobile && (
                      <Grid item xs={12} md={4} sx={{ height: '100%' }}>
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ height: '100%' }}
                        >
                          <QueryHistory />
                        </motion.div>
                      </Grid>
                    )}
                  </Grid>
                </motion.div>
              ) : (
                <motion.div
                  key="redis"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  <Grid container spacing={2} sx={{ flexGrow: 1, overflow: 'hidden' }}>
                    <Grid item xs={12} md={showHistory ? 8 : 12} sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <Box sx={{ overflowY: 'auto', flex: 1 }}>
                        <Stack spacing={2} sx={{ p: 1 }}>
                          <Suspense fallback={<RedisFallback />}>
                            <RedisCommandForm onResult={handleRedisResult} />
                          </Suspense>

                          {redisResult && (
                            <motion.div
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <Box ref={redisResultsPanelRef}>
                                <Suspense fallback={<RedisFallback />}>
                                  <RedisResultsPanel result={redisResult} />
                                </Suspense>
                              </Box>
                            </motion.div>
                          )}

                          <Suspense fallback={<RedisFallback />}>
                            <RedisCacheClearer />
                          </Suspense>
                        </Stack>
                      </Box>
                    </Grid>

                    {showHistory && !isMobile && (
                      <Grid item xs={12} md={4} sx={{ height: '100%' }}>
                        <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ height: '100%' }}
                        >
                          <Suspense fallback={<RedisFallback />}>
                            <RedisHistory />
                          </Suspense>
                        </motion.div>
                      </Grid>
                    )}
                  </Grid>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ConsolePage;
