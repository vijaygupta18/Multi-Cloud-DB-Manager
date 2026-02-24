import { useEffect } from 'react';

interface ShortcutHandlers {
  onExecute?: () => void;
  onFormat?: () => void;
  onToggleHistory?: () => void;
  onCancel?: () => void;
  onCommandPalette?: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+Enter — Execute query
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        handlers.onExecute?.();
        return;
      }

      // Cmd+Shift+F — Format SQL
      if (isMod && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        handlers.onFormat?.();
        return;
      }

      // Cmd+H — Toggle history (only when not in input/editor)
      if (isMod && e.key === 'h') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          handlers.onToggleHistory?.();
          return;
        }
      }

      // Escape — Cancel execution
      if (e.key === 'Escape') {
        handlers.onCancel?.();
        return;
      }

      // Cmd+K — Command palette
      if (isMod && e.key === 'k') {
        e.preventDefault();
        handlers.onCommandPalette?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
};
