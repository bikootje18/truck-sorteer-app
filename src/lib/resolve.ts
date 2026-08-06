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

/** Fallback for damaged barcodes: match material number or description text. */
export function resolveManual(query: string, load: Load): Line[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return load.lines.filter(
    l => l.material === q || l.description.toLowerCase().includes(q),
  );
}
