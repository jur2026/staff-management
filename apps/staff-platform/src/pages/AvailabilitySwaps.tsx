import { useState } from 'react';
import { schedule, type ScheduleOutputType } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Trash2, Check, X } from 'lucide-react';
import { useSession, fmtDate, fmtDateTime, today } from '../lib/session';
import { PageHeader, StatusBadge, Empty, LoadingRows, Field, useLoad, run } from '../components/kit';
import { DateField, Select } from '../components/fields';

type Avail = Extract<ScheduleOutputType, { items: { type: string }[] }>;
type Swaps = Extract<ScheduleOutputType, { items: { shiftTitle: string }[] }>;

export default function AvailabilitySwaps({ embedded = false }: { embedded?: boolean }) {
  const { me } = useSession();
  const av = useLoad(() => schedule({ action: 'availability', from: today() }) as Promise<Avail>);
  const sw = useLoad(() => schedule({ action: 'swaps' }) as Promise<Swaps>);
  const [f, setF] = useState({ date: today(), type: 'Beschikbaar', note: '' });
  const decide = async (id: string, decision: 'Goedgekeurd' | 'Afgewezen' | 'Geannuleerd') => { if (await run(schedule({ action: 'decideSwap', id, decision }), 'Bijgewerkt')) sw.reload(); };
  return (
    <div>
      {!embedded && <PageHeader title="Beschikbaarheid & dienstruilen" description="Overzicht van doorgegeven beschikbaarheid en ruilverzoeken binnen je team." />}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Beschikbaarheid</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <Field label="Datum"><DateField value={f.date} onChange={(v) => setF({ ...f, date: v })} /></Field>
              <Field label="Type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={['Beschikbaar', 'Niet beschikbaar', 'Voorkeur']} /></Field>
              <Field label="Notitie"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
              <Button onClick={async () => { if (f.date && (await run(schedule({ action: 'saveAvailability', availability: f }), 'Doorgegeven'))) av.reload(); }}>Opslaan</Button>
            </div>
            {av.loading ? <LoadingRows rows={3} /> : !av.data?.items.length ? <Empty text="Geen beschikbaarheid doorgegeven" /> : (
              <div className="divide-y rounded-lg border">
                {av.data.items.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="w-28 font-semibold">{fmtDate(a.date)}</div>
                    <StatusBadge status={a.type} />
                    <div className="flex-1 truncate text-muted-foreground">{a.memberId !== me.id && <b className="mr-1 text-foreground">{a.memberName}</b>}{a.note}</div>
                    {a.memberId === me.id && <Button size="icon" variant="ghost" onClick={async () => { if (await run(schedule({ action: 'deleteAvailability', id: a.id }))) av.reload(); }}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Dienstwisselverzoeken</CardTitle></CardHeader>
          <CardContent>
            {sw.loading ? <LoadingRows rows={3} /> : !sw.data?.items.length ? <Empty text="Geen ruilverzoeken. Vraag een ruil aan vanuit je rooster." /> : (
              <div className="space-y-2">
                {sw.data.items.map((s) => (
                  <div key={s.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2"><b>{s.shiftTitle} · {fmtDateTime(s.shiftStart)}</b><StatusBadge status={s.status} /></div>
                    <div className="text-muted-foreground">{s.requester} → {s.target}</div>
                    <div className="mt-1">{s.reason}</div>
                    {s.status === 'Aangevraagd' && (
                      <div className="mt-2 flex gap-2">
                        {sw.data!.canManage && s.requesterId !== me.id && <><Button size="sm" onClick={() => decide(s.id, 'Goedgekeurd')}><Check className="mr-1 h-4 w-4" />Goedkeuren</Button><Button size="sm" variant="outline" onClick={() => decide(s.id, 'Afgewezen')}><X className="mr-1 h-4 w-4" />Afwijzen</Button></>}
                        {s.requesterId === me.id && <Button size="sm" variant="ghost" onClick={() => decide(s.id, 'Geannuleerd')}>Annuleren</Button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
