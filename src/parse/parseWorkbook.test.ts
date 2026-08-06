import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from './parseWorkbook';

const wb = XLSX.read(readFileSync('SP Truck Breakdown SMO Wave Part Pallet.xlsx'));
const loads = parseWorkbook(wb);
const byPo = Object.fromEntries(loads.map(l => [l.po, l]));
const plzw = byPo['RDS014871-PLZW22L24'];
const borw = byPo['RDS015113-BORW24L1'];
const ictw = byPo['RDS015113-ICTW24L3'];
const wijw = byPo['RDS015113-WIJW24L1'];

describe('parseWorkbook against the real file', () => {
  it('parses four loads with the verified line counts', () => {
    expect(loads).toHaveLength(4);
    expect(plzw.lines).toHaveLength(51);
    expect(borw.lines).toHaveLength(37);
    expect(ictw.lines).toHaveLength(48);
    expect(wijw.lines).toHaveLength(139);
  });

  it('sums the verified case totals', () => {
    const total = (l: typeof plzw) => l.lines.reduce((s, x) => s + x.cases, 0);
    expect(total(plzw)).toBe(2301);
    expect(total(borw)).toBe(1360);
    expect(total(ictw)).toBe(1307);
    expect(total(wijw)).toBe(5811);
  });

  it('extracts load metadata including the date from the sheet name', () => {
    expect(plzw.plant).toBe('DFDS Poland - Żerniki');
    expect(plzw.date).toBe('2026-08-06');
    expect(borw.date).toBe('2026-08-07');
    expect(wijw.date).toBeUndefined(); // sheet name ends in "TBC"
    expect(plzw.customer).toBe('Rowan International');
  });

  it('parses the first PLZW line completely', () => {
    const l = plzw.lines[0];
    expect(l.material).toBe('108450');
    expect(l.description).toContain('MONSTER ULTRA NO');
    expect(l.batch).toBe('241220551');
    expect(l.bbd).toBe('2026-12-20');
    expect(l.cases).toBe(25);
    expect(l.inPallet).toBe('A');
    expect(l.inPalletNo).toBe(1);
    expect(l.stackNo).toBe(1);
    expect(l.category).toBe('Rainbow Pallet');
  });

  it('forward-fills sparse pallet letter and number columns', () => {
    // PLZW row 3 (second line) has an empty letter cell but belongs to pallet A
    expect(plzw.lines[1].inPallet).toBe('A');
    expect(plzw.lines[1].inPalletNo).toBe(1);
  });

  it('counts the verified number of incoming pallets', () => {
    const palletCount = (l: typeof plzw) =>
      new Set(l.lines.filter(x => x.inPallet !== 'VOL').map(x => x.inPallet)).size;
    expect(palletCount(plzw)).toBe(24);
    expect(palletCount(ictw)).toBe(23);
    expect(palletCount(wijw)).toBe(65);
  });

  it('handles double-letter pallets (AA, AB…) in WIJW', () => {
    expect(wijw.lines.some(l => l.inPallet === 'AA')).toBe(true);
    expect(wijw.lines.some(l => l.inPallet === 'AB')).toBe(true);
  });

  it('preserves zero-padded and alphanumeric batches as strings', () => {
    expect(borw.lines.some(l => l.batch === '0002300391')).toBe(true);
    expect(plzw.lines.some(l => l.batch === 'B2628QB2')).toBe(true);
  });

  it('converts every BBD to an ISO date', () => {
    for (const load of loads)
      for (const l of load.lines) expect(l.bbd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps duplicate material+batch lines (BORW Rainbow + Full Pallet)', () => {
    const key = (l: { material: string; batch: string }) => `${l.material}|${l.batch}`;
    const counts = new Map<string, number>();
    for (const l of borw.lines) counts.set(key(l), (counts.get(key(l)) ?? 0) + 1);
    const dups = [...counts.values()].filter(n => n > 1);
    expect(dups.length).toBeGreaterThanOrEqual(1);
  });

  it('marks Full Pallet lines presorted with inPallet VOL', () => {
    const full = borw.lines.filter(l => l.category === 'Full Pallet');
    expect(full.length).toBeGreaterThanOrEqual(6);
    for (const l of full) {
      expect(l.presorted).toBe(true);
      expect(l.inPallet).toBe('VOL');
    }
  });

  it('marks single-line pallets presorted', () => {
    // WIJW pallet A holds exactly one line ("Layers 5 & more")
    const a = wijw.lines.filter(l => l.inPallet === 'A');
    expect(a).toHaveLength(1);
    expect(a[0].presorted).toBe(true);
  });

  it('assigns sequential stack numbers and stable ids', () => {
    plzw.lines.forEach((l, i) => expect(l.stackNo).toBe(i + 1));
    expect(new Set(plzw.lines.map(l => l.id)).size).toBe(51);
    expect(plzw.lines[0].id).toMatch(/^RDS014871-PLZW22L24:\d+$/);
  });
});
