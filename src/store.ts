import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import seedEanMap from './data/eanmap.json';
import { canonicalEan } from './lib/ean';
import type { EanMap, LineProgress, Progress } from './types';

export type View = 'scan' | 'overview' | 'settings';

interface UndoEntry { po: string; lineId: string; prev: LineProgress | undefined }

interface AppState {
  view: View;
  activePo: string | null;
  progressByPo: Record<string, Progress>;
  eanMap: EanMap;
  lastUndo: UndoEntry | null;
  setView: (v: View) => void;
  setActivePo: (po: string) => void;
  markDone: (po: string, lineId: string) => void;
  markPartial: (po: string, lineId: string, moved: number) => void;
  toggleLine: (po: string, lineId: string) => void;
  undo: () => void;
  learnEan: (ean: string, material: string) => void;
  unlearnEan: (ean: string) => void;
  resetProgress: (po: string) => void;
}

function setLine(
  s: AppState, po: string, lineId: string, next: LineProgress | undefined,
): Partial<AppState> {
  const prev = s.progressByPo[po]?.[lineId];
  const truck: Progress = { ...s.progressByPo[po] };
  if (next === undefined) delete truck[lineId];
  else truck[lineId] = next;
  return {
    progressByPo: { ...s.progressByPo, [po]: truck },
    lastUndo: { po, lineId, prev },
  };
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      view: 'scan',
      activePo: null,
      progressByPo: {},
      eanMap: { ...(seedEanMap as EanMap) },
      lastUndo: null,
      setView: (view) => set({ view }),
      setActivePo: (activePo) => set({ activePo }),
      markDone: (po, lineId) =>
        set(s => setLine(s, po, lineId, { status: 'done', doneAt: new Date().toISOString() })),
      markPartial: (po, lineId, moved) =>
        set(s => setLine(s, po, lineId, { status: 'partial', movedCases: moved })),
      toggleLine: (po, lineId) =>
        set(s =>
          s.progressByPo[po]?.[lineId]?.status === 'done'
            ? setLine(s, po, lineId, undefined)
            : setLine(s, po, lineId, { status: 'done', doneAt: new Date().toISOString() }),
        ),
      undo: () =>
        set(s => {
          if (!s.lastUndo) return {};
          const { po, lineId, prev } = s.lastUndo;
          return { ...setLine(s, po, lineId, prev), lastUndo: null };
        }),
      learnEan: (ean, material) =>
        set(s => {
          const key = canonicalEan(ean);
          if (!key) return {};
          return { eanMap: { ...s.eanMap, [key]: material } };
        }),
      unlearnEan: (ean) =>
        set(s => {
          const eanMap = { ...s.eanMap };
          delete eanMap[ean];
          return { eanMap };
        }),
      resetProgress: (po) =>
        set(s => ({ progressByPo: { ...s.progressByPo, [po]: {} }, lastUndo: null })),
    }),
    {
      name: 'sorteer:v1:state',
      partialize: (s) => ({
        activePo: s.activePo,
        progressByPo: s.progressByPo,
        eanMap: s.eanMap,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppState>),
        // Seed mappings baked into a deploy never override what the device learned.
        eanMap: { ...(seedEanMap as EanMap), ...(persisted as Partial<AppState>)?.eanMap },
      }),
    },
  ),
);

const EMPTY: Progress = {};
export const useProgress = (po: string): Progress =>
  useStore(s => s.progressByPo[po] ?? EMPTY);
