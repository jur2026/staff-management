import { developerInfo } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Activity, Database, Cpu, RefreshCw, Server, Plug, ShieldAlert } from 'lucide-react';
import { fmtDateTime } from '../../lib/session';
import { PageHeader, StatCard, LoadingRows, useLoad, Empty } from '../../components/kit';

export default function Developer() {
  const { data, loading, reload } = useLoad(() => developerInfo({}));
  return (
    <div className="font-sans">
      <PageHeader title="Developer-console" description="Technische systeeminformatie. Bevat bewust geen personeelsgegevens of klachtinhoud." actions={<Button variant="outline" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" />Vernieuwen</Button>} />
      {loading || !data ? <LoadingRows rows={6} /> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Versie" value={data.version} icon={Cpu} hint={data.runtime} />
            <StatCard label="Status" value={data.maintenance ? 'Onderhoud' : 'Online'} icon={Server} tone={data.maintenance ? 'amber' : 'primary'} hint={`Gecontroleerd ${fmtDateTime(data.checkedAt)}`} />
            <StatCard label="Tabellen" value={data.tables.length} icon={Database} tone="blue" hint={`${data.tables.reduce((s, t) => s + t.rows, 0)} records`} />
            <StatCard label="DB-latency" value={`${data.api[0]?.latency ?? 0} ms`} icon={Activity} tone="blue" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Server className="h-4 w-4" />API- & dienststatus</CardTitle></CardHeader><CardContent className="space-y-2">
              {data.api.map((a) => <div key={a.name} className="flex items-center justify-between rounded-lg border p-3 font-mono text-xs"><span>{a.name}</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{a.status}{a.latency ? ` · ${a.latency}ms` : ''}</span></div>)}
              <div className="pt-2 text-xs font-semibold text-muted-foreground"><Plug className="mr-1 inline h-3 w-3" />Integraties</div>
              {data.integrations.map((i) => <div key={i.name} className="flex justify-between font-mono text-xs"><span>{i.name}</span><span>{i.status}</span></div>)}
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Systeemactiviteit (14 dagen)</CardTitle></CardHeader><CardContent>
              {!data.activity.length ? <Empty /> : <ResponsiveContainer width="100%" height={200}><BarChart data={data.activity}><XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="count" name="Events" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>}
            </CardContent></Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" />Database</CardTitle></CardHeader><CardContent className="max-h-96 overflow-auto">
              <Table><TableHeader><TableRow><TableHead>Tabel</TableHead><TableHead className="text-right">Records</TableHead><TableHead>Laatste schrijfactie</TableHead></TableRow></TableHeader>
                <TableBody>{data.tables.map((t) => <TableRow key={t.table}><TableCell className="font-mono text-xs">{t.table}</TableCell><TableCell className="text-right font-mono text-xs">{t.rows}</TableCell><TableCell className="text-xs">{fmtDateTime(t.lastWrite)}</TableCell></TableRow>)}</TableBody></Table>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4" />Technische logs (systeem, instellingen, rechten)</CardTitle></CardHeader><CardContent className="max-h-96 space-y-1 overflow-auto font-mono text-xs">
              {!data.logs.length ? <Empty /> : data.logs.map((l) => <div key={l.id} className="flex gap-2 border-b py-1.5"><span className="shrink-0 text-muted-foreground">{fmtDateTime(l.createdOn)}</span><span className="shrink-0 text-primary">[{l.category}]</span><span>{l.action}</span></div>)}
            </CardContent></Card>
          </div>
        </div>
      )}
    </div>
  );
}
