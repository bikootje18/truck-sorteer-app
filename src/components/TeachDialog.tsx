import { useState } from 'react';

interface Props {
  articles: [string, string][]; // [material, description]
  onPick: (material: string) => void;
  onCancel: () => void;
}

export default function TeachDialog({ articles, onPick, onCancel }: Props) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = articles.filter(
    ([mat, desc]) => !query || mat.includes(query) || desc.toLowerCase().includes(query),
  );
  return (
    <div className="card warn">
      <h2>Welk artikel is dit?</h2>
      <p className="meta">Onbekende barcode — kies het artikel, dan onthoudt de app het.</p>
      <input
        className="scan-input"
        placeholder="Zoek op naam of nummer…"
        value={q}
        onChange={e => setQ(e.target.value)}
        autoFocus
      />
      {shown.map(([mat, desc]) => (
        <div key={mat} className="list-row" onClick={() => onPick(mat)}>
          <div className="grow">
            {desc}
            <small>{mat}</small>
          </div>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={onCancel}>Annuleren</button>
    </div>
  );
}
