import { type Casing, type ToolState } from './types';

export const FORMAT_LABELS: Record<string, string> = {
  colon: 'Colon-separated (AA:BB:CC:DD:EE:FF)',
  hyphen: 'Hyphenated (AA-BB-CC-DD-EE-FF)',
  dot: 'Dotted (AABB.CCDD.EEFF)',
  cisco: 'Cisco dotted (A.B.C)',
  bare: 'Bare hex (AABBCCDDEEFF)',
};

export const CASINGS: { value: Casing; label: string }[] = [
  { value: 'upper', label: 'Uppercase' },
  { value: 'lower', label: 'Lowercase' },
];

export const SHORTCUTS = [
  { keys: 'C', description: 'Toggle casing' },
  { keys: 'Ctrl+C', description: 'Copy primary output' },
];

/** True when the value looks like a ToolState. */
export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.input === 'string' && (v.casing === 'upper' || v.casing === 'lower');
}
