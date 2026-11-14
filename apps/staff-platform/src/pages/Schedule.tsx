import { useMemo, useState } from 'react';
import { schedule, listOrg, type ScheduleOutputType } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@project/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { ChevronLeft, ChevronRight, Plus, AlertTriangle, Send, Copy, Trash2, Hand, Repeat } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { useSession, fmtTime, fmtDate } from '../lib/session';
import { PageHeader, Field, useLoad, run, LoadingRows } from '../components/kit';
import { DateTimeField, MemberSelect, Select } from '../components/fields';
import AvailabilitySwaps from './AvailabilitySwaps';

type Shift = Extract<ScheduleOutputType, { shifts: unknown }>['shifts'][0];
type View = 'day' | 'week' | 'month';
const key = (d: Date) => d.toLocaleDateString('sv');
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

function rangeFor(view: View, anchor: Date) {
  const a = new Date(anchor); a.setHours(0, 0, 0, 0);
  if (view === 'day') return { start: a, days: 1 };
  if (view === 'week') return { start: startOfWeek(a), days: 7 };
  const first = new Date(a.getFullYear(), a.getMonth(), 1);
  const last = new Date(a.getFullYear(), a.getMonth() + 1, 0);
  const s = startOfWeek(first);
  const days = Math.ceil(((last.getTime() - s.getTime()) / 86400000 + 1) / 7) * 7;
  return { start: s, days };
}

function ShiftDialog({ shift, defaultDate, onClose, onSaved }: { shift: Shift | null; defaultDate: Date; onClose: () => void; onSaved: () => void }) {
  const { data: org } = useLoad(() => listOrg({}));
  const s0 = new Date(defaultDate); s0.setHours(9, 0, 0, 0);
  const e0 = new Date(defaultDate); e0.setHours(17, 0, 0, 0);
  const [f, setF] = useState({ title: shift?.title || 'Dienst', memberId: shift?.memberId || '', start: shift?.start || s0.toISOString(), end: shift?.end || e0.toISOString(), departmentId: shift?.departmentId || '', notes: shift?.notes || '', published: shift?.published ?? false });
  const [repeat, setRepeat] = useState(0);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!f.title.trim()) return setErr('Titel is verplicht');
    if (!f.start || !f.end || new Date(f.end) <= new Date(f.start)) return setErr('Einde moet na begin liggen');
    if (await run(schedule({ action: 'save', id: shift?.id, repeatWeeks: shift ? 0 : repeat, data: { ...f, memberId: f.memberId || undefined, departmentId: f.departmentId || undefined } }), 'Dienst opgeslagen')) { onSaved(); onClose(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{shift ? 'Dienst bewerken' : 'Nieuwe dienst'}</DialogTitle></DialogHeader>
        {shift?.warnings.length ? <div className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4 shrink-0" />{shift.warnings.join(' · ')}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titel"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Afdeling"><Select value={f.departmentId} onChange={(v) => setF({ ...f, departmentId: v })} placeholder="—" options={(org?.departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Field>
          <Field label="Medewerker" className="sm:col-span-2"><MemberSelect value={f.memberId} onChange={(v) => setF({ ...f, memberId: v })} placeholder="Open dienst (nog niet toegewezen)" /></Field>
          <Field label="Begin"><DateTimeField value={f.start} onChange={(v) => setF({ ...f, start: v })} /></Field>
          <Field label="Einde"><DateTimeField value={f.end} onChange={(v) => setF({ ...f, end: v })} /></Field>
          <Field label="Notities" className="sm:col-span-2"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          {!shift && <Field label="Wekelijks herhalen (aantal weken)"><Input type="number" min={0} max={26} value={repeat} onChange={(e) => setRepeat(Math.min(26, Math.max(0, Number(e.target.value))))} /></Field>}
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} />Direct publiceren</label>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter className="gap-2">
          {shift && <Button variant="outline" onClick={async () => { if (await run(schedule({ action: 'duplicate', id: shift.id }), 'Gedupliceerd naar volgende week')) { onSaved(); onClose(); } }}><Copy className="mr-2 h-4 w-4" />Dupliceren</Button>}
          {shift && <Button variant="outline" className="text-destructive" onClick={async () => { if (await run(schedule({ action: 'delete', id: shift.id }), 'Dienst verwijderd')) { onSaved(); onClose(); } }}><Trash2 className="mr-2 h-4 w-4" />Verwijderen</Button>}
          <Button onClick={save}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SwapDialog({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const { me } = useSession();
  const [targetId, setTarget] = useState('');
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dienst ruilen</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{shift.title} · {fmtDate(shift.start)} {fmtTime(shift.start)}–{fmtTime(shift.end)}</p>
        <Field label="Ruilen met (optioneel)"><MemberSelect value={targetId} onChange={setTarget} placeholder="Iedereen (open verzoek)" excludeId={me.id} /></Field>
        <Field label="Reden"><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button disabled={reason.trim().length < 3} onClick={async () => { if (await run(schedule({ action: 'requestSwap', swap: { shiftId: shift.id, targetId: targetId || undefined, reason } }), 'Ruilverzoek verstuurd')) onClose(); }}>Versturen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Calendar({ manage }: { manage: boolean }) {
  const { me } = useSession();
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(new Date());
  const { start, days } = rangeFor(view, anchor);
  const end = new Date(start); end.setDate(end.getDate() + days);
  const { data, loading, reload } = useLoad(() => schedule({ action: 'list', from: start.toISOString(), to: end.toISOString() }) as Promise<Extract<ScheduleOutputType, { shifts: unknown }>>, [start.getTime(), days]);
  const [edit, setEdit] = useState<{ shift: Shift | null; date: Date } | null>(null);
  const [swap, setSwap] = useState<Shift | null>(null);
  const byDay = useMemo(() => { const m = new Map<string, Shift[]>(); (data?.shifts || []).forEach((s) => { const k = key(new Date(s.start)); m.set(k, [...(m.get(k) || []), s]); }); return m; }, [data]);
  const move = (dir: number) => { const a = new Date(anchor); if (view === 'day') a.setDate(a.getDate() + dir); else if (view === 'week') a.setDate(a.getDate() + 7 * dir); else a.setMonth(a.getMonth() + dir); setAnchor(a); };
  const dayList = Array.from({ length: days }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const drafts = (data?.shifts || []).filter((s) => !s.published).length;
  const conflicts = (data?.shifts || []).filter((s) => s.warnings.length).length;
  const title = view === 'month' ? anchor.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }) : view === 'day' ? anchor.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }) : `${fmtDate(start.toISOString())} – ${fmtDate(new Date(end.getTime() - 1).toISOString())}`;

  const ShiftChip = ({ s }: { s: Shift }) => {
    const mine = s.memberId === me.id;
    return (
      <div className={cn('group rounded-md border px-2 py-1 text-xs', !s.memberId ? 'border-dashed border-amber-500/60 bg-amber-500/5' : mine ? 'border-primary/30 bg-primary/10' : 'bg-card', !s.published && 'opacity-70', s.warnings.length && 'border-red-500/60')}
        onClick={() => manage && setEdit({ shift: s, date: new Date(s.start) })} role={manage ? 'button' : undefined}>
        <div className="flex items-center gap-1 font-semibold">{s.warnings.length > 0 && <AlertTriangle className="h-3 w-3 text-red-500" />}{fmtTime(s.start)}–{fmtTime(s.end)}</div>
        <div className="truncate">{s.title}</div>
        <div className="truncate text-muted-foreground">{s.memberName || 'Open dienst'}{!s.published && ' · concept'}</div>
        {!manage && !s.memberId && <Button size="sm" variant="outline" className="mt-1 h-6 w-full text-[11px]" onClick={async () => { if (await run(schedule({ action: 'claim', id: s.id }), 'Dienst opgepakt')) reload(); }}><Hand className="mr-1 h-3 w-3" />Oppakken</Button>}
        {!manage && mine && new Date(s.start) > new Date() && <Button size="sm" variant="ghost" className="mt-1 h-6 w-full text-[11px]" onClick={() => setSwap(s)}><Repeat className="mr-1 h-3 w-3" />Ruilen</Button>}
      </div>
    );
  };

  return (
    <Card><CardContent className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => setAnchor(new Date())}>Vandaag</Button>
        <Button size="icon" variant="outline" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
        <div className="ml-2 font-bold capitalize">{title}</div>
        <div className="flex-1" />
        {manage && conflicts > 0 && <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600"><AlertTriangle className="h-3 w-3" />{conflicts} conflict(en)</span>}
        <div className="flex rounded-md border p-0.5">{(['day', 'week', 'month'] as View[]).map((v) => <button key={v} onClick={() => setView(v)} className={cn('rounded px-3 py-1 text-sm', view === v && 'bg-primary text-primary-foreground')}>{{ day: 'Dag', week: 'Week', month: 'Maand' }[v]}</button>)}</div>
        {manage && <Button variant="outline" disabled={!drafts} onClick={async () => { if (await run(schedule({ action: 'publish', from: start.toISOString(), to: end.toISOString() }), 'Rooster gepubliceerd')) reload(); }}><Send className="mr-2 h-4 w-4" />Publiceren ({drafts})</Button>}
        {manage && <Button onClick={() => setEdit({ shift: null, date: anchor })}><Plus className="mr-2 h-4 w-4" />Dienst</Button>}
      </div>
      {loading ? <LoadingRows /> : (
        <div className={cn('grid gap-px overflow-hidden rounded-lg border bg-border', view === 'day' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-7')}>
          {view !== 'day' && ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d) => <div key={d} className="hidden bg-muted px-2 py-1 text-center text-xs font-bold sm:block">{d}</div>)}
          {dayList.map((d) => {
            const list = byDay.get(key(d)) || [];
            const isToday = key(d) === key(new Date());
            const outside = view === 'month' && d.getMonth() !== anchor.getMonth();
            return (
              <div key={key(d)} className={cn('min-h-[110px] space-y-1 bg-card p-1.5', outside && 'bg-muted/40', view === 'day' && 'min-h-[300px]')}
                onDoubleClick={() => manage && setEdit({ shift: null, date: d })}>
                <div className={cn('mb-1 flex h-6 w-fit min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold', isToday && 'bg-primary text-primary-foreground')}>
                  <span className="mr-1 sm:hidden">{d.toLocaleDateString('nl-NL', { weekday: 'short' })}</span>{d.getDate()}
                </div>
                {list.map((s) => <ShiftChip key={s.id} s={s} />)}
              </div>
            );
          })}
        </div>
      )}
      {manage && <p className="mt-2 text-xs text-muted-foreground">Tip: dubbelklik op een dag om direct een dienst toe te voegen. Rood = dubbele boeking of afwezigheid.</p>}
      {edit && <ShiftDialog shift={edit.shift} defaultDate={edit.date} onClose={() => setEdit(null)} onSaved={reload} />}
      {swap && <SwapDialog shift={swap} onClose={() => setSwap(null)} />}
    </CardContent></Card>
  );
}

export default function ScheduleView({ mode = 'mine' }: { mode?: 'mine' | 'manage' }) {
  if (mode === 'manage') return (<div><PageHeader title="Roosterplanner" description="Plan, wijs toe, dupliceer en publiceer diensten. Conflicten worden automatisch gemarkeerd." /><Calendar manage /></div>);
  return (
    <div>
      <PageHeader title="Mijn rooster" description="Bekijk je diensten, pak open diensten op, geef beschikbaarheid door en vraag ruilingen aan." />
      <Tabs defaultValue="rooster">
        <TabsList className="mb-4"><TabsTrigger value="rooster">Rooster</TabsTrigger><TabsTrigger value="beschikbaarheid">Beschikbaarheid & ruilen</TabsTrigger></TabsList>
        <TabsContent value="rooster"><Calendar manage={false} /></TabsContent>
        <TabsContent value="beschikbaarheid"><AvailabilitySwaps embedded /></TabsContent>
      </Tabs>
    </div>
  );
}
