import { NavLink, Navigate, useParams } from 'react-router-dom';
import { cn } from '@project/components/lib/utils';
import { useSession } from '../lib/session';
import { PANELS, SECTIONS, type PanelKey, type SectionKey } from '../lib/nav';
import MembersAdmin from './admin/Members';
import { Roles, Departments } from './admin/Org';
import Codes from './admin/Codes';
import Decisions from './admin/Decisions';
import Reports from './admin/Reports';
import SettingsPage from './admin/Settings';
import PagesAdmin from './admin/PagesAdmin';
import AbsenceView from './Absence';
import ComplaintsView from './Complaints';
import TimeView from './Time';
import ScheduleView from './Schedule';
import AvailabilitySwaps from './AvailabilitySwaps';
import TasksView from './Tasks';
import ReviewsView from './Reviews';
import Documents from './Documents';
import Announcements from './Announcements';
import AuditView from './Audit';

const RENDER: Record<SectionKey, () => JSX.Element> = {
  dashboard: () => <Reports compact />,
  gebruikers: () => <MembersAdmin />,
  personeel: () => <MembersAdmin />,
  rollen: () => <Roles />,
  codes: () => <Codes />,
  afdelingen: () => <Departments />,
  afwezigheid: () => <AbsenceView mode="team" />,
  klachten: () => <ComplaintsView mode="handle" />,
  uren: () => <TimeView mode="team" />,
  rooster: () => <ScheduleView mode="manage" />,
  beschikbaarheid: () => <AvailabilitySwaps />,
  taken: () => <TasksView mode="team" />,
  gesprekken: () => <ReviewsView mode="manage" />,
  besluiten: () => <Decisions />,
  documenten: () => <Documents manage />,
  mededelingen: () => <Announcements />,
  rapportages: () => <Reports />,
  audit: () => <AuditView />,
  instellingen: () => <SettingsPage />,
  paginas: () => <PagesAdmin />,
};

export default function PanelPage({ panel }: { panel: PanelKey }) {
  const { section } = useParams();
  const { canAny, moduleOn } = useSession();
  const cfg = PANELS[panel];
  if (!canAny(...cfg.access)) return <Navigate to="/" replace />;
  const visible = cfg.sections.filter((k) => canAny(...SECTIONS[k].perms) && (!SECTIONS[k].module || moduleOn(SECTIONS[k].module!)));
  const current = (section as SectionKey) || visible[0];
  if (!visible.includes(current)) return <Navigate to={`/${panel}/${visible[0] || ''}`} replace />;
  return (
    <div className="grid gap-6 xl:grid-cols-[220px_1fr]">
      <nav className="no-print -mx-4 flex gap-1 overflow-x-auto px-4 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0">
        <div className="mb-2 hidden px-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground xl:block">Panel {cfg.label}</div>
        {visible.map((k) => {
          const S = SECTIONS[k];
          return (
            <NavLink key={k} to={`/${panel}/${k}`} className={({ isActive }) => cn('flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive || (k === current && !section) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
              <S.icon className="h-4 w-4" />{S.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="min-w-0">{RENDER[current]()}</div>
    </div>
  );
}
