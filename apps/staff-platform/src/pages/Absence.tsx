import { useMemo, useState } from 'react';
import { absence, type AbsenceOutputType } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { Plus, Download, Search, Paperclip } from 'lucide-react';
import { fmtDate, fmtDateTime, exportCSV, today } from '../lib/session';
import { PageHeader, StatusBadge, Empty, LoadingRows, Field, useLoad, run } from '../components/kit';
import { DateField, FileField, Select } from '../components/fields';

type Item = Extract<AbsenceOutputType, { items: unknown }>['items'][0];
const CATS = ['Ziekte', 'Persoonlijke omstandigheden', 'Vakantie', 'Verlof', 'Onverwachte afwezigheid', 'Overig'];
const STATUSES = ['Nieuw', 'In behandeling', 'Goedgekeurd', 'Afgewezen', 'Aanvullende informatie nodig', 'Geannuleerd'] as const;

function NewDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ category: 'Ziekte', startDate: today(), endDate: today(), startTime: '', endTime: '', explanation: '', attachment: '', replacement: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.startDate) e.startDate = 'Verplicht';
    if (!f.endDate || f.endDate < f.startDate) e.endDate = 'Moet op of na begindatum';
    if (f.explanation.trim().length < 3) e.explanation = 'Geef een korte toelichting';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    if (await run(absence({ action: 'create', data: f }), 'Melding verstuurd')) { onSaved(); onClose(); }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Afwezigheid melden / verlof aanvragen</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categorie" className="sm:col-span-2"><Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={CATS} /></Field>
          <Field label="Begindatum" error={err.startDate}><DateField value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} /></Field>
          <Field label="Einddatum" error={err.endDate}><DateField value={f.endDate} onChange={(v) => setF({ ...f, endDate: v })} /></Field>
          <Field label="Begintijd (optioneel)"><Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></Field>
          <Field label="Eindtijd (optioneel)"><Input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></Field>
          <Field label="Toelichting" error={err.explanation} className="sm:col-span-2"><Textarea rows={3} value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} /></Field>
          <Field label="Vervanger (optioneel)"><Input value={f.replacement} onChange={(e) => setF({ ...f, replacement: e.target.value })} placeholder="Naam collega" /></Field>
          <Field label="Bijlage (optioneel)"><FileField value={f.attachment} onChange={(v) => setF({ ...f, attachment: v })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={submit} disabled={busy}>Versturen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('Goedgekeurd');
  const [response, setResponse] = useState('');
  if (!item) return null;
  const save = async () => { if (await run(absence({ action: 'review', id: item.id, status, response }), 'Aanvraag bijgewerkt')) { onSaved(); onClose(); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Aanvraag behandelen</DialogTitle></DialogHeader>
        <div className="space-y-2 rounded-lg bg-muted/60 p-4 text-sm">
          <div className="font-semibold">{item.memberName} · {item.category}</div>
          <div>{fmtDate(item.startDate)} t/m {fmtDate(item.endDate)} {item.startTime && `(${item.startTime}–${item.endTime})`}</div>
          <p className="whitespace-pre-wrap text-muted-foreground">{item.explanation}</p>
          {item.replacement && <div>Vervanger: {item.replacement}</div>}
          {item.attachment && <a className="inline-flex items-center gap-1 text-primary underline" href={item.attachment} target="_blank" rel="noreferrer"><Paperclip className="h-3 w-3" />Bijlage</a>}
        </div>
        <Field label="Nieuwe status"><Select value={status} onChange={(v) => setStatus(v as typeof status)} options={STATUSES.filter((s) => s !== 'Geannuleerd' && s !== 'Nieuw')} /></Field>
        <Field label="Reactie aan medewerker"><Textarea rows={3} value={response} onChange={(e) => setResponse(e.target.value)} /></Field>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AbsenceView({ mode = 'mine' }: { mode?: 'mine' | 'team' }) {
  const { data, loading, reload } = useLoad(() => absence({ action: 'list', scope: mode }), [mode]);
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState<Item | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const items = useMemo(() => ((data && 'items' in data ? data.items : []) as Item[]).filter((i) => (!status || i.status === status) && `${i.memberName} ${i.category}`.toLowerCase().includes(q.toLowerCase())), [data, q, status]);
  const team = mode === 'team';
  return (
    <div>
      <PageHeader title={team ? 'Afwezigheid & verlofaanvragen' : 'Afwezigheid & verlof'} description={team ? 'Behandel meldingen en aanvragen van medewerkers.' : 'Meld afwezigheid, vraag verlof aan en volg de status.'}
        actions={<>
          {team && <Button variant="outline" onClick={() => exportCSV('afwezigheid', items.map((i) => ({ Medewerker: i.memberName, Categorie: i.category, Van: i.startDate, Tot: i.endDate, Status: i.status, Behandelaar: i.handledBy })))}><Download className="mr-2 h-4 w-4" />CSV</Button>}
          {!team && <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nieuwe melding</Button>}
        </>} />
      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Select className="w-auto" value={status} onChange={setStatus} placeholder="Alle statussen" options={[...STATUSES]} />
          </div>
          {loading ? <LoadingRows /> : !items.length ? <Empty text="Geen aanvragen gevonden" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>{team && <TableHead>Medewerker</TableHead>}<TableHead>Categorie</TableHead><TableHead>Periode</TableHead><TableHead>Status</TableHead><TableHead>Reactie</TableHead><TableHead>Ingediend</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.id}>
                      {team && <TableCell className="font-semibold">{i.memberName}</TableCell>}
                      <TableCell>{i.category}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(i.startDate)} – {fmtDate(i.endDate)}</TableCell>
                      <TableCell><StatusBadge status={i.status} /></TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">{i.response || '—'}{i.handledBy && <span className="block text-xs">door {i.handledBy}</span>}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(i.createdOn)}</TableCell>
                      <TableCell className="text-right">
                        {team ? <Button size="sm" variant="outline" onClick={() => setReview(i)}>Behandelen</Button>
                          : ['Nieuw', 'In behandeling', 'Aanvullende informatie nodig'].includes(i.status) && <Button size="sm" variant="ghost" onClick={async () => { if (await run(absence({ action: 'cancel', id: i.id }), 'Geannuleerd')) reload(); }}>Annuleren</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {open && <NewDialog open={open} onClose={() => setOpen(false)} onSaved={reload} />}
      <ReviewDialog item={review} onClose={() => setReview(null)} onSaved={reload} />
    </div>
  );
}
