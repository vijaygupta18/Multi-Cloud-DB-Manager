import { useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Box, Typography } from '@mui/material';
import { copyToClipboard } from '../utils/clipboard';

interface Column {
  key: string;
  label: string;
  width?: number;
}

interface VirtualizedTableProps {
  rows: Record<string, any>[];
  columns: Column[];
  height?: number;
  rowHeight?: number;
  wrapText?: boolean;
  onCellClick?: (value: any) => void;
  renderCell?: (value: any, column: string, row: Record<string, any>) => React.ReactNode;
}

const DEFAULT_ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const OVERSCAN = 10;
const DEFAULT_COL_MIN_WIDTH = 150;

const VirtualizedTable = ({ rows, columns, height = 400, rowHeight = DEFAULT_ROW_HEIGHT, wrapText = false, onCellClick, renderCell }: VirtualizedTableProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });

  const totalMinWidth = columns.reduce((sum, col) => sum + (col.width || DEFAULT_COL_MIN_WIDTH), 0);

  const handleCellClick = (value: any) => {
    if (onCellClick) {
      onCellClick(value);
    } else {
      copyToClipboard(value);
    }
  };

  const defaultRenderCell = (value: any) => {
    if (value === null || value === undefined) {
      return <em style={{ color: '#6b7280' }}>NULL</em>;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'auto' }}>
      <Box sx={{ minWidth: totalMinWidth }}>
      {/* Sticky header */}
      <Box
        sx={{
          display: 'flex',
          height: HEADER_HEIGHT,
          bgcolor: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        {columns.map((col) => (
          <Box
            key={col.key}
            sx={{
              flex: col.width ? `0 0 ${col.width}px` : 1,
              minWidth: col.width || DEFAULT_COL_MIN_WIDTH,
              px: 1.5,
              display: 'flex',
              alignItems: 'center',
              borderRight: '1px solid',
              borderColor: 'divider',
              '&:last-child': { borderRight: 'none' },
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontSize: '0.7rem',
                color: 'text.secondary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {col.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Virtualized rows */}
      <Box
        ref={parentRef}
        sx={{
          height: Math.min(height - HEADER_HEIGHT, rows.length * rowHeight),
          overflow: 'auto',
        }}
      >
        <Box sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <Box
                key={virtualRow.index}
                sx={{
                  display: 'flex',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: rowHeight,
                  transform: `translateY(${virtualRow.start}px)`,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  borderBottom: '1px solid',
                  borderColor: 'rgba(255,255,255,0.04)',
                }}
              >
                {columns.map((col) => (
                  <Box
                    key={col.key}
                    onClick={() => handleCellClick(row[col.key])}
                    sx={{
                      flex: col.width ? `0 0 ${col.width}px` : 1,
                      minWidth: col.width || DEFAULT_COL_MIN_WIDTH,
                      px: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      borderRight: '1px solid',
                      borderColor: 'rgba(255,255,255,0.02)',
                      '&:last-child': { borderRight: 'none' },
                      '&:hover': { bgcolor: 'rgba(108, 142, 239, 0.08)' },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.8rem',
                        overflow: wrapText ? 'visible' : 'hidden',
                        textOverflow: wrapText ? 'unset' : 'ellipsis',
                        whiteSpace: wrapText ? 'pre-wrap' : 'nowrap',
                        fontFamily: 'monospace',
                      }}
                    >
                      {renderCell ? renderCell(row[col.key], col.key, row) : defaultRenderCell(row[col.key])}
                    </Typography>
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      </Box>
      </Box>
    </Box>
  );
};

export default memo(VirtualizedTable);
