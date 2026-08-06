import loadsJson from './data/loads.json';
import LabelsView from './components/LabelsView';
import OverviewScreen from './components/OverviewScreen';
import ScanScreen from './components/ScanScreen';
import SettingsScreen from './components/SettingsScreen';
import { useStore, type View } from './store';
import type { Load } from './types';

const loads = loadsJson as Load[];
const TABS: { view: View; label: string }[] = [
  { view: 'scan', label: 'Sorteren' },
  { view: 'overview', label: 'Overzicht' },
  { view: 'settings', label: 'Instellingen' },
];

const storageOk = (() => {
  try {
    localStorage.setItem('sorteer:probe', '1');
    localStorage.removeItem('sorteer:probe');
    return true;
  } catch {
    return false;
  }
})();

export default function App() {
  const view = useStore(s => s.view);
  const setView = useStore(s => s.setView);
  const activePo = useStore(s => s.activePo);
  const load = loads.find(l => l.po === activePo) ?? loads[0];

  if (window.location.hash === '#labels') return <LabelsView />;

  return (
    <div className="app">
      {!storageOk && (
        <div className="card err">
          Opslag niet beschikbaar — voortgang wordt niet bewaard na afsluiten.
        </div>
      )}
      {view === 'scan' && <ScanScreen load={load} allLoads={loads} />}
      {view === 'overview' && <OverviewScreen load={load} />}
      {view === 'settings' && <SettingsScreen loads={loads} load={load} />}
      <nav className="nav">
        {TABS.map(t => (
          <button
            key={t.view}
            className={view === t.view ? 'active' : ''}
            onClick={() => setView(t.view)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
