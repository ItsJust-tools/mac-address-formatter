'use client';

import React from 'react';
import { runBatch, type Casing, type ToolState } from '../types';
import { FORMAT_LABELS } from '../ui-shared';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

function CopyButton({ value, testid }: { value: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Copy value"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onSaveHistory }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const batch = runBatch(state.input, state.casing);

  const toggleCasing = () => update({ casing: state.casing === 'upper' ? 'lower' : 'upper' });

  const primaryOutput = batch.results[0]?.outputs?.colon ?? null;

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="mac-canvas">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Casing">
        {(['upper', 'lower'] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={state.casing === c}
            data-testid={`casing-${c}`}
            onClick={() => update({ casing: c })}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              state.casing === c
                ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-900/40 dark:text-violet-100'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
            }`}
          >
            {c === 'upper' ? 'Uppercase' : 'Lowercase'}
          </button>
        ))}
        <button
          type="button"
          data-testid="btn-toggle-casing"
          onClick={toggleCasing}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Toggle case
        </button>
      </div>

      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
        MAC addresses (one per line)
        <textarea
          value={state.input}
          onChange={(e) => update({ input: e.target.value })}
          data-testid="input-mac"
          rows={4}
          spellCheck={false}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          placeholder={'AA:BB:CC:DD:EE:FF\naa-bb-cc-dd-ee-ff\naabb.ccdd.eeff'}
        />
      </label>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Results
        </h3>
        {batch.results.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="batch-empty">
            Enter at least one MAC address.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="batch-results">
            {batch.results.map((r) => (
              <li
                key={r.line}
                className="rounded-md border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                data-testid={`result-line-${r.line}`}
              >
                {r.error ? (
                  <p
                    className="text-xs text-red-600 dark:text-red-400"
                    data-testid={`error-${r.line}`}
                  >
                    Line {r.line}: {r.error}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Line {r.line} —{' '}
                      {r.mac && FORMAT_LABELS[r.mac] ? FORMAT_LABELS[r.mac] : 'detected'}
                    </p>
                    {Object.entries(r.outputs ?? {}).map(([fmt, value]) => (
                      <div key={fmt} className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className="font-mono text-gray-900 dark:text-gray-100"
                          data-testid={`out-${r.line}-${fmt}`}
                        >
                          {value}
                        </span>
                        <CopyButton value={value} testid={`copy-${r.line}-${fmt}`} />
                      </div>
                    ))}
                    {r.info ? (
                      <p
                        className="text-gray-600 dark:text-gray-300"
                        data-testid={`info-${r.line}`}
                      >
                        OUI {r.info.oui} — {r.info.unicast ? 'unicast' : 'multicast'},{' '}
                        {r.info.universal ? 'universally administered' : 'locally administered'}
                      </p>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400" data-testid="batch-summary">
          {batch.ok} converted, {batch.errors} error{batch.errors === 1 ? '' : 's'}
        </p>
        {primaryOutput && onSaveHistory ? (
          <button
            type="button"
            data-testid="btn-save-history"
            onClick={() => onSaveHistory(primaryOutput)}
            className="mt-3 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Save primary to history
          </button>
        ) : null}
      </div>

      {state.history.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            History
          </h3>
          <ul className="space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs dark:border-gray-800"
              >
                <span className="font-mono text-gray-700 dark:text-gray-300">{entry.text}</span>
                <CopyButton value={entry.text} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
          No saved conversions yet.
        </p>
      )}

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All conversions run locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};
