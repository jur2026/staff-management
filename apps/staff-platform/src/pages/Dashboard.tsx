import { Link } from 'react-router-dom';
import { dashboard, timeEntries } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { CalendarDays, Clock, ListChecks, CalendarOff, Play, Square, Coffee, Megaphone, ArrowRight } from 'lucide-react';
import { useSession, fmtDate, fmtTime, fmtDateTime } from '../lib/session';
import { StatCard, StatusBadge, Empty, LoadingRows, useLoad, run } from '../components/kit';

export default function Dashboard() {
  const { me, refresh } = useSession();
  const { data, loading, reload } = useLoad(() => dashboard({}));
  const act = async (action: 'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd', msg: string) => {
    if (await run(timeEntries({ action }), msg)) { reload(); refresh(); }
  };
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond';
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-sidebar p-6 text-white sm:p-8">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <p className="text-sm text-sidebar-foreground">{new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 text-3xl font-extrabold">{greet}, {me.name.split(' ')[0]}</h1>
        <p className="mt-1 text-sm text-sidebar-foreground">{me.jobTitle || me.roleName}{me.department ? ` · ${me.department}` : ''}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {!data?.running ? (
            <Button onClick={() => act('clockIn', 'Dienst gestart')} className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"><Play className="mr-2 h-4 w-4" />Start dienst</Button>
          ) : (
            <>
              <span className="flex items-center rounded-md bg-white/10 px-3 text-sm">Dienst sinds {fmtTime(data.running.start)}{data.running.onBreak && ' · pauze'}</span>
              {data.running.onBreak
                ? <Button variant="secondary" onClick={() => act('breakEnd', 'Pauze gestopt')}><Coffee className="mr-2 h-4 w-4" />Stop pauze</Button>
                : <Button variant="secondary" onClick={() => act('breakStart', 'Pauze gestart')}><Coffee className="mr-2 h-4 w-4" />Pauze</Button>}
              <Button onClick={() => act('clockOut', 'Dienst gestopt en ingediend')} className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"><Square className="mr-2 h-4 w-4" />Stop dienst</Button>
            </>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Uren deze week" value={data?.weekHours ?? '–'} icon={Clock} />
        <StatCard label="Komende diensten" value={data?.shifts.length ?? '–'} icon={CalendarDays} tone="blue" />
        <StatCard label="Open taken" value={data?.tasks.length ?? '–'} icon={ListChecks} tone="amber" />
        <StatCard label="Lopende aanvragen" value={data?.pendingAbsences ?? '–'} icon={CalendarOff} tone="red" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Mijn diensten</CardTitle><Link to="/rooster" className="text-xs font-semibold text-primary">Rooster <ArrowRight className="inline h-3 w-3" /></Link></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <LoadingRows rows={3} /> : !data?.shifts.length ? <Empty text="Geen geplande diensten" /> : data.shifts.map((s) => (
              <div key={s.id} className="rounded-lg border p-3"><div className="font-semibold">{s.title}</div><div className="text-xs text-muted-foreground">{fmtDate(s.start)} · {fmtTime(s.start)}–{fmtTime(s.end)}</div></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Taken & deadlines</CardTitle><Link to="/taken" className="text-xs font-semibold text-primary">Alle taken <ArrowRight className="inline h-3 w-3" /></Link></CardHeader>
          <CardContent className="space-y-2">
            {loading ? <LoadingRows rows={3} /> : !data?.tasks.length ? <Empty text="Geen open taken" /> : data.tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0"><div className="truncate font-semibold">{t.title}</div><div className="text-xs text-muted-foreground">{t.dueDate ? `Deadline ${fmtDate(t.dueDate)}` : 'Geen deadline'}</div></div>
                <StatusBadge status={t.priority} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Mededelingen</CardTitle><Link to="/mededelingen" className="text-xs font-semibold text-primary">Alles <ArrowRight className="inline h-3 w-3" /></Link></CardHeader>
          <CardContent className="space-y-3">
            {loading ? <LoadingRows rows={3} /> : !data?.announcements.length ? <Empty text="Geen mededelingen" icon={Megaphone} /> : data.announcements.map((a) => (
              <div key={a.id} className="border-l-2 border-primary pl-3"><div className="font-semibold">{a.title}</div><p className="line-clamp-2 text-sm text-muted-foreground">{a.body}</p><div className="text-xs text-muted-foreground">{a.author} · {fmtDateTime(a.createdOn)}</div></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
