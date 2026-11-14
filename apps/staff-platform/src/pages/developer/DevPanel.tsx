import { NavLink, Navigate, Route, Routes, Link } from 'react-router-dom';
import { Activity, Bug, BookText, FlaskConical, ListTodo, ArrowLeft, Terminal } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { useSession } from '../../lib/session';
import type { Perm } from '../../lib/permissions';
import Developer from '../admin/Developer';
import DevItems from './DevItems';
import Testing from './Testing';

const NAV: { to: string; label: string; icon: typeof Bug; perm: Perm }[] = [
  { to: '', label: 'Home & System Monitor', icon: Activity, perm: 'developer.view' },
  { to: 'bugs', label: 'Bug Tracker', icon: Bug, perm: 'dev.bugs' },
  { to: 'taken', label: 'Development Tasks', icon: ListTodo, perm: 'dev.tasks' },
  { to: 'tests', label: 'Testing Center', icon: FlaskConical, perm: 'dev.tests' },
  { to: 'docs', label: 'Technical Docs', icon: BookText, perm: 'dev.docs' },
];

export default function DevPanel() {
  const { can } = useSession();
  if (!can('developer.view')) return <Navigate to="/" replace />;
  const items = NAV.filter((n) => can(n.perm));
  return (
    <div className="dark flex min-h-screen flex-col bg-background font-mono text-foreground md:flex-row">
      <aside className="shrink-0 border-b border-border bg-card md:w-60 md:border-b-0 md:border-r">
        <div className="flex h-14 items-center gap-2 px-4 font-bold text-primary"><Terminal className="h-5 w-5" />dev_panel</div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col">
          {items.map((n) => (
            <NavLink key={n.to} to={`/developer/${n.to}`} end className={({ isActive }) => cn('flex shrink-0 items-center gap-2 rounded px-3 py-2 text-xs', isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}>
              <n.icon className="h-4 w-4" />{n.label}
            </NavLink>
          ))}
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded px-3 py-2 text-xs text-muted-foreground hover:text-foreground md:mt-6"><ArrowLeft className="h-4 w-4" />Terug naar werkplek</Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        <Routes>
          <Route index element={<Developer />} />
          {can('dev.bugs') && <Route path="bugs" element={<DevItems kind="Bug" title="Bug Tracker" />} />}
          {can('dev.tasks') && <Route path="taken" element={<DevItems kind="Taak" title="Development Tasks" />} />}
          {can('dev.tests') && <Route path="tests" element={<Testing />} />}
          {can('dev.docs') && <Route path="docs" element={<DevItems kind="Documentatie" title="Technical Documentation" />} />}
          <Route path="*" element={<Navigate to="/developer" replace />} />
        </Routes>
      </main>
    </div>
  );
}
