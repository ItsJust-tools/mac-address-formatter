export type MacFormat = 'colon' | 'hyphen' | 'dot' | 'bare';

export type Casing = 'upper' | 'lower';

export interface ToolState {
  /** Raw multi-line user input; one MAC address per line. */
  input: string;
  /** Letter casing applied to all outputs. */
  casing: Casing;
  /** Saved conversions, newest first. */
  history: HistoryEntry[];
}

export interface HistoryEntry {
  /** Short human readable description of the conversion. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export const DEFAULT_STATE: ToolState = {
  input: 'AA:BB:CC:DD:EE:FF',
  casing: 'upper',
  history: [],
};

export const MAX_HISTORY = 20;

export const FORMAT_LABELS: Record<MacFormat, string> = {
  colon: 'Colon-separated',
  hyphen: 'Hyphenated',
  dot: 'Dotted (Cisco)',
  bare: 'Bare hex',
};

/** Split a raw line into cleaned hex tokens; empty tokens are dropped. */
export function hexTokens(line: string): string[] {
  return line
    .trim()
    .split(/[.:\-\s]+/)
    .filter((t) => t.length > 0);
}

/** Detect the notation a MAC string uses; null when unrecognized. */
export function detectFormat(line: string): MacFormat | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    return parts.length === 6 && parts.every((p) => p.length === 2 && isHex(p)) ? 'colon' : null;
  }
  if (/^[0-9A-Fa-f]{2}-/.test(trimmed)) {
    const parts = trimmed.split('-');
    return parts.length === 6 && parts.every((p) => p.length === 2 && isHex(p)) ? 'hyphen' : null;
  }
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length === 3 && parts.every((p) => p.length >= 1 && p.length <= 4 && isHex(p))) {
      return 'dot';
    }
    return null;
  }
  return isHex(trimmed) && trimmed.length === 12 ? 'bare' : null;
}

/** True when s is a non-empty hex string. */
export function isHex(s: string): boolean {
  return s.length > 0 && /^[0-9A-Fa-f]+$/.test(s);
}

/** Parse a line into normalized 2-digit hex octets; null on failure. */
export function parseMac(line: string): string[] | null {
  const tokens = hexTokens(line);
  if (tokens.length === 0) return null;
  // Bare 12-hex digit input without separators.
  const first = tokens[0] ?? '';
  if (tokens.length === 1 && (first.length === 12 || first.length === 16)) {
    const hex = first;
    if (!isHex(hex)) return null;
    const octets: string[] = [];
    for (let i = 0; i < hex.length; i += 2) octets.push(hex.slice(i, i + 2).toLowerCase());
    return octets;
  }
  if (tokens.length === 3) {
    const lens = tokens.map((t) => t.length);
    if (lens.every((l) => l >= 1 && l <= 4)) {
      const hex = tokens.join('');
      if (!isHex(hex) || hex.length > 12) return null;
      const padded = hex + '0'.repeat(12 - hex.length);
      return padded.match(/.{2}/g)!.map((o) => o.toLowerCase());
    }
  }
  if (tokens.length === 6 && tokens.every((t) => t.length === 2 && isHex(t))) {
    return tokens.map((t) => t.toLowerCase());
  }
  return null;
}

export interface MacInfo {
  unicast: boolean;
  universal: boolean;
  oui: string;
}

/** Analyze the first octet and OUI of a MAC given as 6 low-case octets. */
export function macInfo(octets: string[]): MacInfo {
  const first = parseInt(octets[0] ?? '00', 16);
  const unicast = (first & 0b1) === 0;
  const universal = (first & 0b10) === 0;
  return { unicast, universal, oui: octets.slice(0, 3).join(':') };
}

/** Build all four output styles from normalized octets. */
export function formatAll(octets: string[], casing: Casing): Record<MacFormat, string> {
  const norm = octets.map((o) => (casing === 'upper' ? o.toUpperCase() : o.toLowerCase()));
  const bare = norm.join('');
  const pick = (i: number): string => norm[i] ?? '00';
  return {
    colon: norm.join(':'),
    hyphen: norm.join('-'),
    dot: `${pick(0)}${pick(1)}.${pick(2)}${pick(3)}.${pick(4)}${pick(5)}`,
    bare,
  };
}

export interface LineResult {
  line: number;
  mac: MacFormat | null;
  error: string | null;
  octets: string[] | null;
}

/** Convert one batch line; error is a human message on failure. */
export function convertLine(line: string, lineNumber: number): LineResult {
  if (!line.trim()) {
    return { line: lineNumber, mac: null, error: null, octets: null };
  }
  const octets = parseMac(line);
  if (!octets) {
    return { line: lineNumber, mac: null, error: lineError(line), octets: null };
  }
  const mac = detectFormat(line);
  return { line: lineNumber, mac, error: null, octets };
}

export interface BatchResult {
  results: (LineResult & { outputs: Record<string, string> | null; info: MacInfo | null })[];
  ok: number;
  errors: number;
}

/** Convert all non-empty lines in the batch input. */
export function runBatch(input: string, casing: Casing): BatchResult {
  const lines = input.split('\n');
  const results = lines.map((line, idx) => {
    const r = convertLine(line, idx + 1);
    if (r.octets) {
      return {
        ...r,
        outputs: formatAll(r.octets, casing),
        info: macInfo(r.octets),
      };
    }
    return { ...r, outputs: null, info: null };
  });
  const ok = results.filter((r) => r.error === null && r.octets).length;
  const errors = results.filter((r) => r.error !== null).length;
  return { results, ok, errors };
}

/** Human-readable error message when a MAC line cannot be parsed. */
export function lineError(line: string): string {
  const tokens = hexTokens(line);
  const firstToken = tokens[0] ?? '';
  if (tokens.length === 1 && !isHex(firstToken)) {
    return 'Contains non-hex characters';
  }
  if (tokens.length === 1 && isHex(firstToken) && firstToken.length !== 12) {
    return `Expected 12 hex digits, got ${firstToken.length}`;
  }
  if (!line.includes(':') && !line.includes('-') && !line.includes('.')) {
    return 'Unknown notation: expected colons, hyphens, dots, or bare hex';
  }
  const parts = line.trim().split(/[.:\-]/);
  const lens = parts.map((p) => p.length);
  const lensText = lens.map((l) => String(l)).join(',');
  if (line.includes(':') && (parts.length !== 6 || !lens.every((l) => l === 2))) {
    return `Colon notation expects 6 pairs — found ${parts.length} groups of lengths ${lensText}`;
  }
  if (line.includes('-') && (parts.length !== 6 || !lens.every((l) => l === 2))) {
    return `Hyphen notation expects 6 pairs — found ${parts.length} groups of lengths ${lensText}`;
  }
  if (line.includes('.')) {
    return `Dot notation expects 3 groups of 4 hex digits — found ${parts.length} groups of lengths ${lensText}`;
  }
  return 'Invalid MAC address';
}

/** Compact single-line summary of the current batch for status bars and copy actions. */
export function summaryText(state: ToolState): string {
  const batch = runBatch(state.input, state.casing);
  return `${batch.ok} converted, ${batch.errors} error${batch.errors === 1 ? '' : 's'} (${state.casing})`;
}
