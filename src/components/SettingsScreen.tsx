import { useProgress, useStore } from '../store';
import type { Load } from '../types';

export default function SettingsScreen({ loads, load }: { loads: Load[]; load: Load }) {
  const activePo = useStore(s => s.activePo) ?? loads[0].po;
  const setActivePo = useStore(s => s.setActivePo);
  const eanMap = useStore(s => s.eanMap);
  const unlearnEan = useStore(s => s.unlearnEan);
  const resetProgress = useStore(s => s.resetProgress);
  const progressByPo = useStore(s => s.progressByPo);
  const progress = useProgress(load.po);

  const doneFor = (l: Load) =>
    l.lines.filter(x => progressByPo[l.po]?.[x.id]?.status === 'done').length;

  const describe = (material: string) =>
    loads.flatMap(l => l.lines).find(l => l.material === material)?.description ?? material;

  const exportMap = () => {
    navigator.clipboard?.writeText(JSON.stringify(eanMap, null, 2));
    window.alert('Barcodelijst gekopieerd — plak hem in de chat met Claude.');
  };

  return (
    <div className="screen">
      <h2>Vrachtwagen</h2>
      {loads.map(l => {
        const done = doneFor(l);
        const finished = done === l.lines.length;
        return (
          <div
            key={l.po}
            className={`list-row${l.po === activePo ? ' active' : ''}`}
            onClick={() => setActivePo(l.po)}
          >
            <span>{l.po === activePo ? '▶' : finished ? '✓' : '·'}</span>
            <div className="grow">
              {l.po}
              <small>{l.plant}{l.date ? ` · ${l.date}` : ''} · {done}/{l.lines.length} klaar</small>
            </div>
          </div>
        );
      })}

      <h2>Geleerde barcodes</h2>
      {Object.keys(eanMap).length === 0 && (
        <p className="meta">Nog geen barcodes geleerd.</p>
      )}
      {Object.entries(eanMap).map(([ean, material]) => (
        <div key={ean} className="list-row">
          <div className="grow">
            {ean}
            <small>{describe(material)} ({material})</small>
          </div>
          <button className="badge" onClick={() => unlearnEan(ean)}>Verwijder</button>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={exportMap}>
        Exporteer barcodelijst
      </button>

      <h2>Labels</h2>
      <p className="meta">
        Open deze app op een PC en klik hieronder om de stapel-labels te printen.
      </p>
      <a className="btn btn-ghost" href="#labels" target="_blank" rel="noreferrer">
        Labels printen ({load.po})
      </a>

      <h2>Gevaarlijk</h2>
      <button
        className="btn"
        style={{ background: 'var(--err)' }}
        onClick={() => {
          if (window.confirm(`Alle voortgang van ${load.po} wissen?`)) resetProgress(load.po);
        }}
      >
        Voortgang wissen
      </button>
      <p className="meta">
        Actieve vrachtwagen: {load.po} — {Object.keys(progress).length} regels met voortgang.
      </p>
    </div>
  );
}
