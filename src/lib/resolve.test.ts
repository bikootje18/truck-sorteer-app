import { describe, expect, it } from 'vitest';
import type { Line, Load } from '../types';
import { resolveManual, resolveScan } from './resolve';

const mkLine = (over: Partial<Line>): Line => ({
  id: 'PO1:2', stackNo: 1, material: '108450',
  description: 'MONSTER ULTRA NO 24/500ML V2', batch: '241220551',
  bbd: '2026-12-20', cases: 25, inPallet: 'A', inPalletNo: 1,
  category: 'Rainbow Pallet', presorted: false, ...over,
});
const mkLoad = (lines: Line[]): Load =>
  ({ po: 'PO1', plant: 'Plant', customer: 'Cust', lines });

const EAN = '5449000123457';

describe('resolveScan', () => {
  it('rejects garbage input', () => {
    expect(resolveScan('xx', mkLoad([mkLine({})]), {}, {}, []).kind).toBe('invalid');
  });

  it('asks to teach an unknown EAN', () => {
    const r = resolveScan(EAN, mkLoad([mkLine({})]), {}, {}, []);
    expect(r).toEqual({ kind: 'teach', ean: EAN });
  });

  it('matches an EAN scanned with a leading zero to its learned canonical form', () => {
    const load = mkLoad([mkLine({})]);
    const r = resolveScan('0' + EAN, load, { [EAN]: '108450' }, {}, [load]);
    expect(r.kind).toBe('destination');
  });

  it('reports a known EAN whose material is not on this truck', () => {
    const other = mkLoad([mkLine({ material: '999999', description: 'OTHER DRINK' })]);
    const load = mkLoad([mkLine({})]);
    const r = resolveScan(EAN, load, { [EAN]: '999999' }, {}, [load, other]);
    expect(r).toEqual({ kind: 'notOnTruck', material: '999999', description: 'OTHER DRINK' });
  });

  it('returns the single open destination', () => {
    const line = mkLine({});
    const r = resolveScan(EAN, mkLoad([line]), { [EAN]: '108450' }, {}, []);
    expect(r).toEqual({ kind: 'destination', line });
  });

  it('offers a picker when several batches are open', () => {
    const a = mkLine({ id: 'PO1:2', batch: 'AAA' });
    const b = mkLine({ id: 'PO1:3', batch: 'BBB', stackNo: 2 });
    const r = resolveScan(EAN, mkLoad([a, b]), { [EAN]: '108450' }, {}, []);
    expect(r.kind).toBe('pick');
    if (r.kind === 'pick') expect(r.candidates).toHaveLength(2);
  });

  it('narrows to the one still-open line when the other batch is done', () => {
    const a = mkLine({ id: 'PO1:2', batch: 'AAA' });
    const b = mkLine({ id: 'PO1:3', batch: 'BBB', stackNo: 2 });
    const r = resolveScan(EAN, mkLoad([a, b]), { [EAN]: '108450' },
      { 'PO1:2': { status: 'done' } }, []);
    expect(r).toEqual({ kind: 'destination', line: b });
  });

  it('keeps the BORW Rainbow/Full duplicate apart via the picker', () => {
    const rainbow = mkLine({ id: 'PO1:2', category: 'Rainbow Pallet' });
    const full = mkLine({ id: 'PO1:9', category: 'Full Pallet', inPallet: 'VOL', presorted: true, stackNo: 9 });
    const r = resolveScan(EAN, mkLoad([rainbow, full]), { [EAN]: '108450' }, {}, []);
    expect(r.kind).toBe('pick');
  });

  it('warns when every matching stack is already done', () => {
    const line = mkLine({});
    const r = resolveScan(EAN, mkLoad([line]), { [EAN]: '108450' },
      { 'PO1:2': { status: 'done' } }, []);
    expect(r.kind).toBe('alreadyDone');
    if (r.kind === 'alreadyDone') expect(r.lines).toEqual([line]);
  });

  it('treats a partial stack as still open', () => {
    const line = mkLine({});
    const r = resolveScan(EAN, mkLoad([line]), { [EAN]: '108450' },
      { 'PO1:2': { status: 'partial', movedCases: 10 } }, []);
    expect(r.kind).toBe('destination');
  });
});

describe('resolveManual', () => {
  const load = mkLoad([
    mkLine({ id: 'PO1:2', material: '108450' }),
    mkLine({ id: 'PO1:3', material: '115047', description: 'MONSTER JUICE BAD APPLE DE 12/500ML', stackNo: 2 }),
  ]);
  it('matches an exact material number', () => {
    expect(resolveManual('115047', load)).toHaveLength(1);
  });
  it('matches a case-insensitive description substring', () => {
    expect(resolveManual('bad apple', load)[0].material).toBe('115047');
  });
  it('returns empty for blank queries', () => {
    expect(resolveManual('  ', load)).toEqual([]);
  });
});
