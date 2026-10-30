import { describe, expect, it } from 'vitest';

import { isValidRange, PLUGIN_API_VERSION, satisfies, SHARED_MODULES } from './version';

describe('satisfies', () => {
  it.each([
    ['1.4.2', '^1.0.0', true],
    ['2.0.0', '^1.0.0', false],
    ['0.9.0', '^1.0.0', false],
    ['0.2.5', '^0.2.3', true],
    ['0.3.0', '^0.2.3', false],
    ['0.0.4', '^0.0.3', false],
    ['1.2.9', '~1.2.3', true],
    ['1.3.0', '~1.2.3', false],
    ['1.9.0', '~1', true],
    ['1.5.0', '>=1.2.0', true],
    ['1.1.0', '>=1.2.0', false],
    ['1.3.0', '>1.2', true],
    ['1.2.9', '>1.2', false],
    ['1.2.9', '<=1.2', true],
    ['1.0.0', '1.0.0', true],
    ['1.0.1', '1.0.0', false],
    ['1.7.0', '1.x', true],
    ['2.0.0', '1.x', false],
    ['1.5.0', '>=1.2.0 <2.0.0', true],
    ['2.1.0', '^1.0.0 || ^2.0.0', true],
    ['9.9.9', '*', true],
    ['1.0.0-beta.1', '^1.0.0', false],
    ['1.0.0', 'not a range', false],
  ])('%s satisfies %s → %s', (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  it('rejects malformed ranges', () => {
    expect(isValidRange('^1.0.0')).toBe(true);
    expect(isValidRange('>= 1.0.0')).toBe(false);
    expect(isValidRange('latest')).toBe(false);
  });

  it('shares this API version with remote plugins', () => {
    expect(satisfies(PLUGIN_API_VERSION, SHARED_MODULES['@flamapy/ide-plugin-api'])).toBe(true);
  });
});
