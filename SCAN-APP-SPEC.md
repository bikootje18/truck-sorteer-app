# Truck Breakdown Scanner

Single-device web app for receiving trucks. Scan a case barcode with a handheld
scanner (Zebra/Honeywell, keyboard-wedge mode) and the app shows which rainbow
pallet the case belongs to, based on the truck's breakdown list from Excel.

---

## 1. Context & decisions already made

- **Scanner**: handheld, keyboard-wedge — it types the barcode into the focused
  input and sends Enter. No camera code needed.
- **Barcode on the case**: plain EAN/GTIN only. The EAN does **not** appear in
  the Excel breakdown lists (those use internal material numbers like `115047`),
  so the app maintains its own EAN → material mapping, learned on the fly.
- **What the answer shows**: the rainbow pallet **letter** (A, B, C … AA, AB …)
  from the breakdown list, plus article, batch, BBD and case count.
- **Users**: one person, one device. No backend, no accounts, no sync.
- **Persistence**: everything (learned EANs, scan progress, imported loads) is
  stored locally in the browser (`localStorage` or IndexedDB) and survives
  restarts. Note: this runs as a normal local web app — not as a Claude.ai
  artifact, where localStorage is unavailable.
- **Multiple trucks**: pallet letters restart per truck, so the app always
  operates inside one selected load. Switching loads is a top-level action.

## 2. Source data

Origin file: `SP_Truck_Breakdown_SMO_Wave_Part_Pallet.xlsx` — one sheet per
truck/PO. Current four loads:

| Sheet | PO | Plant | Lines | Pallets |
|---|---|---|---|---|
| RDS014871-PLZW22L24 060826 | RDS014871-PLZW22L24 | DFDS Poland – Żerniki | 51 | 24 |
| RDS015113-BORW24L1 070826 | RDS015113-BORW24L1 | DFDS CLC ONE SE | 37 | 9 |
| RDS015113-ICTW24L3 100826 | RDS015113-ICTW24L3 | ICT Logistics A/S | 48 | 23 |
| RDS015113-WIJW24L1 TBC | RDS015113-WIJW24L1 | DFDS Wijchen MEL 2 | 139 | 65 |

### Column quirks the parser must handle (all seen in the real file)

- Header row is not always row 1 — find the row containing `Order No`.
- Header spelling varies: `Pallet Catergory` vs `Pallet Category`, `Customer`
  vs `Customer Name`, `PLANT NAME` vs `Plant Name`.
- Cases column is named `Total Cases (Part Pallets)`, `Total Cases`, or
  `Boras Available Stock` depending on sheet.
- Two pallet columns exist: a **letter** column (A, B, … AA …) and a **number**
  column (1, 2, 3 …). Both are sparsely filled (only on the first row of each
  pallet) → forward-fill both.
- One sheet has a junk concatenated column (`material+batch` as a float) —
  ignore unnamed/duplicate columns.
- `SLED/BBD` is sometimes an Excel date serial (e.g. `46376`), sometimes a
  real date. Convert serials: `date = 1899-12-30 + serial days`.
- Batches can be numeric (`241220551`), zero-padded (`0002300391` — keep the
  zeros, treat as string), or alphanumeric (`B2628QB2`).
- Trailing summary rows ("Total 24 Pallets") — drop rows without an Order No.
- Same material+batch can appear twice legitimately (once as Rainbow Pallet
  line, once as Full Pallet) — both are real lines, keep both.

### Normalised line model

```ts
interface Line {
  id: string;          // stable: `${po}:${rowIndex}`
  material: string;    // "115047"
  description: string; // "MONSTER JUICE BAD APPLE DE 12/500ML"
  batch: string;       // "0006039794" — string, preserve leading zeros
  bbd: string;         // ISO "2027-08-31"
  cases: number;
  pallet: string;      // "AB"  ← the answer we show
  palletNo: number;    // 3
  category: string;    // "Rainbow Pallet" | "Full Pallet" | "2 - 4 Layers" | ...
  market?: string;
  coo?: string;
  scanned: boolean;    // progress state
  scannedAt?: string;
}

interface Load {
  po: string;          // "RDS015113-WIJW24L1"
  plant: string;
  customer: string;
  date?: string;       // from sheet name suffix (DDMMYY) or "TBC"
  lines: Line[];
}
```

## 3. Core flows

### A. Scan (the main screen)

1. One text input, **always focused** (refocus on blur, on tap anywhere, after
   every dialog). Scanner types EAN + Enter.
2. On Enter, look up EAN in the mapping table:
   - **Known EAN → material, exactly one unscanned line** for that material in
     the active load → show the answer immediately, mark line scanned.
   - **Known EAN → material, multiple candidate lines** (several batches /
     pallets) → show a picker: batch + BBD + pallet + cases per option. The
     batch is printed on the case; user taps the matching one.
   - **Unknown EAN** → "Which article is this?" — searchable list of the active
     load's articles (description + material no). One tap stores
     `ean → material` permanently and continues to the answer/picker.
   - **Known EAN but material not in this load** → clear "not on this truck"
     message with the article name, nothing marked.
3. **The answer screen** is dominated by the pallet letter — readable from
   1.5 m in a warehouse. Below it: description, batch, BBD, cases, pallet
   category. Auto-returns to ready-to-scan; next trigger pull always works.
4. Manual fallback: typing a material number or part of a description in the
   same input works too (for damaged barcodes).

### B. Progress / checklist

- Sticky summary: `34 / 51 lines · 12 / 24 pallets complete`.
- Pallet grid: one tile per pallet letter, filled when all its lines are
  scanned, partial state visible.
- "Missing" view: all unscanned lines — this is the discrepancy list when the
  truck is empty.
- Tap any line to toggle manually (case with unreadable barcode).

### C. Corrections

- **Undo last scan** — one tap, always visible after a scan.
- **Unlearn an EAN** — from a settings/mappings screen listing all learned
  `ean → material` pairs, with delete. A teaching mistake must not be permanent.
- **Reset load progress** — with confirmation.

### D. Load management

- Load switcher at the top (PO + plant + date).
- **Import new truck**: paste cells copied straight from Excel (TSV via
  clipboard) *or* drop the .xlsx (use SheetJS). Run the same header-detection
  and forward-fill logic as §2.
- Loads are kept until deleted; finished loads show a ✓.

## 4. Suggested stack

- **Vite + React + TypeScript** — plain SPA, no server.
- **SheetJS (`xlsx`)** for direct .xlsx import; TSV paste as the zero-dependency
  fallback.
- **State**: single store (Zustand or useReducer) persisted to `localStorage`
  under versioned keys: `scanapp:v1:loads`, `scanapp:v1:eanmap`.
- No router needed — three views toggled in state (Scan / Progress / Settings).
- Deploy = any static host, or simply `vite build` + open `dist/index.html`.
  Must also work fully offline once loaded.

## 5. UI notes (warehouse conditions)

- Huge type for the pallet letter (≥ 120 px), high contrast, works in bad light.
- Color + shape for scan result states (found / pick batch / unknown / not on
  truck) — never color alone.
- Every action reachable by scan or one tap; no hover-dependent UI.
- Audible/vibration feedback if available: distinct cue for "found" vs "needs
  attention".
- Dutch UI labels (users are Dutch-speaking); keep code/identifiers English.

## 6. Seed data

Ship the four current loads as `src/data/loads.json` (already parsed & cleaned)
so the app is usable on first open without importing anything. A build script
`scripts/parse-xlsx.ts` regenerates it from the source Excel and doubles as the
runtime import logic (same module, two entry points).

## 7. Edge cases to test

- Scan when the input lost focus (dialog was open) — must still capture.
- Scanner suffix configured as Tab instead of Enter — accept both.
- EAN with leading zeros (EAN-13 vs UPC-A: same code, 12 vs 13 digits — strip
  to a canonical form before lookup).
- Double-scan of the same case (line already scanned) — warn, don't advance.
- All lines of a material scanned, then one more scan of that EAN → "already
  complete, was expected N×" message.
- Load with duplicate material+batch (BORW: Rainbow + Full Pallet lines) —
  picker must show both, distinguished by pallet category.
- Import of a sheet with the junk concatenated column (BORW/ICTW variants).

## 8. Out of scope (for now)

- Multi-device sync / shared progress.
- SSCC or GS1-128 parsing (plain EAN only; GS1 support would remove the batch
  picker for suppliers that print it — nice future step).
- Label printing, WMS/ERP integration, user accounts.
