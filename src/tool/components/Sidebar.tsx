'use client';

import React from 'react';
import { FORMAT_LABELS, CASINGS } from '../ui-shared';
import { type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange }) => {
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="mac-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Casing</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {CASINGS.map((c) => (
            <li key={c.value} className="flex justify-between gap-2">
              <button
                type="button"
                data-testid={`sidebar-casing-${c.value}`}
                onClick={() => onChange({ ...state, casing: c.value })}
                className={state.casing === c.value ? 'font-semibold underline' : ''}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Output styles</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {Object.entries(FORMAT_LABELS).map(([key, label]) => (
            <li key={key}>{label}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Saved conversions</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current input and casing; open
          it to restore this state.
        </p>
      </div>
    </div>
  );
};
