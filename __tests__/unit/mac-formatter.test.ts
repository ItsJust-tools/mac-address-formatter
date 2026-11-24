import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  hexTokens,
  parseMac,
  formatAll,
  macInfo,
  convertLine,
  runBatch,
  lineError,
  isHex,
  DEFAULT_STATE,
  MAX_HISTORY,
  type ToolState,
} from '@/tool/types';
import {
  deserializeState,
  serializeState,
  withHistory,
  roundTrips,
  macAddressFormatterTool,
} from '@/tool/tool-definition';
import { toggleCasing, saveToHistory, clearHistory } from '@/tool/transitions';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('detectFormat', () => {
  it('autodetects all supported input notations', () => {
    expect(detectFormat('AA:BB:CC:DD:EE:FF')).toBe('colon');
    expect(detectFormat('aa-bb-cc-dd-ee-ff')).toBe('hyphen');
    expect(detectFormat('aabb.ccdd.eeff')).toBe('dot');
    expect(detectFormat('aabbccddeeff')).toBe('bare');
  });

  it('rejects malformed or non-hex inputs', () => {
    expect(detectFormat('AA:BB:CC:DD:EE')).toBeNull();
    expect(detectFormat('AA:BB:CC:DD:EE:FZ')).toBeNull();
    expect(detectFormat('aabb.ccddeeff')).toBeNull();
    expect(detectFormat('a.b')).toBeNull();
    expect(detectFormat('aabb.ccdd.eeffff')).toBeNull();
    expect(detectFormat('hello')).toBeNull();
    expect(detectFormat('')).toBeNull();
  });
});

describe('hexTokens and isHex', () => {
  it('splits on every separator style', () => {
    expect(hexTokens('aa:bb:cc:dd:ee:ff')).toEqual(['aa', 'bb', 'cc', 'dd', 'ee', 'ff']);
    expect(hexTokens('aabb.ccdd.eeff')).toEqual(['aabb', 'ccdd', 'eeff']);
    expect(hexTokens('AA-BB-CC-DD-EE-FF')).toEqual(['AA', 'BB', 'CC', 'DD', 'EE', 'FF']);
    expect(hexTokens('  aabbccddeeff ')).toEqual(['aabbccddeeff']);
  });

  it('validates hex strings', () => {
    expect(isHex('0f')).toBe(true);
    expect(isHex('zz')).toBe(false);
    expect(isHex('')).toBe(false);
  });
});

describe('parseMac', () => {
  it('parses colon, hyphen, bare, dotted and cisco forms', () => {
    expect(parseMac('AA:BB:CC:DD:EE:FF')).toEqual(['aa', 'bb', 'cc', 'dd', 'ee', 'ff']);
    expect(parseMac('AA-BB-CC-DD-EE-FF')).toEqual(['aa', 'bb', 'cc', 'dd', 'ee', 'ff']);
    expect(parseMac('aabbccddeeff')).toEqual(['aa', 'bb', 'cc', 'dd', 'ee', 'ff']);
    expect(parseMac('aabb.ccdd.eeff')).toEqual(['aa', 'bb', 'cc', 'dd', 'ee', 'ff']);
    expect(parseMac('a.b.c')).toEqual(['ab', 'c0', '00', '00', '00', '00']);
  });

  it('parses dotted forms with 1-4 hex digits per group', () => {
    expect(parseMac('aabb.ccdd.ee')).toEqual(['aa', 'bb', 'cc', 'dd', 'ee', '00']);
    expect(parseMac('1.2.3.4')).toBeNull();
    expect(parseMac('aabb.ccdd.eeffff')).toBeNull();
  });

  it('returns null for invalid inputs', () => {
    expect(parseMac('AA:BB:CC:DD:EE:GG')).toBeNull();
    expect(parseMac('aabbccddeef')).toBeNull();
    expect(parseMac('')).toBeNull();
    expect(parseMac('xyz')).toBeNull();
  });
});

describe('formatAll', () => {
  const octets = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff'];

  it('produces all four styles with requested casing', () => {
    expect(formatAll(octets, 'upper')).toEqual({
      colon: 'AA:BB:CC:DD:EE:FF',
      hyphen: 'AA-BB-CC-DD-EE-FF',
      dot: 'AABB.CCDD.EEFF',
      bare: 'AABBCCDDEEFF',
    });
    expect(formatAll(octets, 'lower').colon).toBe('aa:bb:cc:dd:ee:ff');
  });
});

describe('macInfo', () => {
  it('classifies unicast/multicast and universal/local bits', () => {
    expect(macInfo(['aa', 'bb', 'cc', 'dd', 'ee', 'ff'])).toEqual({
      unicast: true,
      universal: false,
      oui: 'aa:bb:cc',
    });
    expect(macInfo(['a4', 'bb', 'cc', 'dd', 'ee', 'ff'])?.unicast).toBe(true);
    expect(macInfo(['a4', 'bb', 'cc', 'dd', 'ee', 'ff']).universal).toBe(true);
    expect(macInfo(['a2', 'bb', 'cc', 'dd', 'ee', 'ff'])?.universal).toBe(false);
  });
});

describe('convertLine and runBatch', () => {
  it('converts valid lines and reports per-line errors in batch mode', () => {
    const batch = runBatch('AA:BB:CC:DD:EE:FF\nzz:11:22:33:44:55\naabbccddeeff', 'upper');
    expect(batch.ok).toBe(2);
    expect(batch.errors).toBe(1);
    expect(batch.results[0]?.outputs?.colon ?? '').toBe('AA:BB:CC:DD:EE:FF');
    expect(batch.results[1]?.error).toBeTruthy();
    expect(batch.results[2]?.outputs?.dot).toBe('AABB.CCDD.EEFF');
  });

  it('skips blank lines without counting them as errors', () => {
    const batch = runBatch('\nAA:BB:CC:DD:EE:FF', 'upper');
    expect(batch.errors).toBe(0);
    expect(batch.ok).toBe(1);
  });

  it('casing toggle affects all outputs', () => {
    const batch = runBatch('AA:BB:CC:DD:EE:FF', 'lower');
    expect(batch.results[0]?.outputs?.bare).toBe('aabbccddeeff');
    expect(batch.results[0]?.outputs?.hyphen).toBe('aa-bb-cc-dd-ee-ff');

    const upper = runBatch('aa:bb:cc:dd:ee:ff', 'upper');
    expect(upper.results[0]?.outputs?.bare).toBe('AABBCCDDEEFF');
  });

  it('reports length errors', () => {
    expect(convertLine('aabbcc', 1).error).toContain('12 hex digits');
  });
});

describe('lineError', () => {
  it('produces clear messages for each failure mode', () => {
    expect(lineError('aabbccddeegz')).toBeTruthy();
    expect(lineError('aabbcc')).toContain('12 hex digits');
    expect(lineError('AA:BB:CC')).toMatch(/Colon notation expects 6 pairs/);
    expect(lineError('aa-bb-cc-dd-ee')).toMatch(/Hyphen notation/);
    expect(lineError('aabb.cc')).toMatch(/Dot notation/);
  });
});

describe('state transitions', () => {
  it('toggles casing both ways', () => {
    expect(toggleCasing('upper')).toBe('lower');
    expect(toggleCasing('lower')).toBe('upper');
  });

  it('saves history newest first and caps at MAX_HISTORY', () => {
    let s = state();
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      s = saveToHistory(s, `entry-${i}`, new Date(2026, 0, 1, 0, 0, i));
    }
    expect(s.history).toHaveLength(MAX_HISTORY);
    expect(s.history[0]?.text).toBe(`entry-${MAX_HISTORY + 4}`);
  });

  it('clearHistory empties the list', () => {
    expect(clearHistory(saveToHistory(state(), 'x')).history).toHaveLength(0);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips input and format settings', () => {
    const s = state({ input: 'aa:bb:cc:dd:ee:ff\naabb.ccdd.eeff', casing: 'lower' });
    expect(roundTrips(s)).toBe(true);
    const restored = deserializeState(JSON.parse(serializeState(s)));
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.input).toBe(s.input);
      expect(restored.data.casing).toBe('lower');
    }
  });

  it('recovers from invalid payloads with defaults', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState('nope').success).toBe(false);
    const bad = deserializeState({ input: 42, casing: 'weird', history: 'nope' });
    expect(bad.success).toBe(true);
    if (bad.success) {
      expect(bad.data.input).toBe(DEFAULT_STATE.input);
      expect(bad.data.casing).toBe('upper');
      expect(bad.data.history).toEqual([]);
    }
  });

  it('drops malformed history entries and caps length', () => {
    const entries = Array.from({ length: MAX_HISTORY + 3 }, (_, i) => ({
      text: `t${i}`,
      createdAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    }));
    const result = deserializeState({ input: 'a', casing: 'upper', history: entries });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.history).toHaveLength(MAX_HISTORY);
    const mixed = deserializeState({ input: 'a', casing: 'upper', history: [{}, null] });
    if (mixed.success) expect(mixed.data.history).toEqual([]);
  });

  it('withHistory appends newest first', () => {
    const s = withHistory(state(), 'AA:BB:CC:DD:EE:FF', new Date(2026, 0, 1));
    expect(s.history[0]?.text).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('exposes the tool descriptor', () => {
    expect(macAddressFormatterTool.id).toBe('mac-address-formatter');
    expect(macAddressFormatterTool.serialize(state())).toBeTypeOf('string');
  });
});
