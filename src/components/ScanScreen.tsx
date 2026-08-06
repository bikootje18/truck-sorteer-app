import type { Load } from '../types';

export default function ScanScreen({ load }: { load: Load; allLoads: Load[] }) {
  return <div className="screen">Scannen: {load.po}</div>;
}
