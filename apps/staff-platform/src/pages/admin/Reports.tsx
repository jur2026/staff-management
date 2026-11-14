import { useState } from 'react';
import { reports, listOrg } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Users, UserX, Clock, MessageSquareWarning, CalendarDays, ListChecks, Download, Printer } from 'lucide-react';
import { useSession, today, addDays, exportCSV, fmtDate } from '../../lib/session';
import { PageHeader, StatCard, LoadingRows, Empty, useLoad } from '../../components/kit';
import { DateField, Select } from '../../components/fields';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--muted-foreground))'];
const sum = (a: { count: number }[], f?: (x: { status: string }) => boolean) => a.filter((x) => !f || f(x as unknown as { status: string })).reduce((s, x) => s + x.count, 0);

function Donut({ data, nameKey }: { data: { count: number; [k: string]: unknown }[]; nameKey: string }) {
  if (!data.length) return <Empty text="Geen gegevens" />;
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={180}><PieChart><Pie data={data} dataKey="count" nameKey={nameKey} innerRadius={45} outerRadius={75} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
      <div className="space-y-1 text-sm">{data.map((d, i) => <div key={i} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{String(d[nameKey])}<b className="ml-auto pl-3">{d.count}</b></div>)}</div>
    </div>
  );
}

export default function Reports({ compact = false }: { compact?: boolean }) {
  const { can, me } = useSession();
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [dept, setDept] = useState('');
  const { data: org } = useLoad(() => listOrg({}));
  const { data, loading } = useLoad(() => reports({ from, to, departmentId: dept || undefined }), [from, to, dept]);
  const totalHours = data?.hoursPerMember.reduce((s, m) => s + m.hours, 0) || 0;
  const openC = sum(data?.complaints || [], (x) => !['Opgelost', 'Afgewezen', 'Gesloten'].includes(x.status));
  return (
    <div>
      <PageHeader title={compact ? 'Dashboard' : 'Rapportages & exports'} description={compact ? `Overzicht van de afgelopen periode${!can('scope.all') && me.department ? ` · afdeling ${me.department}` : ''}.` : 'Statistieken over personeel, aanwezigheid, uren, klachten, roosters en taken.'}
        actions={<>
          <div className="w-40"><DateField value={from} onChange={setFrom} /></div>
          <div className="w-40"><DateField value={to} onChange={setTo} /></div>
          {can('scope.all') && <Select className="w-auto" value={dept} onChange={setDept} placeholder="Alle afdelingen" options={(org?.departments || []).map((d) => ({ value: d.id, label: d.name }))} />}
          {!compact && <Button variant="outline" onClick={() => data && exportCSV(`uren-${from}-${to}`, data.hoursPerMember.map((m) => ({ Medewerker: m.name, Uren: m.hours, Registraties: m.entries, TeBeoordelen: m.pending })))}><Download className="mr-2 h-4 w-4" />CSV</Button>}
          {!compact && <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />PDF</Button>}
        </>} />
      {loading || !data ? <LoadingRows rows={6} /> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Actief" value={sum(data.members, (x) => x.status === 'Actief')} icon={Users} hint={`${sum(data.members, (x) => x.status === 'Geblokkeerd')} geblokkeerd`} />
            <StatCard label="Afwezig vandaag" value={data.absentToday} icon={UserX} tone="red" />
            <StatCard label="Gewerkte uren" value={totalHours.toFixed(0)} icon={Clock} tone="blue" />
            <StatCard label="Open klachten" value={openC} icon={MessageSquareWarning} tone="amber" />
            <StatCard label="Open diensten" value={data.shifts.open} icon={CalendarDays} hint={`${data.shifts.total} diensten`} tone="blue" />
            <StatCard label="Taken te laat" value={data.tasks.reduce((s, t) => s + t.overdue, 0)} icon={ListChecks} tone="red" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="text-base">Gewerkte uren per dag</CardTitle></CardHeader><CardContent>
              {!data.hoursByDay.length ? <Empty text="Geen uren" /> : <ResponsiveContainer width="100%" height={220}><AreaChart data={data.hoursByDay}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Area dataKey="hours" name="Uren" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1) / 0.2)" /></AreaChart></ResponsiveContainer>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Uren per medewerker</CardTitle></CardHeader><CardContent>
              {!data.hoursPerMember.some((m) => m.hours) ? <Empty text="Geen uren" /> : <ResponsiveContainer width="100%" height={220}><BarChart data={data.hoursPerMember.filter((m) => m.hours).slice(0, 12)} layout="vertical"><XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="name" width={110} fontSize={11} /><Tooltip /><Bar dataKey="hours" name="Uren" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Afwezigheid per categorie</CardTitle></CardHeader><CardContent><Donut data={data.absenceByCategory} nameKey="category" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Verlofaanvragen per status</CardTitle></CardHeader><CardContent><Donut data={data.absence} nameKey="status" /></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Taken per status</CardTitle></CardHeader><CardContent><Donut data={data.tasks} nameKey="status" /></CardContent></Card>
            {data.complaints.length > 0 && <Card><CardHeader><CardTitle className="text-base">Klachten per status</CardTitle></CardHeader><CardContent><Donut data={data.complaints} nameKey="status" /></CardContent></Card>}
            <Card><CardHeader><CardTitle className="text-base">Roosterbezetting</CardTitle></CardHeader><CardContent className="space-y-3">
              {[['Ingevulde diensten', data.shifts.total - data.shifts.open], ['Open diensten', data.shifts.open], ['Gepubliceerd', data.shifts.published]].map(([l, v]) => (
                <div key={l as string}><div className="mb-1 flex justify-between text-sm"><span>{l}</span><b>{v}</b></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${data.shifts.total ? ((v as number) / data.shifts.total) * 100 : 0}%` }} /></div></div>
              ))}
            </CardContent></Card>
          </div>
          {!compact && (
            <Card><CardHeader><CardTitle className="text-base">Medewerkerprestaties · {fmtDate(from)} – {fmtDate(to)}</CardTitle></CardHeader><CardContent className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Medewerker</TableHead><TableHead className="text-right">Uren</TableHead><TableHead className="text-right">Registraties</TableHead><TableHead className="text-right">Te beoordelen</TableHead></TableRow></TableHeader>
                <TableBody>{data.hoursPerMember.map((m) => <TableRow key={m.id}><TableCell className="font-medium">{m.name}</TableCell><TableCell className="text-right font-semibold">{m.hours}</TableCell><TableCell className="text-right">{m.entries}</TableCell><TableCell className="text-right">{m.pending}</TableCell></TableRow>)}</TableBody></Table>
            </CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
