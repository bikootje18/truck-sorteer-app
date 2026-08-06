# Truck Sorteer App — Design

**Date:** 2026-08-06
**Status:** Approved design, pending implementation plan
**Supersedes:** `SCAN-APP-SPEC.md` (the original spec framed the app as *checking* cases against rainbow pallets; brainstorming revealed the real job is *sorting* mixed incoming pallets into uniform outgoing stacks. Section 2 of the old spec — Excel column quirks — remains accurate and is referenced below.)

## 1. The job

A truck arrives with mixed ("rainbow") pallets. Each mixed pallet carries 2–4
different sorts/batches stacked in layers. The goal: break every mixed pallet
down into **uniform stacks — exactly 1 sort, 1 batch, 1 BBD per stack** — and
know when each stack is complete.

The Excel breakdown file (`SP Truck Breakdown SMO Wave Part Pallet.xlsx`, one
sheet per truck) already defines the answer: **every line in the sheet is one
output stack** (material + batch + BBD + expected case count). The app never
invents a plan; it renders the file's plan and tracks progress against it.

Verified facts from the real file (all four sheets analysed):

- Each sort+batch combination lives on **exactly one incoming pallet** — so
  sorting is local: one mixed pallet at a time, 2–4 stacks open at once, never
  51 stacks simultaneously.
- Lines per truck: 51 / 37 / 48 / 139. Cases: 2 301 / 1 360 / 1 307 / 5 811.
- Some lines arrive already uniform (single-line pallets, `Full Pallet`
  category) → no sorting needed, only a label.
- BORW sheet has 2 duplicate material+batch combos (once as Rainbow Pallet
  line, once as Full Pallet line) — both are real; distinguish by category.

## 2. Context & decisions made

| Decision | Choice |
|---|---|
| Device | Zebra Android handheld (phone-sized touch screen, built-in scanner, DataWedge keystroke output + Enter suffix) |
| Users | One person, one device, Dutch-speaking |
| Hosting | GitHub Pages (user's GitHub account), auto-deploy on push, installed as PWA on the Zebra → works offline after first load |
| New trucks | **No in-app import.** User hands the Excel to Claude in this project; a repo script regenerates `loads.json`; push → redeploy → Zebra refreshes when online |
| Scan mode | **Scan once, move the bunch**: one scan identifies the sort/batch and destination; the user moves all matching trays and confirms. No per-tray scanning (~140 scans for the biggest truck instead of 5 811) |
| Output labels | **Pre-printed**: the app renders a printable label page per truck (one A5 label per stack); printed on an office PC from the same URL before the truck arrives |
| Barcode | Plain EAN/GTIN on the tray. EANs do **not** appear in the Excel → the app maintains a learned `EAN → material` map, taught on first scan |
| Persistence | localStorage, versioned keys (`sorteer:v1:loads-progress`, `sorteer:v1:eanmap`). Progress keyed per truck (PO). Redeploys never wipe progress |
| Stack | Vite + React + TypeScript SPA, no router (views toggled in state), no backend |

## 3. Data model

```ts
interface Line {
  id: string;          // stable: `${po}:${rowIndex}`
  stackNo: number;     // 1..N per truck, sheet order — the number shown huge
  material: string;    // "115047"
  description: string; // "MONSTER JUICE BAD APPLE DE 12/500ML"
  batch: string;       // "0002300391" — string, preserve leading zeros
  bbd: string;         // ISO "2027-08-31"
  cases: number;       // expected tray count for this stack
  inPallet: string;    // incoming pallet letter "AB" (forward-filled)
  inPalletNo: number;  // incoming pallet number
  category: string;    // "Rainbow Pallet" | "Full Pallet" | "2 - 4 Layers" | ...
  presorted: boolean;  // true = arrives uniform, no sorting needed, label only
  market?: string;
  coo?: string;
}

interface Load {
  po: string;          // "RDS015113-WIJW24L1"
  plant: string;
  customer: string;
  date?: string;       // from sheet name suffix (DDMMYY) or "TBC"
  lines: Line[];
}

// Progress lives separately in localStorage so loads.json redeploys are safe:
interface LineProgress {
  status: 'open' | 'done' | 'partial';
  movedCases?: number; // only for partial
  doneAt?: string;
}
type Progress = Record<string /* lineId */, LineProgress>;
type EanMap = Record<string /* canonical EAN */, string /* material */>;
```

`presorted` is derived at parse time: `category === 'Full Pallet'`, or the
line is the only line on its incoming pallet.

The parser (`scripts/parse-xlsx.ts`) handles all column quirks documented in
`SCAN-APP-SPEC.md` §2: variable header row, header misspellings, three names
for the cases column, sparse pallet columns (forward-fill), junk concatenated
column, Excel date serials, numeric/zero-padded/alphanumeric batches, trailing
summary rows.

## 4. Screens (Dutch UI, English code)

### Sorteren (main)

- One text input, always focused (refocus on blur/tap/dialog close),
  `inputmode="none"` so the Android keyboard stays hidden; a small keyboard
  button enables manual typing (damaged barcode → type material number or part
  of the description).
- After a successful scan, the screen is dominated by the stack number
  (**"→ STAPEL 17"**, ≥120 px), with sort name, batch, BBD, incoming pallet
  letter, and expected tray count below.
- Primary action: **"✓ Alles verplaatst"** → marks the stack `done`.
  Secondary: **"Deels…"** → enter a moved-count, stack becomes `partial`.
- **"Ongedaan maken"** visible after every state change (single-level undo).
- Distinct color + icon + (if available) sound/vibration per outcome:
  found / pick batch / teach / not on this truck / already done.

### Overzicht

- Primary grouping: **per binnenkomende pallet** (matches how the floor work
  actually flows) — "Pallet C · 3 stapels · 2 klaar". Secondary toggle: per
  stapel (1…N).
- Sticky header: `23/51 stapels klaar`.
- Presorted lines shown as "geen sortering nodig — alleen label".
- Tap any line to toggle its status manually.
- **"Nog te doen"** filter = the discrepancy list when the truck is empty.

### Instellingen

- Truck switcher (PO + plant + date; finished trucks show ✓).
- Learned barcode list (`EAN → article`) with per-entry delete — a teaching
  mistake must never be permanent.
- **Export mappings**: copies the EAN map as text so the user can paste it to
  Claude; it gets baked into the next deploy as seed mappings → a device reset
  can't lose what the app learned.
- Reset progress per truck (with confirmation).

### Labels (print view)

- Route reachable from Instellingen, used on a desktop browser.
- One A5 label per stack (print CSS, page-break per label): huge stack number,
  article description, material no, batch, BBD, expected count, PO, incoming
  pallet letter. Presorted lines get labels too.

## 5. Scan resolution logic

1. Normalise input to a canonical EAN: trim, strip Enter/Tab suffix, strip
   leading zeros for EAN-13/UPC-A equivalence.
2. Look up in EanMap:
   - **Unknown EAN** → "Welk artikel is dit?" — searchable list of the active
     truck's sorts (description + material). One tap stores the mapping
     permanently, then continue to step 3.
   - **Known EAN, material not in active truck** → orange "Niet op deze
     vrachtwagen" + article name; nothing changes.
3. Candidate lines = active truck's lines for that material:
   - Exactly one **open** candidate → show destination.
   - Multiple candidates (several batches, or BORW's Rainbow/Full duplicate) →
     picker listing batch + BBD + stack no + category; user matches against the
     batch printed on the tray (BBD shown as fallback for smudged batch codes).
   - All candidates already `done` → "Stapel N was al klaar" warning.
4. Manual input path (keyboard button): same resolution, but the query matches
   material numbers and description substrings instead of the EAN map.

## 6. Error handling

- Scan while a dialog is open / input blurred → input refocuses on every
  interaction; keystrokes buffered by focus discipline, not global listeners.
- Malformed/short scans (< 8 digits) → ignored with a subtle "niet herkend".
- localStorage full/unavailable → visible warning banner (app still works, but
  progress won't survive restart).
- Truck data missing for a stored progress key (load removed in a redeploy) →
  progress kept but inert; never crash.

## 7. Testing

- **Parser unit tests against the real Excel** — all four sheets: line counts
  (51/37/48/139), forward-fill correctness, date serial conversion, zero-padded
  batches preserved, junk column ignored, summary rows dropped, duplicate
  material+batch kept, `presorted` derivation.
- **Scan-resolution unit tests**: EAN canonicalisation (leading zeros, Tab/Enter
  suffix), unknown→teach flow, multi-batch picker, not-on-truck, already-done,
  BORW duplicate distinguished by category.
- **Progress reducer tests**: done/partial/undo transitions, per-truck keying,
  survival across a loads.json version bump.
- Manual device test on the Zebra: DataWedge Enter suffix, keyboard
  suppression, PWA offline behaviour.

## 8. Out of scope

- Multi-device sync, accounts, backend.
- SSCC / GS1-128 parsing (would remove the batch picker where suppliers print
  batch in the barcode — noted as a future step).
- Zebra label-printer integration (pre-printed A5 labels chosen instead).
- In-app Excel/TSV import (deliberately removed — trucks enter via repo script).
- WMS/ERP integration.
