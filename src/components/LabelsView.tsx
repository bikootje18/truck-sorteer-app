import { useState } from 'react';
import loadsJson from '../data/loads.json';
import { fmtDate } from '../lib/format';
import { useStore } from '../store';
import type { Load } from '../types';

const loads = loadsJson as Load[];

export default function LabelsView() {
  const [po, setPo] = useState(() => useStore.getState().activePo ?? loads[0].po);
  const load = loads.find(l => l.po === po) ?? loads[0];

  return (
    <div className="labels-page">
      <div className="no-print" style={{ marginBottom: 16 }}>
        <select value={po} onChange={e => setPo(e.target.value)} style={{ fontSize: 18, padding: 8 }}>
          {loads.map(l => (
            <option key={l.po} value={l.po}>
              {l.po} — {l.plant} ({l.lines.length} labels)
            </option>
          ))}
        </select>{' '}
        <button onClick={() => window.print()} style={{ fontSize: 18, padding: 8 }}>
          🖨 Printen
        </button>
        <p>Print op A5 liggend (of A4 met 2 per vel via de printerinstellingen).</p>
      </div>
      {load.lines.map(l => (
        <div className="label" key={l.id}>
          <div className="label-stack">STAPEL {l.stackNo}</div>
          <div className="label-desc">{l.description}</div>
          <table>
            <tbody>
              <tr><td>Materiaal</td><td><b>{l.material}</b></td></tr>
              <tr><td>Batch</td><td><b>{l.batch}</b></td></tr>
              <tr><td>THT</td><td><b>{fmtDate(l.bbd)}</b></td></tr>
              <tr><td>Aantal</td><td><b>{l.cases} trays</b></td></tr>
              <tr><td>Van pallet</td><td>{l.inPallet}</td></tr>
              <tr><td>PO</td><td>{load.po}</td></tr>
            </tbody>
          </table>
          {l.presorted && <p><b>Al gesorteerd — alleen dit label erop.</b></p>}
        </div>
      ))}
    </div>
  );
}
