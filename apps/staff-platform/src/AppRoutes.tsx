import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './lib/session';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import AbsenceView from './pages/Absence';
import ComplaintsView from './pages/Complaints';
import TimeView from './pages/Time';
import ScheduleView from './pages/Schedule';
import TasksView from './pages/Tasks';
import Documents from './pages/Documents';
import Announcements from './pages/Announcements';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import ReviewsView from './pages/Reviews';
import AuditView from './pages/Audit';
import CustomPage from './pages/CustomPage';
import PanelPage from './pages/PanelPage';
import Developer from './pages/admin/Developer';
import type { ModuleKey } from './lib/permissions';

export default function AppRoutes() {
  const { moduleOn, can } = useSession();
  const gate = (m: ModuleKey, el: JSX.Element) => (moduleOn(m) ? el : <Navigate to="/" replace />);
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/profiel" element={<Profile />} />
      <Route path="/afwezigheid" element={gate('absence', <AbsenceView />)} />
      <Route path="/klachten" element={gate('complaints', <ComplaintsView />)} />
      <Route path="/uren" element={gate('time', <TimeView />)} />
      <Route path="/rooster" element={gate('schedule', <ScheduleView />)} />
      <Route path="/taken" element={gate('tasks', <TasksView />)} />
      <Route path="/documenten" element={gate('documents', <Documents />)} />
      <Route path="/mededelingen" element={gate('announcements', <Announcements />)} />
      <Route path="/berichten" element={gate('messages', <Messages />)} />
      <Route path="/ontwikkeling" element={gate('reviews', <ReviewsView />)} />
      <Route path="/meldingen" element={<Notifications />} />
      <Route path="/audit" element={<AuditView />} />
      <Route path="/pagina/:id" element={<CustomPage />} />
      <Route path="/developer" element={can('developer.view') ? <Developer /> : <Navigate to="/" replace />} />
      {(['beheer', 'bestuur', 'management'] as const).map((p) => (
        <Route key={p} path={`/${p}/:section?`} element={<PanelPage panel={p} />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
