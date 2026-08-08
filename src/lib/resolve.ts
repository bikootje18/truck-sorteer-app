import type { EanMap, Line, Load, Progress } from '../types';
import { canonicalEan } from './ean';

export type ScanResult =
  | { kind: 'invalid' }
  | { kind: 'teach'; ean: string }
  | { kind: 'notOnTruck'; material: string; description: string | null }
  | { kind: 'destination'; line: Line }
  | { kind: 'pick'; candidates: Line[] }
  | { kind: 'alreadyDone'; lines: Line[] };

export function resolveScan(
  raw: string,
  load: Load,
  eanMap: EanMap,
  progress: Progress,
  allLoads: Load[],
): ScanResult {
  const ean = canonicalEan(raw);
  if (!ean) return { kind: 'invalid' };
  const material = eanMap[ean];
  if (!material) return { kind: 'teach', ean };

  const candidates = load.lines.filter(l => l.material === material);
  if (candidates.length === 0) {
    const elsewhere = allLoads.flatMap(l => l.lines).find(l => l.material === material);
    return { kind: 'notOnTruck', material, description: elsewhere?.description ?? null };
  }

  const open = candidates.filter(l => progress[l.id]?.status !== 'done');
  if (open.length === 0) return { kind: 'alreadyDone', lines: candidates };
  if (open.length === 1) return { kind: 'destination', line: open[0] };
  return { kind: 'pick', candidates: open };
}

export type PalletScanResult =
  | { kind: 'invalid' }
  | { kind: 'teach'; ean: string }
  | { kind: 'notOnTruck'; material: string; description: string | null }
  | { kind: 'pick'; candidates: Line[] }
  | { kind: 'pallet'; inPallet: string; focus: Line; wasAllDone: boolean };

/**
 * Pallet-centric resolution: one scan identifies the incoming pallet the tray
 * came from. The batch picker only appears when the scanned sort's open
 * batches live on different pallets — same-pallet batches need no pick, since
 * the pallet card shows them all as separate stacks.
 */
export function resolveScanToPallet(
  raw: string,
  load: Load,
  eanMap: EanMap,
  progress: Progress,
  allLoads: Load[],
): PalletScanResult {
  const base = resolveScan(raw, load, eanMap, progress, allLoads);
  switch (base.kind) {
    case 'invalid':
    case 'teach':
    case 'notOnTruck':
      return base;
    case 'destination':
      return { kind: 'pallet', inPallet: base.line.inPallet, focus: base.line, wasAllDone: false };
    case 'alreadyDone':
      return { kind: 'pallet', inPallet: base.lines[0].inPallet, focus: base.lines[0], wasAllDone: true };
    case 'pick': {
      const pallets = new Set(base.candidates.map(l => l.inPallet));
      if (pallets.size === 1)
        return { kind: 'pallet', inPallet: base.candidates[0].inPallet, focus: base.candidates[0], wasAllDone: false };
      return { kind: 'pick', candidates: base.candidates };
    }
  }
}

/** Fallback for damaged barcodes: match material number or description text. */
export function resolveManual(query: string, load: Load): Line[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return load.lines.filter(
    l => l.material === q || l.description.toLowerCase().includes(q),
  );
}
