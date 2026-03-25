import React from 'react';
import { Paper, Stack, Typography, Button, Slide } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import { useMigrationsStore } from '../../store/migrationsStore';
import { useAppStore } from '../../store/appStore';
import toast from 'react-hot-toast';

const MigrationActionBar = () => {
  const selectedStatements = useMigrationsStore((s) => s.selectedStatements);
  const deselectAll = useMigrationsStore((s) => s.deselectAll);
  const getSelectedSQL = useMigrationsStore((s) => s.getSelectedSQL);

  const selectedCount = selectedStatements.size;

  if (selectedCount === 0) return null;

  const handleCopy = () => {
    const sql = getSelectedSQL();
    if (sql) {
      navigator.clipboard.writeText(sql);
      toast.success(`Copied ${selectedCount} selected statement(s)`);
    }
  };

  const handleRunOnDbManager = () => {
    const sql = getSelectedSQL();
    if (!sql) {
      toast('No statements selected');
      return;
    }
    useAppStore.getState().setCurrentQuery(sql);
    useAppStore.getState().setManagerMode('db');
    toast.success(`${selectedCount} statement(s) loaded into DB Manager`);
  };

  return (
    <Slide direction="up" in={selectedCount > 0} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          px: 3,
          py: 1.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'warning.main',
          zIndex: 1200,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selectedCount} {selectedCount === 1 ? 'query' : 'queries'} selected
          </Typography>
          <Button
            size="small"
            variant="contained"
            color="warning"
            startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
            onClick={handleCopy}
          >
            Copy Selected
          </Button>
          <Button
            size="small"
            variant="contained"
            color="success"
            startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
            onClick={handleRunOnDbManager}
          >
            Run on DB Manager
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CheckBoxOutlineBlankIcon sx={{ fontSize: 14 }} />}
            onClick={deselectAll}
          >
            Clear Selection
          </Button>
        </Stack>
      </Paper>
    </Slide>
  );
};

export default React.memo(MigrationActionBar);
