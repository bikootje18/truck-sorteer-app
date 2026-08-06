import type { Load } from '../types';

export default function SettingsScreen({ load }: { loads: Load[]; load: Load }) {
  return <div className="screen">Instellingen: {load.po}</div>;
}
