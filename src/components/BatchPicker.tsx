import { fmtDate } from '../lib/format';
import type { Line, Progress } from '../types';

interface Props {
  candidates: Line[];
  progress: Progress;
  onPick: (line: Line) => void;
  onCancel: () => void;
}

export default function BatchPicker({ candidates, progress, onPick, onCancel }: Props) {
  return (
    <div className="card warn">
      <h2>Welke batch staat op de tray?</h2>
      <p className="meta">De batch staat op de zijkant gedrukt. Twijfel? Kijk naar de THT.</p>
      {candidates.map(line => (
        <div key={line.id} className="list-row" onClick={() => onPick(line)}>
          <div className="grow">
            {line.description}
            <small>
              Batch <b>{line.batch}</b> · THT {fmtDate(line.bbd)} · Stapel {line.stackNo} ·{' '}
              {line.cases} trays · {line.category}
              {progress[line.id]?.status === 'partial' ? ' · deels verplaatst' : ''}
            </small>
          </div>
        </div>
      ))}
      <button className="btn btn-ghost" onClick={onCancel}>Annuleren</button>
    </div>
  );
}
