import { useEffect, useState } from 'react';
import { Box, Button, Chip, Paper, Stack, Tooltip, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CircleIcon from '@mui/icons-material/Circle';
import { useAppStore } from '../../store/appStore';
import { clickhouseAPI } from '../../services/api';
import toast from 'react-hot-toast';
import type { QueryResponse } from '../../types';

interface ClickhouseToolbarProps {
  onExecute: (response: QueryResponse) => void;
}

type ChStatus = 'unknown' | 'ok' | 'error' | 'disabled';

const statusColor: Record<ChStatus, 'default' | 'success' | 'error' | 'warning'> = {
  unknown: 'default',
  ok: 'success',
  error: 'error',
  disabled: 'warning',
};

const ClickhouseToolbar = ({ onExecute }: ClickhouseToolbarProps) => {
  const isExecuting = useAppStore(s => s.isExecuting);
  const setIsExecuting = useAppStore(s => s.setIsExecuting);
  const getQueryToExecute = useAppStore(s => s.getQueryToExecute);
  const executeRef = useAppStore(s => s.executeRef);
  const managerMode = useAppStore(s => s.managerMode);

  const [status, setStatus] = useState<ChStatus>('unknown');
  const [statusDetail, setStatusDetail] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    clickhouseAPI
      .getStatus()
      .then((s) => {
        if (cancelled) return;
        const next: ChStatus =
          s.status === 'ok' ? 'ok' : s.status === 'disabled' ? 'disabled' : 'error';
        setStatus(next);
        setStatusDetail(s.host ? `${s.host} / ${s.database}` : s.message || '');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExecute = async () => {
    const query = getQueryToExecute().trim();
    if (!query) {
      toast.error('Editor is empty');
      return;
    }
    if (status === 'disabled') {
      toast.error('ClickHouse is not configured on this server');
      return;
    }

    setIsExecuting(true);
    try {
      const response = await clickhouseAPI.executeQuery(query);
      onExecute(response);
      const cloud = response.clickhouse;
      if (cloud?.success) {
        toast.success(`Query OK (${cloud.duration_ms}ms)`);
      }
    } catch (err: any) {
      const data = err?.response?.data;
      if (data) onExecute(data);
    } finally {
      setIsExecuting(false);
    }
  };

  // Wire Cmd+Enter from SQLEditor. Gated on managerMode so each tab's toolbar
  // only owns the slot when its panel is active. Identity-checked cleanup
  // releases the slot only if we're still the current owner — avoids
  // clobbering a sibling that has already reclaimed.
  useEffect(() => {
    if (managerMode !== 'clickhouse') return;
    executeRef.current = handleExecute;
    return () => {
      if (executeRef.current === handleExecute) {
        executeRef.current = null;
      }
    };
  });

  return (
    <Paper elevation={1} sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          ClickHouse
        </Typography>

        <Tooltip title={statusDetail || status}>
          <Chip
            size="small"
            color={statusColor[status]}
            icon={<CircleIcon sx={{ fontSize: 10 }} />}
            label={
              status === 'ok' ? 'connected' :
              status === 'disabled' ? 'disabled' :
              status === 'error' ? 'unreachable' : 'checking…'
            }
            variant="outlined"
          />
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          variant="contained"
          color="primary"
          startIcon={<PlayArrowIcon />}
          onClick={handleExecute}
          disabled={isExecuting || status === 'disabled'}
        >
          {isExecuting ? 'Executing…' : 'Execute (⌘↵)'}
        </Button>
      </Stack>
    </Paper>
  );
};

export default ClickhouseToolbar;
