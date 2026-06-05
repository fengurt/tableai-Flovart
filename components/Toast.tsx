import React from 'react';
import { Z } from '../utils/zLayers';
import type { ToastItem } from '../hooks/useToast';

const LEVEL_STYLES: Record<ToastItem['level'], { bg: string; border: string; text: string; mark: string }> = {
  info:    { bg: 'bg-[var(--accent-bg)]', border: 'border-[var(--accent-text)]', text: 'text-[var(--accent-text)]', mark: 'INFO' },
  success: { bg: 'bg-green-50', border: 'border-green-700', text: 'text-green-800', mark: 'OK' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-700', text: 'text-yellow-800', mark: 'WARN' },
  error:   { bg: 'bg-red-50', border: 'border-red-700', text: 'text-red-800', mark: 'ERR' },
};

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export default function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none"
      style={{ zIndex: Z.notification }}
    >
      {toasts.map(t => {
        const s = LEVEL_STYLES[t.level];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-lg animate-fade-in items-center border p-3 ${s.bg} ${s.border} ${s.text}`}
          >
            <span className="mr-2 font-mono text-[10px] font-semibold tracking-[0.14em]">{s.mark}</span>
            <span className="flex-grow text-sm">{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              className="ml-4 p-1 hover:opacity-70"
              aria-label="close"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
