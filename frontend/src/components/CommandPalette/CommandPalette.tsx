import { createPortal } from 'react-dom';
import { Command } from 'cmdk';
import { Box, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import StopIcon from '@mui/icons-material/Stop';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import HistoryIcon from '@mui/icons-material/History';
import PeopleIcon from '@mui/icons-material/People';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onExecute: () => void;
  onFormat: () => void;
  onCancel: () => void;
  onToggleHistory: () => void;
  onSwitchMode: (mode: 'db' | 'redis') => void;
  onNavigateUsers: () => void;
  onSelectDatabase: (db: string) => void;
  databases: Array<{ value: string; label: string }>;
  currentMode: 'db' | 'redis';
  isExecuting: boolean;
  isMaster: boolean;
}

const CommandPalette = ({
  open,
  onClose,
  onExecute,
  onFormat,
  onCancel,
  onToggleHistory,
  onSwitchMode,
  onNavigateUsers,
  onSelectDatabase,
  databases,
  currentMode,
  isExecuting,
  isMaster,
}: CommandPaletteProps) => {
  if (!open) return null;

  return createPortal(
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        pt: '20vh',
        bgcolor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: 520,
          maxHeight: 400,
          borderRadius: '12px',
          overflow: 'hidden',
          bgcolor: 'rgba(16, 16, 24, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        }}
      >
        <Command
          label="Command Palette"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        >
          <Box
            sx={{
              px: 2,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Command.Input
              placeholder="Type a command..."
              autoFocus
              style={{
                width: '100%',
                height: 48,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#e2e8f0',
                fontSize: '0.95rem',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </Box>

          <Command.List
            style={{
              maxHeight: 320,
              overflow: 'auto',
              padding: '8px',
            }}
          >
            <Command.Empty style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
              No results found.
            </Command.Empty>

            <Command.Group
              heading={
                <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', px: 1 }}>
                  Actions
                </Typography>
              }
            >
              {!isExecuting && (
                <CommandItem
                  icon={<PlayArrowIcon sx={{ fontSize: 18 }} />}
                  label="Execute Query"
                  shortcut="⌘↵"
                  onSelect={() => { onExecute(); onClose(); }}
                />
              )}
              {isExecuting && (
                <CommandItem
                  icon={<StopIcon sx={{ fontSize: 18 }} />}
                  label="Cancel Execution"
                  shortcut="Esc"
                  onSelect={() => { onCancel(); onClose(); }}
                />
              )}
              <CommandItem
                icon={<FormatAlignLeftIcon sx={{ fontSize: 18 }} />}
                label="Format SQL"
                shortcut="⌘⇧F"
                onSelect={() => { onFormat(); onClose(); }}
              />
            </Command.Group>

            <Command.Group
              heading={
                <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', px: 1 }}>
                  Navigation
                </Typography>
              }
            >
              <CommandItem
                icon={currentMode === 'db' ? <MemoryIcon sx={{ fontSize: 18 }} /> : <StorageIcon sx={{ fontSize: 18 }} />}
                label={currentMode === 'db' ? 'Switch to Redis Manager' : 'Switch to DB Manager'}
                onSelect={() => { onSwitchMode(currentMode === 'db' ? 'redis' : 'db'); onClose(); }}
              />
              <CommandItem
                icon={<HistoryIcon sx={{ fontSize: 18 }} />}
                label="Toggle History Panel"
                shortcut="⌘H"
                onSelect={() => { onToggleHistory(); onClose(); }}
              />
              {isMaster && (
                <CommandItem
                  icon={<PeopleIcon sx={{ fontSize: 18 }} />}
                  label="Manage Users"
                  onSelect={() => { onNavigateUsers(); onClose(); }}
                />
              )}
            </Command.Group>

            {databases.length > 0 && (
              <Command.Group
                heading={
                  <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', px: 1 }}>
                    Databases
                  </Typography>
                }
              >
                {databases.map((db) => (
                  <CommandItem
                    key={db.value}
                    icon={<StorageIcon sx={{ fontSize: 18 }} />}
                    label={db.label}
                    onSelect={() => { onSelectDatabase(db.value); onClose(); }}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </Box>
    </Box>,
    document.body
  );
};

const CommandItem = ({
  icon,
  label,
  shortcut,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onSelect: () => void;
}) => (
  <Command.Item
    onSelect={onSelect}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      borderRadius: 6,
      cursor: 'pointer',
      color: '#e2e8f0',
      fontSize: '0.875rem',
      fontFamily: 'Inter, sans-serif',
    }}
    // cmdk handles hover/active via [data-selected] attribute
  >
    <Box sx={{ color: '#64748b', display: 'flex' }}>{icon}</Box>
    <span style={{ flex: 1 }}>{label}</span>
    {shortcut && (
      <Typography
        variant="caption"
        sx={{
          color: '#475569',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          bgcolor: 'rgba(255,255,255,0.06)',
          px: 0.8,
          py: 0.2,
          borderRadius: 0.5,
        }}
      >
        {shortcut}
      </Typography>
    )}
  </Command.Item>
);

export default CommandPalette;
