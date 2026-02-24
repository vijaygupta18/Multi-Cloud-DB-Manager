import { useState, useMemo, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Chip,
  Stack,
  IconButton,
  Tabs,
  Tab,
  Collapse,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VirtualizedTable from '../VirtualizedTable';
import { copyToClipboard } from '../../utils/clipboard';
import type { RedisCommandResponse, RedisCloudResult } from '../../types';

const GLOW_SUCCESS = '0 0 12px rgba(52, 211, 153, 0.4)';
const GLOW_ERROR = '0 0 12px rgba(248, 113, 113, 0.4)';

interface RedisResultsPanelProps {
  result: RedisCommandResponse | null;
}

const RedisResultsPanel = ({ result }: RedisResultsPanelProps) => {
  const [expandedClouds, setExpandedClouds] = useState<Record<string, boolean>>({});
  const [cloudTabs, setCloudTabs] = useState<Record<string, 'formatted' | 'json'>>({});

  const cloudResults = useMemo(() => {
    if (!result) return [];
    return Object.entries(result)
      .filter(([key]) => key !== 'id' && key !== 'success' && key !== 'command')
      .map(([cloudName, data]) => ({ cloudName, data: data as RedisCloudResult }));
  }, [result]);

  const isCloudExpanded = (cloudName: string) => expandedClouds[cloudName] !== false;
  const toggleCloud = (cloudName: string) => {
    setExpandedClouds((prev) => ({ ...prev, [cloudName]: !isCloudExpanded(cloudName) }));
  };
  const getTab = (cloudName: string) => cloudTabs[cloudName] || 'formatted';
  const setTab = (cloudName: string, tab: 'formatted' | 'json') => {
    setCloudTabs((prev) => ({ ...prev, [cloudName]: tab }));
  };

  if (!result) {
    return (
      <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Execute a Redis command to see results here
        </Typography>
      </Paper>
    );
  }

  const renderFormattedData = (data: any, _command: string) => {
    if (data === null || data === undefined) {
      return <Alert severity="info">Key not found (nil)</Alert>;
    }

    // Scalar values
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return (
        <Paper
          variant="outlined"
          onClick={() => copyToClipboard(data)}
          sx={{ p: 2, bgcolor: 'background.default', color: 'text.primary', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
        >
          <pre style={{ margin: 0, fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {String(data)}
          </pre>
        </Paper>
      );
    }

    // Array values
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return <Alert severity="info">Empty result (no elements)</Alert>;
      }

      // Stream/object results
      if (data[0] && typeof data[0] === 'object' && !Array.isArray(data[0])) {
        return (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', color: 'text.primary', maxHeight: 400, overflow: 'auto' }}>
            <pre style={{ margin: 0, fontSize: '0.875rem' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </Paper>
        );
      }

      // Simple list — virtualized
      const rows = data.map((item, i) => ({ _index: i, value: item }));
      return (
        <VirtualizedTable
          rows={rows}
          columns={[
            { key: '_index', label: '#', width: 60 },
            { key: 'value', label: 'Value' },
          ]}
          height={400}
          renderCell={(value, column) => {
            if (column === '_index') return String(value);
            if (value === null) return <em style={{ color: '#6b7280' }}>nil</em>;
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
          }}
        />
      );
    }

    // Hash/Object values
    if (typeof data === 'object') {
      const entries = Object.entries(data);
      if (entries.length === 0) {
        return <Alert severity="info">Empty hash (no fields)</Alert>;
      }

      const rows = entries.map(([field, value]) => ({ field, value }));
      return (
        <VirtualizedTable
          rows={rows}
          columns={[
            { key: 'field', label: 'Field' },
            { key: 'value', label: 'Value' },
          ]}
          height={400}
          renderCell={(value, column) => {
            if (typeof value === 'object' && value !== null) return JSON.stringify(value);
            return String(value ?? 'nil');
          }}
        />
      );
    }

    return <Alert severity="info">Unexpected result type</Alert>;
  };

  const renderCloudResult = (cloudName: string, data: RedisCloudResult) => {
    if (!data.success) {
      return (
        <Alert severity="error" icon={<ErrorIcon />}>
          <Typography variant="subtitle2">Execution Failed</Typography>
          <Typography variant="body2">{data.error}</Typography>
          <Typography variant="caption">Duration: {data.duration_ms}ms</Typography>
        </Alert>
      );
    }

    const tab = getTab(cloudName);

    return (
      <Box>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Chip icon={<CheckCircleIcon />} label="Success" color="success" size="medium" sx={{ boxShadow: GLOW_SUCCESS }} />
          <Chip
            label={`${data.duration_ms}ms`}
            color="default"
            variant="outlined"
            size="medium"
            sx={{ fontWeight: 600, fontSize: '0.875rem' }}
          />
        </Stack>

        <Tabs value={tab} onChange={(_, v) => setTab(cloudName, v)} sx={{ mb: 2 }}>
          <Tab label="Formatted" value="formatted" />
          <Tab label="JSON" value="json" />
        </Tabs>

        {tab === 'formatted' && renderFormattedData(data.data, result!.command)}

        {tab === 'json' && (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', color: 'text.primary', maxHeight: 400, overflow: 'auto' }}>
            <pre style={{ margin: 0, fontSize: '0.875rem' }}>
              {JSON.stringify(data.data, null, 2)}
            </pre>
          </Paper>
        )}
      </Box>
    );
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Redis Results — {result.command}
      </Typography>

      <Stack spacing={3}>
        {cloudResults.map(({ cloudName, data }, index) => {
          const expanded = isCloudExpanded(cloudName);
          const color = index === 0 ? 'primary.main' : index === 1 ? 'secondary.main' : 'info.main';

          return (
            <Box key={cloudName}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                onClick={() => toggleCloud(cloudName)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, p: 1, borderRadius: 1, mb: 1 }}
              >
                <IconButton size="small" sx={{ p: 0 }}>
                  {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <Typography variant="subtitle1" sx={{ color, fontWeight: 'bold' }}>
                  {cloudName.toUpperCase()} Results
                </Typography>
              </Stack>
              <Collapse in={expanded}>
                {renderCloudResult(cloudName, data)}
              </Collapse>
            </Box>
          );
        })}

        {cloudResults.length === 0 && (
          <Alert severity="info">No results available.</Alert>
        )}
      </Stack>
    </Paper>
  );
};

export default memo(RedisResultsPanel);
