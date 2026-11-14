import { useMemo, useState } from 'react';
import { timeEntries, type TimeEntriesOutputType } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { Plus, Play, Square, Coffee, Download, Check, X, Pencil, Trash2, Clock, Undo2 } from 'lucide-react';
import { useSession, fmtDate, fmtTime, workedHours, today, addDays, exportCSV } from '../lib/session';
import { PageHeader, StatusBadge, Empty, LoadingRows, Field, StatCard, useLoad, run } from '../components/kit';
import { DateField, Select } from '../components/fields';

type List = Extract<TimeEntriesOutputType, { items: unknown }>;
type Item = List['items'][0];

function periodRange(p: string) {
  const t = today();
  const d = new Date(`${t}T12:00:00`);
  if (p === 'week') return { from: addDays(t, -((d.getDay() + 6) % 7)), to: addDays(t, 6 - ((d.getDay() + 6) % 7)) };
  if (p === 'month') return { from: t.slice(0, 8) + '01', to: t };
  if (p === 'lastmonth') { const s = new Date(d.getFullYear(), d.getMonth() - 1, 1); const e = new Date(d.getFullYear(), d.getMonth(), 0); return { from: s.toLocaleDateString('sv'), to: e.toLocaleDateString('sv') }; }
  return { from: addDays(t, -90), to: t };
}

function EntryDialog({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const { me } = useSession();
  const hm = (s?: string) => (s ? new Date(s).toTimeString().slice(0, 5) : '');
  const [f, setF] = useState({ workDate: item?.workDate?.slice(0, 10) || today(), start: hm(item?.start) || '09:00', end: hm(item?.end) || '17:00', breakMinutes: item?.breakMinutes ?? 30, activity: item?.activity || '', department: item?.department || me.department, notes: item?.notes || '' });
  const [err, setErr] = useState('');
  const save = async () => {
    const start = new Date(`${f.workDate}T${f.start}`), end = new Date(`${f.workDate}T${f.end}`);
    if (end <= start) end.setDate(end.getDate() + 1);
    if (f.activity.trim().length < 2) return setErr('Omschrijf de werkzaamheden');
    if ((end.getTime() - start.getTime()) / 60000 <= f.breakMinutes) return setErr('Pauze is langer dan de dienst');
    if (await run(timeEntries({ action: 'save', id: item?.id, data: { ...f, start: start.toISOString(), end: end.toISOString() } }), 'Uren opgeslagen')) { onSaved(); onClose(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'Uren wijzigen' : 'Uren registreren'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Werkdatum" className="sm:col-span-3"><DateField value={f.workDate} onChange={(v) => setF({ ...f, workDate: v })} /></Field>
          <Field label="Begintijd"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
          <Field label="Eindtijd"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          <Field label="Pauze (min)"><Input type="number" min={0} value={f.breakMinutes} onChange={(e) => setF({ ...f, breakMinutes: Number(e.target.value) })} /></Field>
          <Field label="Werkzaamheden" className="sm:col-span-2"><Input value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })} /></Field>
          <Field label="Afdeling"><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></Field>
          <Field label="Opmerkingen" className="sm:col-span-3"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ title, onClose, onSubmit }: { title: string; onClose: () => void; onSubmit: (note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Toelichting…" />
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={() => note.trim() ? onSubmit(note) : undefined} disabled={!note.trim()}>Versturen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TimeView({ mode = 'mine' }: { mode?: 'mine' | 'team' }) {
  const team = mode === 'team';
  const [period, setPeriod] = useState('week');
  const range = periodRange(period);
  const { data, loading, reload } = useLoad(() => timeEntries({ action: 'list', scope: mode, ...range }) as Promise<List>, [mode, period]);
  const [edit, setEdit] = useState<Item | null | 'new'>(null);
  const [note, setNote] = useState<{ item: Item; kind: 'correction' | 'Afgekeurd' | 'Correctie gevraagd' } | null>(null);
  const [status, setStatus] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const items = useMemo(() => (data?.items || []).filter((i) => !status || i.status === status), [data, status]);
  const total = items.reduce((s, i) => s + workedHours(i.start, i.end, i.breakMinutes), 0);
  const perMember = useMemo(() => { const m = new Map<string, number>(); items.forEach((i) => m.set(i.memberName, (m.get(i.memberName) || 0) + workedHours(i.start, i.end, i.breakMinutes))); return [...m.entries()].sort((a, b) => b[1] - a[1]); }, [items]);
  const clock = async (action: 'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd') => { if (await run(timeEntries({ action }), 'Bijgewerkt')) reload(); };
  const review = async (ids: string[], s: 'Goedgekeurd' | 'Afgekeurd' | 'Correctie gevraagd', n = '') => { for (const id of ids) await run(timeEntries({ action: 'review', id, status: s, note: n })); setSel([]); reload(); };

  return (
    <div>
      <PageHeader title={team ? 'Urencontrole & goedkeuring' : 'Urenregistratie'} description={team ? 'Controleer en keur geregistreerde uren goed. Elke wijziging komt in het auditlog.' : 'Klok in en uit, registreer handmatig en volg je goedkeuringen.'}
        actions={<>
          <Select className="w-auto" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Deze week' }, { value: 'month', label: 'Deze maand' }, { value: 'lastmonth', label: 'Vorige maand' }, { value: '90', label: 'Laatste 90 dagen' }]} />
          <Button variant="outline" onClick={() => exportCSV('uren', items.map((i) => ({ Medewerker: i.memberName, Datum: i.workDate?.slice(0, 10), Begin: fmtTime(i.start), Eind: fmtTime(i.end), Pauze: i.breakMinutes, Uren: workedHours(i.start, i.end, i.breakMinutes).toFixed(2), Werkzaamheden: i.activity, Status: i.status })))}><Download className="mr-2 h-4 w-4" />CSV</Button>
          {!team && <Button onClick={() => setEdit('new')}><Plus className="mr-2 h-4 w-4" />Handmatig</Button>}
        </>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Totaal uren" value={total.toFixed(1)} icon={Clock} hint={`${fmtDate(range.from)} – ${fmtDate(range.to)}`} />
        <StatCard label="Te beoordelen" value={items.filter((i) => i.status === 'Ingediend' || i.status === 'Correctie gevraagd').length} icon={Clock} tone="amber" />
        {!team ? (
          <Card><CardContent className="flex h-full flex-wrap items-center gap-2 p-5">
            {!data?.running ? <Button onClick={() => clock('clockIn')}><Play className="mr-2 h-4 w-4" />Start dienst</Button> : (<>
              <div className="w-full text-sm">Gestart om <b>{fmtTime(data.running.start)}</b>{data.running.breakStartedAt && ' · pauze loopt'}</div>
              {data.running.breakStartedAt ? <Button variant="outline" size="sm" onClick={() => clock('breakEnd')}><Coffee className="mr-1 h-4 w-4" />Stop pauze</Button> : <Button variant="outline" size="sm" onClick={() => clock('breakStart')}><Coffee className="mr-1 h-4 w-4" />Pauze</Button>}
              <Button size="sm" onClick={() => clock('clockOut')}><Square className="mr-1 h-4 w-4" />Stop dienst</Button>
            </>)}
          </CardContent></Card>
        ) : <StatCard label="Medewerkers" value={perMember.length} icon={Clock} tone="blue" />}
      </div>
      {team && perMember.length > 0 && (
        <Card className="mb-6"><CardContent className="flex flex-wrap gap-2 p-4">{perMember.map(([n, h]) => <span key={n} className="rounded-full bg-muted px-3 py-1 text-xs"><b>{n}</b> · {h.toFixed(1)} u</span>)}</CardContent></Card>
      )}
      <Card><CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select className="w-auto" value={status} onChange={setStatus} placeholder="Alle statussen" options={['Lopend', 'Ingediend', 'Goedgekeurd', 'Afgekeurd', 'Correctie gevraagd']} />
          {team && sel.length > 0 && <Button size="sm" onClick={() => review(sel, 'Goedgekeurd')}><Check className="mr-1 h-4 w-4" />{sel.length} goedkeuren</Button>}
        </div>
        {loading ? <LoadingRows /> : !items.length ? <Empty text="Geen uren in deze periode" /> : (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>{team && <TableHead className="w-8" />}{team && <TableHead>Medewerker</TableHead>}<TableHead>Datum</TableHead><TableHead>Tijd</TableHead><TableHead>Pauze</TableHead><TableHead>Uren</TableHead><TableHead>Werkzaamheden</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{items.map((i) => (
              <TableRow key={i.id}>
                {team && <TableCell><Checkbox checked={sel.includes(i.id)} onCheckedChange={(v) => setSel(v ? [...sel, i.id] : sel.filter((x) => x !== i.id))} disabled={i.status === 'Goedgekeurd' || i.status === 'Lopend'} /></TableCell>}
                {team && <TableCell className="font-semibold">{i.memberName}</TableCell>}
                <TableCell className="whitespace-nowrap">{fmtDate(i.workDate)}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtTime(i.start)}–{i.end ? fmtTime(i.end) : '…'}</TableCell>
                <TableCell>{i.breakMinutes}m</TableCell>
                <TableCell className="font-semibold">{workedHours(i.start, i.end, i.breakMinutes).toFixed(2)}</TableCell>
                <TableCell className="max-w-[200px] truncate">{i.activity}{i.reviewNote && <span className="block truncate text-xs text-muted-foreground">{i.reviewNote}</span>}</TableCell>
                <TableCell><StatusBadge status={i.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {team ? i.status !== 'Lopend' && (<>
                    <Button size="icon" variant="ghost" title="Goedkeuren" onClick={() => review([i.id], 'Goedgekeurd')}><Check className="h-4 w-4 text-emerald-600" /></Button>
                    <Button size="icon" variant="ghost" title="Correctie vragen" onClick={() => setNote({ item: i, kind: 'Correctie gevraagd' })}><Undo2 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Afkeuren" onClick={() => setNote({ item: i, kind: 'Afgekeurd' })}><X className="h-4 w-4 text-destructive" /></Button>
                  </>) : i.status === 'Goedgekeurd' ? <Button size="sm" variant="ghost" onClick={() => setNote({ item: i, kind: 'correction' })}>Correctie</Button> : i.status !== 'Lopend' && (<>
                    <Button size="icon" variant="ghost" onClick={() => setEdit(i)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { if (await run(timeEntries({ action: 'delete', id: i.id }), 'Verwijderd')) reload(); }}><Trash2 className="h-4 w-4" /></Button>
                  </>)}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
        )}
      </CardContent></Card>
      {edit && <EntryDialog item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
      {note && <NoteDialog title={note.kind === 'correction' ? 'Correctieverzoek' : note.kind === 'Afgekeurd' ? 'Uren afkeuren' : 'Correctie vragen'} onClose={() => setNote(null)} onSubmit={async (n) => {
        if (note.kind === 'correction') { if (await run(timeEntries({ action: 'requestCorrection', id: note.item.id, note: n }), 'Verzoek verstuurd')) reload(); }
        else await review([note.item.id], note.kind, n);
        setNote(null);
      }} />}
    </div>
  );
}
