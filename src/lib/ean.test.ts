import { describe, expect, it } from 'vitest';
import { canonicalEan } from './ean';

describe('canonicalEan', () => {
  it('accepts a plain EAN-13', () => {
    expect(canonicalEan('5449000123457')).toBe('5449000123457');
  });
  it('strips leading zeros so EAN-13 and UPC-A forms match', () => {
    expect(canonicalEan('0044900012345')).toBe('44900012345');
  });
  it('trims whitespace and control characters from the scanner', () => {
    expect(canonicalEan('  5449000123457\r')).toBe('5449000123457');
  });
  it('rejects short input', () => {
    expect(canonicalEan('1234567')).toBeNull();
  });
  it('rejects non-numeric input (manual text queries)', () => {
    expect(canonicalEan('bad apple')).toBeNull();
  });
  it('rejects empty and all-zero input', () => {
    expect(canonicalEan('')).toBeNull();
    expect(canonicalEan('00000000')).toBeNull();
  });
});
