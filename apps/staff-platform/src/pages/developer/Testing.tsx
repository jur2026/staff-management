import { useState } from 'react';
import { devTests } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { CheckCircle2, FlaskConical, Loader2, XCircle } from 'lucide-react';
import { fmtDateTime, useSession } from '../../lib/session';
import { Empty, LoadingRows, run, useLoad } from '../../components/kit';

export default function Testing() {
  const { can } = useSession();
  const { data, loading, setData } = useLoad(() => devTests({ action: 'list' }));
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); const r = await run(devTests({ action: 'run' }), 'Testronde voltooid'); if (r) setData(r); setBusy(false); };
  const runs = new Map<string, NonNullable<typeof data>['results']>();
  (data?.results || []).forEach((r) => runs.set(r.runId, [...(runs.get(r.runId) || []), r]));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-mono text-xl font-bold">Testing Center</h1><p className="text-sm text-muted-foreground">Voert echte controles uit op database, rollen en rechtenmodel. Resultaten worden opgeslagen.</p></div>
        {can('dev.tests') && <Button onClick={go} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}Testronde starten</Button>}
      </div>
      {loading ? <LoadingRows /> : !runs.size ? <Empty text="Nog geen testrondes" /> : [...runs.entries()].map(([id, rs]) => (
        <div key={id} className="rounded-lg border bg-card">
          <div className="flex justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground"><span>run {id} · {rs[0].runBy}</span><span>{fmtDateTime(rs[0].createdOn)} · {rs.filter((r) => r.result === 'Geslaagd').length}/{rs.length} geslaagd</span></div>
          {rs.map((r) => (
            <div key={r.id} className="flex items-start gap-2 px-3 py-1.5 font-mono text-xs">
              {r.result === 'Geslaagd' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
              <span className="flex-1">{r.testName}</span><span className="text-muted-foreground">{r.details}</span><span className="w-12 text-right text-muted-foreground">{r.durationMs}ms</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
