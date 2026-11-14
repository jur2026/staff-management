import { useMemo, useState } from 'react';
import { reviews } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus, Search, Lock, Pencil, Trash2, Award, AlertTriangle, MessageCircle, GraduationCap, Download } from 'lucide-react';
import { fmtDate, today, exportCSV } from '../lib/session';
import { PageHeader, Empty, LoadingRows, Field, useLoad, run, StatCard } from '../components/kit';
import { DateField, MemberSelect, Select } from '../components/fields';

type R = { id: string; title: string; memberId: string; memberName: string; type: string; date: string; notes: string; author: string; confidential: boolean; createdOn: string };
const TYPES = ['Functioneringsgesprek', 'Evaluatie', 'Begeleiding', 'Gespreksaanvraag', 'Waarschuwing', 'Incident', 'Compliment', 'Training', 'Functiewijziging', 'Uitdiensttreding'];
const ICON: Record<string, typeof Award> = { Compliment: Award, Waarschuwing: AlertTriangle, Incident: AlertTriangle, Training: GraduationCap };

function ReviewDialog({ item, onClose, onSaved }: { item: R | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: item?.title || '', memberId: item?.memberId || '', type: item?.type || 'Functioneringsgesprek', date: item?.date?.slice(0, 10) || today(), notes: item?.notes || '', confidential: item?.confidential ?? true });
  const [err, setErr] = useState('');
  const save = async () => {
    if (!f.memberId) return setErr('Kies een medewerker');
    if (f.title.trim().length < 2) return setErr('Titel is verplicht');
    if (await run(reviews({ action: 'save', id: item?.id, data: f }), 'Opgeslagen')) { onSaved(); onClose(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? 'Registratie bewerken' : 'Nieuwe registratie'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Medewerker" className="sm:col-span-2"><MemberSelect value={f.memberId} onChange={(v) => setF({ ...f, memberId: v })} /></Field>
          <Field label="Type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={TYPES} /></Field>
          <Field label="Datum"><DateField value={f.date} onChange={(v) => setF({ ...f, date: v })} /></Field>
          <Field label="Titel" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Verslag / notities" className="sm:col-span-2"><Textarea rows={6} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={f.confidential} onCheckedChange={(v) => setF({ ...f, confidential: v })} />Vertrouwelijk (niet zichtbaar voor medewerker)</label>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDialog({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Gesprek aanvragen</DialogTitle></DialogHeader>
        <Field label="Onderwerp"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Toelichting"><Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button disabled={subject.trim().length < 3} onClick={async () => { if (await run(reviews({ action: 'requestMeeting', request: { subject, notes } }), 'Aanvraag verstuurd')) onClose(); }}>Versturen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ReviewsView({ mode = 'mine' }: { mode?: 'mine' | 'manage' }) {
  const manage = mode === 'manage';
  const { data, loading, reload } = useLoad(() => reviews({ action: manage ? 'list' : 'mine' }), [mode]);
  const all = (data && 'items' in data ? data.items : []) as R[];
  const [edit, setEdit] = useState<R | null | 'new'>(null);
  const [req, setReq] = useState(false);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const items = useMemo(() => all.filter((r) => (!type || r.type === type) && `${r.title} ${r.memberName}`.toLowerCase().includes(q.toLowerCase())), [all, q, type]);
  return (
    <div>
      <PageHeader title={manage ? 'Gesprekken, evaluaties & registraties' : 'Ontwikkeling & gesprekken'}
        description={manage ? 'Functioneringsgesprekken, begeleiding, waarschuwingen, incidenten, complimenten, trainingen en uitdiensttreding.' : 'Je gesprekken, complimenten, trainingen en certificaten. Vraag hier ook een gesprek aan.'}
        actions={<>
          {manage && <Button variant="outline" onClick={() => exportCSV('gesprekken', items.map((r) => ({ Medewerker: r.memberName, Type: r.type, Datum: r.date, Titel: r.title, Auteur: r.author, Vertrouwelijk: r.confidential ? 'ja' : 'nee' })))}><Download className="mr-2 h-4 w-4" />CSV</Button>}
          {manage ? <Button onClick={() => setEdit('new')}><Plus className="mr-2 h-4 w-4" />Registratie</Button> : <Button onClick={() => setReq(true)}><MessageCircle className="mr-2 h-4 w-4" />Gesprek aanvragen</Button>}
        </>} />
      {manage && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <StatCard label="Gespreksaanvragen" value={all.filter((r) => r.type === 'Gespreksaanvraag').length} icon={MessageCircle} tone="blue" />
          <StatCard label="Complimenten" value={all.filter((r) => r.type === 'Compliment').length} icon={Award} />
          <StatCard label="Waarschuwingen" value={all.filter((r) => r.type === 'Waarschuwing').length} icon={AlertTriangle} tone="amber" />
          <StatCard label="Incidenten" value={all.filter((r) => r.type === 'Incident').length} icon={AlertTriangle} tone="red" />
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select className="w-auto" value={type} onChange={setType} placeholder="Alle types" options={TYPES} />
      </div>
      {loading ? <LoadingRows /> : !items.length ? <Card><CardContent><Empty text="Nog geen registraties" /></CardContent></Card> : (
        <div className="space-y-3">
          {items.map((r) => { const Icon = ICON[r.type] || MessageCircle; return (
            <Card key={r.id}><CardContent className="flex gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><b>{r.title}</b>{r.confidential && <Lock className="h-3.5 w-3.5 text-amber-500" />}</div>
                <div className="text-xs text-muted-foreground">{r.type} · {fmtDate(r.date)}{manage && ` · ${r.memberName}`} · door {r.author}</div>
                {r.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{r.notes}</p>}
              </div>
              {manage && <div className="flex flex-col">
                <Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={async () => { if (await run(reviews({ action: 'delete', id: r.id }), 'Verwijderd')) reload(); }}><Trash2 className="h-4 w-4" /></Button>
              </div>}
            </CardContent></Card>
          ); })}
        </div>
      )}
      {edit && <ReviewDialog item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
      {req && <RequestDialog onClose={() => { setReq(false); reload(); }} />}
    </div>
  );
}
