import { describe, expect, it } from 'vitest';
import { fmtDate } from './format';

describe('fmtDate', () => {
  it('renders ISO dates Dutch-style', () => {
    expect(fmtDate('2027-08-31')).toBe('31-08-2027');
  });
  it('passes through malformed values unchanged', () => {
    expect(fmtDate('TBC')).toBe('TBC');
  });
});
