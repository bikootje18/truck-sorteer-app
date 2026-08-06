import { useState } from 'react';
import { fmtDate } from '../lib/format';
import { useProgress, useStore } from '../store';
import type { Line, Load } from '../types';

export default function OverviewScreen({ load }: { load: Load }) {
  const progress = useProgress(load.po);
  const toggleLine = useStore(s => s.toggleLine);
  const [grouping, setGrouping] = useState<'pallet' | 'stack'>('pallet');
  const [onlyOpen, setOnlyOpen] = useState(false);

  const isDone = (l: Line) => progress[l.id]?.status === 'done';
  const doneCount = load.lines.filter(isDone).length;
  const shown = onlyOpen ? load.lines.filter(l => !isDone(l)) : load.lines;

  // Groups in order of first appearance.
  const groups = new Map<string, Line[]>();
  for (const l of shown) {
    const key = grouping === 'pallet' ? `Pallet ${l.inPallet}` : `Stapel ${l.stackNo}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }
  const groupDone = (lines: Line[]) => lines.filter(isDone).length;
  const groupTotal = (key: string) =>
    grouping === 'pallet'
      ? load.lines.filter(l => `Pallet ${l.inPallet}` === key)
      : load.lines.filter(l => `Stapel ${l.stackNo}` === key);

  return (
    <div className="screen">
      <div className="sticky-head">
        {doneCount}/{load.lines.length} stapels klaar
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={`btn btn-ghost${grouping === 'pallet' ? ' active' : ''}`}
          onClick={() => setGrouping('pallet')}
        >
          Per pallet
        </button>
        <button
          className={`btn btn-ghost${grouping === 'stack' ? ' active' : ''}`}
          onClick={() => setGrouping('stack')}
        >
          Per stapel
        </button>
        <button
          className={`btn btn-ghost${onlyOpen ? ' active' : ''}`}
          onClick={() => setOnlyOpen(o => !o)}
        >
          Nog te doen
        </button>
      </div>

      {[...groups.entries()].map(([key, lines]) => {
        const all = groupTotal(key);
        return (
          <div key={key}>
            <div className="group-head">
              {key} · {groupDone(all)}/{all.length} klaar
            </div>
            {lines.map(l => {
              const p = progress[l.id];
              return (
                <div
                  key={l.id}
                  className={`list-row${p?.status === 'done' ? ' done' : ''}`}
                  onClick={() => toggleLine(load.po, l.id)}
                >
                  <span>{p?.status === 'done' ? '✓' : p?.status === 'partial' ? '◐' : '○'}</span>
                  <div className="grow">
                    Stapel {l.stackNo} · {l.description}
                    <small>
                      Batch {l.batch} · THT {fmtDate(l.bbd)} · {l.cases} trays
                      {p?.status === 'partial' ? ` · ${p.movedCases} verplaatst` : ''}
                    </small>
                  </div>
                  {l.presorted && <span className="badge">alleen label</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
