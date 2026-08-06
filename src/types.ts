export interface Line {
  id: string;          // stable: `${po}:${sheetRowNumber}`
  stackNo: number;     // 1..N per truck, sheet order — the number shown huge
  material: string;    // "115047"
  description: string; // "MONSTER JUICE BAD APPLE DE 12/500ML"
  batch: string;       // "0002300391" — string, preserve leading zeros
  bbd: string;         // ISO "2027-08-31"
  cases: number;       // expected tray count for this stack
  inPallet: string;    // incoming pallet letter "AB", or "VOL" for Full Pallet lines
  inPalletNo: number;  // incoming pallet number (0 for Full Pallet lines)
  category: string;    // "Rainbow Pallet" | "Full Pallet" | "2 - 4 Layers" | ...
  presorted: boolean;  // true = arrives uniform, no sorting needed, label only
  market?: string;
  coo?: string;
}

export interface Load {
  po: string;
  plant: string;
  customer: string;
  date?: string;       // ISO, from sheet name suffix DDMMYY; absent for "TBC"
  lines: Line[];
}

export interface LineProgress {
  status: 'done' | 'partial';
  movedCases?: number; // only for partial
  doneAt?: string;
}

export type Progress = Record<string, LineProgress>; // key: Line.id; absent = open
export type EanMap = Record<string, string>;         // canonical EAN -> material
