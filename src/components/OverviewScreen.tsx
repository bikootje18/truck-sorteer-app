import type { Load } from '../types';

export default function OverviewScreen({ load }: { load: Load }) {
  return <div className="screen">Overzicht: {load.po}</div>;
}
