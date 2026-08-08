import { useEffect, useMemo, useRef, useState } from 'react';
import { feedback } from '../lib/feedback';
import { fmtDate } from '../lib/format';
import { resolveManual, resolveScanToPallet, type PalletScanResult } from '../lib/resolve';
import { useProgress, useStore } from '../store';
import type { Line, Load } from '../types';
import BatchPicker from './BatchPicker';
import TeachDialog from './TeachDialog';

type Panel =
  | { kind: 'ready' }
  | { kind: 'pallet'; inPallet: string; focusId: string; wasAllDone: boolean }
  | { kind: 'pick'; candidates: Line[] }
  | { kind: 'teach'; ean: string }
  | { kind: 'manual'; matches: Line[] }
  | { kind: 'notOnTruck'; description: string | null }
  | { kind: 'invalid' };

export default function ScanScreen({ load, allLoads }: { load: Load; allLoads: Load[] }) {
  const eanMap = useStore(s => s.eanMap);
  const progress = useProgress(load.po);
  const markDone = useStore(s => s.markDone);
  const markPartial = useStore(s => s.markPartial);
  const learnEan = useStore(s => s.learnEan);
  const undo = useStore(s => s.undo);
  const lastUndo = useStore(s => s.lastUndo);

  const [panel, setPanel] = useState<Panel>({ kind: 'ready' });
  const [value, setValue] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [partialFor, setPartialFor] = useState<string | null>(null);
  const [partialValue, setPartialValue] = useState('');
  const [partialError, setPartialError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the scan input focused so the wedge scanner always lands here —
  // except while the teach dialog or a partial-count field needs the keyboard.
  const teachOpen = panel.kind === 'teach';
  useEffect(() => {
    if (teachOpen || partialFor !== null) return;
    const t = setInterval(() => {
      if (document.activeElement !== inputRef.current) inputRef.current?.focus();
    }, 400);
    return () => clearInterval(t);
  }, [teachOpen, partialFor]);

  const articles = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of load.lines) if (!m.has(l.material)) m.set(l.material, l.description);
    return [...m.entries()];
  }, [load]);

  const doneStacks = load.lines.filter(l => progress[l.id]?.status === 'done').length;

  function toPallet(line: Line, wasAllDone = false) {
    setPanel({ kind: 'pallet', inPallet: line.inPallet, focusId: line.id, wasAllDone });
  }

  function applyResult(r: PalletScanResult) {
    switch (r.kind) {
      case 'pallet':
        feedback(r.wasAllDone ? 'warn' : 'ok');
        toPallet(r.focus, r.wasAllDone);
        break;
      case 'pick':
        feedback('ok');
        setPanel({ kind: 'pick', candidates: r.candidates });
        break;
      case 'teach':
        feedback('warn');
        setPanel({ kind: 'teach', ean: r.ean });
        break;
      case 'notOnTruck':
        feedback('warn');
        setPanel({ kind: 'notOnTruck', description: r.description });
        break;
      case 'invalid':
        setPanel({ kind: 'invalid' });
        break;
    }
  }

  function submit(raw: string) {
    if (!raw.trim()) return;
    setPartialFor(null);
    setPartialError(false);
    if (manualMode) {
      const matches = resolveManual(raw, load);
      if (matches.length) {
        setPanel({ kind: 'manual', matches });
        return;
      }
      // No article match — fall through so a genuine scan still works
      // while manual mode is left on.
    }
    applyResult(resolveScanToPallet(raw, load, eanMap, progress, allLoads));
  }

  function teachPick(material: string) {
    if (panel.kind !== 'teach') return;
    learnEan(panel.ean, material);
    const map = useStore.getState().eanMap;
    applyResult(resolveScanToPallet(panel.ean, load, map, progress, allLoads));
  }

  function renderPallet(inPallet: string, focusId: string, wasAllDone: boolean) {
    // Full Pallet lines share the synthetic 'VOL' group but are separate
    // physical pallets — show only the scanned line for those.
    const lines = (inPallet === 'VOL'
      ? load.lines.filter(l => l.id === focusId)
      : load.lines.filter(l => l.inPallet === inPallet)
    ).slice().sort((a, b) => a.stackNo - b.stackNo);
    const open = lines.filter(l => progress[l.id]?.status !== 'done').length;

    return (
      <div className="card ok">
        <div className="pallet-no">{inPallet === 'VOL' ? 'VOLLE PALLET' : `PALLET ${inPallet}`}</div>
        {wasAllDone && (
          <p className="meta">Deze soort was al afgevinkt — controleer of dit een dubbele tray is.</p>
        )}
        {open === 0 && !wasAllDone && <h2>Pallet klaar 🎉 Inwikkelen maar.</h2>}
        {lines.map(l => {
          const p = progress[l.id];
          const done = p?.status === 'done';
          return (
            <div key={l.id}>
              <div className={`list-row${done ? ' done' : ''}${l.id === focusId ? ' active' : ''}`}>
                <div className="row-stack">STAPEL {l.stackNo}</div>
                <div className="grow">
                  {l.description}
                  <small>
                    Batch <b>{l.batch}</b> · THT {fmtDate(l.bbd)} · {l.cases} trays
                    {p?.status === 'partial' ? ` · ${p.movedCases} verplaatst` : ''}
                    {l.presorted ? ' · alleen label' : ''}
                  </small>
                </div>
                {done ? (
                  <span>✓</span>
                ) : (
                  <div className="row-actions">
                    <button
                      className="btn-mini"
                      onClick={() => {
                        markDone(load.po, l.id);
                        feedback('ok');
                      }}
                    >
                      ✓ Klaar
                    </button>
                    <button
                      className="btn-mini ghost"
                      onClick={() => {
                        setPartialFor(l.id);
                        setPartialValue('');
                        setPartialError(false);
                      }}
                    >
                      Deels…
                    </button>
                  </div>
                )}
              </div>
              {partialFor === l.id && (
                <div className="partial-row">
                  <input
                    className="scan-input"
                    type="number"
                    inputMode="numeric"
                    placeholder="Aantal verplaatste trays"
                    value={partialValue}
                    onChange={e => { setPartialValue(e.target.value); setPartialError(false); }}
                  />
                  {partialError && <p className="meta">Vul een aantal groter dan 0 in</p>}
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const n = Number(partialValue);
                      if (partialValue.trim() !== '' && Number.isFinite(n) && n > 0) {
                        markPartial(load.po, l.id, n);
                        setPartialFor(null);
                        setPartialError(false);
                      } else {
                        setPartialError(true);
                      }
                    }}
                  >
                    Opslaan
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => { setPartialFor(null); setPartialError(false); }}
                  >
                    Annuleren
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="screen" onClick={() => { if (!teachOpen && partialFor === null) inputRef.current?.focus(); }}>
      <div className="sticky-head">
        {load.po} · {doneStacks}/{load.lines.length} stapels klaar
      </div>

      <input
        ref={inputRef}
        aria-label="scaninvoer"
        className="scan-input"
        inputMode={manualMode ? 'text' : 'none'}
        placeholder={manualMode ? 'Typ nummer of naam…' : 'Scan een tray…'}
        value={value}
        autoFocus
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            submit(value);
            setValue('');
          }
        }}
      />
      <button
        className="btn btn-ghost"
        onClick={() => setManualMode(m => !m)}
      >
        {manualMode ? '▣ Scanner' : '⌨ Handmatig'}
      </button>

      {lastUndo && (
        <div className="undo-bar">
          <button onClick={undo}>↩︎ Ongedaan maken</button>
        </div>
      )}

      {panel.kind === 'pallet' && renderPallet(panel.inPallet, panel.focusId, panel.wasAllDone)}

      {panel.kind === 'pick' && (
        <BatchPicker
          candidates={panel.candidates}
          progress={progress}
          onPick={line => { feedback('ok'); toPallet(line); }}
          onCancel={() => setPanel({ kind: 'ready' })}
        />
      )}

      {panel.kind === 'manual' && (
        <BatchPicker
          candidates={panel.matches}
          progress={progress}
          onPick={line => { feedback('ok'); toPallet(line); }}
          onCancel={() => setPanel({ kind: 'ready' })}
        />
      )}

      {panel.kind === 'teach' && (
        <TeachDialog
          articles={articles}
          onPick={teachPick}
          onCancel={() => setPanel({ kind: 'ready' })}
        />
      )}

      {panel.kind === 'notOnTruck' && (
        <div className="card err">
          <h2>Niet op deze vrachtwagen</h2>
          <p className="meta">
            {panel.description ?? 'Onbekend artikel'} hoort niet bij {load.po}.
          </p>
        </div>
      )}

      {panel.kind === 'invalid' && (
        <div className="card warn">
          <h2>Niet herkend</h2>
          <p className="meta">Scan opnieuw, of gebruik ⌨ Handmatig.</p>
        </div>
      )}
    </div>
  );
}
