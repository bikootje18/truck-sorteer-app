import * as XLSX from 'xlsx';
import type { Line, Load } from '../types';

type Row = unknown[];

const CASES_HEADERS = ['total cases (part pallets)', 'total cases', 'boras available stock'];
const LETTER_HEADERS = ['pallet label', 'rainbow pallet proposal', 'pallet count', 'total pallets'];

const norm = (h: unknown): string => String(h ?? '').trim().toLowerCase();
const str = (v: unknown): string => String(v ?? '').trim();

function excelDateToIso(v: unknown): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`;
  }
  const n = Number(v);
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return excelDateToIso(d);
  }
  const s = str(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return excelDateToIso(d);
  throw new Error(`Unparseable BBD value: ${JSON.stringify(v)}`);
}

function sheetDate(sheetName: string): string | undefined {
  const m = sheetName.trim().match(/(\d{2})(\d{2})(\d{2})$/);
  if (!m) return undefined;
  return `20${m[3]}-${m[2]}-${m[1]}`;
}

interface ColMap {
  orderNo: number; po: number; material: number; description: number;
  batch: number; bbd: number; cases: number; letter: number; palletNo: number;
  category: number; market: number; coo: number; plant: number; customer: number;
}

function buildColMap(header: Row, dataRows: Row[], sheetName: string): ColMap {
  const hs = header.map(norm);
  const find = (...names: string[]) => hs.findIndex(h => names.includes(h));
  const require = (label: string, ...names: string[]) => {
    const i = find(...names);
    if (i < 0) throw new Error(`Sheet "${sheetName}": missing column ${label}`);
    return i;
  };

  // Letter vs number pallet columns can share a header name; tell them apart by values.
  const candidates = hs
    .map((h, i) => (LETTER_HEADERS.includes(h) ? i : -1))
    .filter(i => i >= 0);
  const holdsLetters = (i: number) =>
    dataRows.some(r => /^[A-Z]{1,2}$/.test(str(r[i])));
  const letter = candidates.find(holdsLetters) ?? -1;
  const palletNo =
    candidates.find(i => i !== letter && dataRows.some(r => typeof r[i] === 'number')) ?? -1;
  if (letter < 0) throw new Error(`Sheet "${sheetName}": pallet letter column not found`);

  // Category: rightmost header matching "pallet cat" (sheets can have two; the
  // rightmost holds Rainbow/Full Pallet values in all four real sheets).
  let category = -1;
  hs.forEach((h, i) => { if (/pallet cat/.test(h)) category = i; });
  if (category < 0) throw new Error(`Sheet "${sheetName}": pallet category column not found`);

  return {
    orderNo: require('Order No', 'order no'),
    po: require('PO No', 'po no:', 'po no'),
    material: require('Material', 'material'),
    description: require('Material Description', 'material description'),
    batch: require('Batch', 'batch'),
    bbd: require('SLED/BBD', 'sled/bbd'),
    cases: require('cases', ...CASES_HEADERS),
    letter,
    palletNo,
    category,
    market: find('market'),
    coo: find('country of origin (coo)'),
    plant: require('Plant Name', 'plant name'),
    customer: require('Customer', 'customer', 'customer name'),
  };
}

export function parseWorkbook(wb: XLSX.WorkBook): Load[] {
  const loads: Load[] = [];
  for (const sheetName of wb.SheetNames) {
    const rows: Row[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null,
    });
    const headerIdx = rows.findIndex(r =>
      r.some(c => typeof c === 'string' && c.trim() === 'Order No'),
    );
    if (headerIdx < 0) throw new Error(`Sheet "${sheetName}": no "Order No" header row`);
    const dataRows = rows.slice(headerIdx + 1).filter(r => str(r[0]) !== '' || r.some(c => c !== null));
    const cols = buildColMap(rows[headerIdx], dataRows, sheetName);

    // Drop trailing summary rows: no Order No value.
    const lineRows = rows
      .map((r, i) => ({ r, sheetRow: i + 1 })) // 1-based sheet row numbers
      .slice(headerIdx + 1)
      .filter(({ r }) => str(r[cols.orderNo]) !== '');

    if (lineRows.length === 0) continue;
    const po = str(lineRows[0].r[cols.po]);

    let curLetter = '';
    let curNo = 0;
    const lines: Line[] = lineRows.map(({ r, sheetRow }, i) => {
      const category = str(r[cols.category]);
      const isFull = category === 'Full Pallet';
      const rawLetter = str(r[cols.letter]);
      if (!isFull && /^[A-Z]{1,2}$/.test(rawLetter)) curLetter = rawLetter;
      const rawNo = r[cols.palletNo];
      if (!isFull && typeof rawNo === 'number') curNo = rawNo;
      return {
        id: `${po}:${sheetRow}`,
        stackNo: i + 1,
        material: str(r[cols.material]),
        description: str(r[cols.description]),
        batch: str(r[cols.batch]),
        bbd: excelDateToIso(r[cols.bbd]),
        cases: Number(r[cols.cases] ?? 0),
        inPallet: isFull ? 'VOL' : curLetter,
        inPalletNo: isFull ? 0 : curNo,
        category,
        presorted: false, // derived below
        market: cols.market >= 0 ? str(r[cols.market]) || undefined : undefined,
        coo: cols.coo >= 0 ? str(r[cols.coo]) || undefined : undefined,
      };
    });

    // presorted: Full Pallet lines, and lines alone on their incoming pallet.
    const perPallet = new Map<string, number>();
    for (const l of lines) perPallet.set(l.inPallet, (perPallet.get(l.inPallet) ?? 0) + 1);
    for (const l of lines)
      l.presorted = l.category === 'Full Pallet' || perPallet.get(l.inPallet) === 1;

    loads.push({
      po,
      plant: str(lineRows[0].r[cols.plant]),
      customer: str(lineRows[0].r[cols.customer]),
      date: sheetDate(sheetName),
      lines,
    });
  }
  return loads;
}
