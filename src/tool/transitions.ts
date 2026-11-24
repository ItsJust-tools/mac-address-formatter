import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  type Casing,
  type HistoryEntry,
  type ToolState,
} from './types';

/** Active casing toggled to the opposite value. */
export function toggleCasing(casing: Casing): Casing {
  return casing === 'upper' ? 'lower' : 'upper';
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first. */
export function saveToHistory(state: ToolState, text: string, now = new Date()): ToolState {
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return { ...state, history: [entry, ...state.history].slice(0, MAX_HISTORY) };
}

/** Clear all saved conversions. */
export function clearHistory(state: ToolState): ToolState {
  return { ...state, history: [] };
}

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('tool state transitions', () => {
  it('toggles casing both ways', () => {
    expect(toggleCasing('upper')).toBe('lower');
    expect(toggleCasing('lower')).toBe('upper');
  });

  it('saves history entries newest first and caps at MAX_HISTORY', () => {
    let s = state();
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      s = saveToHistory(s, `entry-${i}`, new Date(2026, 0, 1, 0, 0, i));
    }
    expect(s.history).toHaveLength(MAX_HISTORY);
    expect(s.history[0]?.text).toBe(`entry-${MAX_HISTORY + 4}`);
    expect(s.history[MAX_HISTORY - 1]?.text).toBe('entry-5');
  });

  it('clearHistory empties the list', () => {
    const s = clearHistory(saveToHistory(state(), 'x'));
    expect(s.history).toHaveLength(0);
  });
});
