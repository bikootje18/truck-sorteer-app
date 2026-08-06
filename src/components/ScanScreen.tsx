import { useEffect, useMemo, useRef, useState } from 'react';
import { feedback } from '../lib/feedback';
import { fmtDate } from '../lib/format';
import { resolveManual, resolveScan, type ScanResult } from '../lib/resolve';
import { useProgress, useStore } from '../store';
import type { Line, Load } from '../types';
import BatchPicker from './BatchPicker';
import TeachDialog from './TeachDialog';

type Panel =
  | { kind: 'ready' }
  | { kind: 'confirm'; line: Line }
  | { kind: 'pick'; candidates: Line[] }
  | { kind: 'teach'; ean: string }
  | { kind: 'manual'; matches: Line[] }
  | { kind: 'notOnTruck'; description: string | null }
  | { kind: 'alreadyDone'; lines: Line[] }
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
  const [partialInput, setPartialInput] = useState<string | null>(null);
  const [partialError, setPartialError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the scan input focused so the wedge scanner always lands here —
  // except while the teach dialog needs its own keyboard input.
  const teachOpen = panel.kind === 'teach';
  useEffect(() => {
    if (teachOpen || partialInput !== null) return;
    const t = setInterval(() => {
      if (document.activeElement !== inputRef.current) inputRef.current?.focus();
    }, 400);
    return () => clearInterval(t);
  }, [teachOpen, partialInput]);

  const articles = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of load.lines) if (!m.has(l.material)) m.set(l.material, l.description);
    return [...m.entries()];
  }, [load]);

  const doneStacks = load.lines.filter(l => progress[l.id]?.status === 'done').length;

  function applyResult(r: ScanResult) {
    switch (r.kind) {
      case 'destination':
        feedback('ok');
        setPanel({ kind: 'confirm', line: r.line });
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
      case 'alreadyDone':
        feedback('warn');
        setPanel({ kind: 'alreadyDone', lines: r.lines });
        break;
      case 'invalid':
        setPanel({ kind: 'invalid' });
        break;
    }
  }

  function submit(raw: string) {
    if (!raw.trim()) return;
    setPartialInput(null);
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
    const r = resolveScan(raw, load, eanMap, progress, allLoads);
    applyResult(r);
  }

  function teachPick(material: string) {
    if (panel.kind !== 'teach') return;
    learnEan(panel.ean, material);
    const map = useStore.getState().eanMap;
    applyResult(resolveScan(panel.ean, load, map, progress, allLoads));
  }

  return (
    <div className="screen" onClick={() => { if (!teachOpen && partialInput === null) inputRef.current?.focus(); }}>
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

      {panel.kind === 'confirm' && (
        <div className="card ok">
          <div className="stack-no">STAPEL {panel.line.stackNo}</div>
          <h2>{panel.line.description}</h2>
          <p className="meta">
            Batch <b>{panel.line.batch}</b> · THT <b>{fmtDate(panel.line.bbd)}</b>
            <br />
            <b>{panel.line.cases}</b> trays · van pallet <b>{panel.line.inPallet}</b>
            {panel.line.presorted ? ' · al gesorteerd, alleen label' : ''}
            {progress[panel.line.id]?.status === 'partial'
              ? ` · al ${progress[panel.line.id]?.movedCases} verplaatst`
              : ''}
          </p>
          {partialInput === null ? (
            <>
              <button
                className="btn btn-primary"
                onClick={() => {
                  markDone(load.po, panel.line.id);
                  feedback('ok');
                  setPanel({ kind: 'ready' });
                }}
              >
                ✓ Alles verplaatst
              </button>
              <button
                className="btn"
                onClick={() => { setPartialInput(''); setPartialError(false); }}
              >
                Deels…
              </button>
            </>
          ) : (
            <>
              <input
                className="scan-input"
                type="number"
                inputMode="numeric"
                placeholder="Aantal verplaatste trays"
                value={partialInput}
                onChange={e => { setPartialInput(e.target.value); setPartialError(false); }}
              />
              {partialError && <p className="meta">Vul een aantal groter dan 0 in</p>}
              <button
                className="btn btn-primary"
                onClick={() => {
                  const n = Number(partialInput);
                  if (partialInput.trim() !== '' && Number.isFinite(n) && n > 0) {
                    markPartial(load.po, panel.line.id, n);
                    setPanel({ kind: 'ready' });
                    setPartialInput(null);
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
                onClick={() => { setPartialInput(null); setPartialError(false); }}
              >
                Annuleren
              </button>
            </>
          )}
        </div>
      )}

      {panel.kind === 'pick' && (
        <BatchPicker
          candidates={panel.candidates}
          progress={progress}
          onPick={line => { feedback('ok'); setPanel({ kind: 'confirm', line }); }}
          onCancel={() => setPanel({ kind: 'ready' })}
        />
      )}

      {panel.kind === 'manual' && (
        <BatchPicker
          candidates={panel.matches}
          progress={progress}
          onPick={line => { feedback('ok'); setPanel({ kind: 'confirm', line }); }}
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

      {panel.kind === 'alreadyDone' && (
        <div className="card warn">
          <h2>Stapel {panel.lines[0].stackNo} was al klaar</h2>
          <p className="meta">
            {panel.lines[0].description} — verwacht: {panel.lines[0].cases} trays.
            Controleer of dit een dubbele tray is.
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
