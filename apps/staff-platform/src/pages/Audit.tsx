import { useState } from 'react';
import { auditLogs } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@project/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { Plus, Search, Download, ShieldCheck, Eye, Lock, ArrowLeft } from 'lucide-react';
import { useSession, fmtDate, fmtDateTime, today, addDays, exportCSV } from '../lib/session';
import { AUDIT_CATEGORIES } from '../lib/permissions';
import { PageHeader, StatusBadge, Empty, LoadingRows, Field, useLoad, run } from '../components/kit';
import { DateField, Select } from '../components/fields';

type Log = { id: string; action: string; category: string; actor: string; entity: string; details: string; createdOn: string };
type Req = { id: string; reason: string; memberId: string; memberName: string; categories: string[]; periodStart: string; periodEnd: string; explanation: string; status: string; decisionNote: string; decidedBy: string; accessExpiresAt: string; createdOn: string };

function LogViewer({ requestId }: { requestId?: string }) {
  const [cat, setCat] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(requestId ? '' : addDays(today(), -30));
  const [to, setTo] = useState(requestId ? '' : today());
  const { data, loading } = useLoad(() => auditLogs({ action: 'logs', requestId, category: cat || undefined, from: from || undefined, to: to || undefined }), [requestId, cat, from, to]);
  const items = ((data && 'items' in data ? data.items : []) as Log[]).filter((l) => `${l.action} ${l.actor} ${l.details} ${l.entity}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <Card><CardContent className="p-4">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Zoek op actie, persoon, details…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <Select className="w-auto" value={cat} onChange={setCat} placeholder="Alle categorieën" options={[...AUDIT_CATEGORIES, ...(requestId ? [] : ['Auditinzage'])]} />
        {!requestId && <><div className="w-40"><DateField value={from} onChange={setFrom} /></div><div className="w-40"><DateField value={to} onChange={setTo} /></div></>}
        <Button variant="outline" onClick={() => exportCSV('auditlog', items.map((l) => ({ Tijd: l.createdOn, Categorie: l.category, Actie: l.action, Door: l.actor, Object: l.entity, Details: l.details })))}><Download className="mr-2 h-4 w-4" />CSV</Button>
      </div>
      {loading ? <LoadingRows /> : !items.length ? <Empty text="Geen logregels gevonden" /> : (
        <div className="max-h-[60vh] overflow-auto"><Table>
          <TableHeader><TableRow><TableHead>Tijdstip</TableHead><TableHead>Categorie</TableHead><TableHead>Actie</TableHead><TableHead>Door</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>{items.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="whitespace-nowrap font-mono text-xs">{fmtDateTime(l.createdOn)}</TableCell>
              <TableCell><span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">{l.category}</span></TableCell>
              <TableCell className="font-medium">{l.action}</TableCell>
              <TableCell className="whitespace-nowrap">{l.actor}</TableCell>
              <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground" title={l.details}>{l.details || '—'}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></div>
      )}
    </CardContent></Card>
  );
}

function RequestDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ reason: '', categories: [] as string[], periodStart: addDays(today(), -30), periodEnd: today(), explanation: '' });
  const [err, setErr] = useState('');
  const submit = async () => {
    if (f.reason.trim().length < 3) return setErr('Geef een reden op');
    if (!f.categories.length) return setErr('Kies minimaal één soort auditlog');
    if (f.periodEnd < f.periodStart) return setErr('Periode is ongeldig');
    if (f.explanation.trim().length < 10) return setErr('Toelichting minimaal 10 tekens');
    if (await run(auditLogs({ action: 'request', data: f }), 'Verzoek ingediend')) { onSaved(); onClose(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Toegang tot auditlogs aanvragen</DialogTitle></DialogHeader>
        <Field label="Reden van aanvraag"><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <Field label="Welke auditlogs">
          <div className="grid grid-cols-2 gap-2 rounded-md border p-3">{AUDIT_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm"><Checkbox checked={f.categories.includes(c)} onCheckedChange={(v) => setF({ ...f, categories: v ? [...f.categories, c] : f.categories.filter((x) => x !== c) })} />{c}</label>
          ))}</div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Periode vanaf"><DateField value={f.periodStart} onChange={(v) => setF({ ...f, periodStart: v })} /></Field>
          <Field label="Periode tot en met"><DateField value={f.periodEnd} onChange={(v) => setF({ ...f, periodEnd: v })} /></Field>
        </div>
        <Field label="Toelichting"><Textarea rows={3} value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} /></Field>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={submit}>Indienen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecideDialog({ req, onClose, onSaved }: { req: Req; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState('');
  const [days, setDays] = useState(7);
  const decide = async (approve: boolean) => { if (await run(auditLogs({ action: 'decide', id: req.id, approve, note, days }), approve ? 'Goedgekeurd' : 'Afgewezen')) { onSaved(); onClose(); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Inzageverzoek beoordelen</DialogTitle></DialogHeader>
        <div className="space-y-1 rounded-lg bg-muted/60 p-4 text-sm">
          <div><b>{req.memberName}</b> · {fmtDateTime(req.createdOn)}</div>
          <div>Reden: {req.reason}</div>
          <div>Logs: {req.categories.join(', ')}</div>
          <div>Periode: {fmtDate(req.periodStart)} t/m {fmtDate(req.periodEnd)}</div>
          <p className="text-muted-foreground">{req.explanation}</p>
        </div>
        <Field label="Toegangsduur (dagen)"><Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Number(e.target.value))))} /></Field>
        <Field label="Toelichting (zichtbaar voor aanvrager)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <DialogFooter><Button variant="outline" onClick={() => decide(false)}>Weigeren</Button><Button onClick={() => decide(true)}>Goedkeuren</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestsTable({ items, manage, onAction }: { items: Req[]; manage: boolean; onAction: (r: Req, kind: 'view' | 'decide' | 'withdraw') => void }) {
  if (!items.length) return <Empty text="Geen verzoeken" />;
  return (
    <div className="overflow-x-auto"><Table>
      <TableHeader><TableRow>{manage && <TableHead>Aanvrager</TableHead>}<TableHead>Reden</TableHead><TableHead>Logs</TableHead><TableHead>Periode</TableHead><TableHead>Status</TableHead><TableHead>Besluit</TableHead><TableHead /></TableRow></TableHeader>
      <TableBody>{items.map((r) => (
        <TableRow key={r.id}>
          {manage && <TableCell className="font-semibold">{r.memberName}</TableCell>}
          <TableCell>{r.reason}<div className="text-xs text-muted-foreground">{fmtDateTime(r.createdOn)}</div></TableCell>
          <TableCell className="max-w-[180px] text-xs">{r.categories.join(', ')}</TableCell>
          <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.periodStart)} – {fmtDate(r.periodEnd)}</TableCell>
          <TableCell><StatusBadge status={r.status} />{r.status === 'Goedgekeurd' && <div className="text-xs text-muted-foreground">tot {fmtDateTime(r.accessExpiresAt)}</div>}</TableCell>
          <TableCell className="max-w-[200px] text-xs text-muted-foreground">{r.decidedBy && <b>{r.decidedBy}: </b>}{r.decisionNote || '—'}</TableCell>
          <TableCell className="whitespace-nowrap text-right">
            {manage && r.status === 'In behandeling' && <Button size="sm" onClick={() => onAction(r, 'decide')}>Beoordelen</Button>}
            {!manage && r.status === 'Goedgekeurd' && <Button size="sm" onClick={() => onAction(r, 'view')}><Eye className="mr-1 h-4 w-4" />Inzien</Button>}
            {!manage && r.status === 'In behandeling' && <Button size="sm" variant="ghost" onClick={() => onAction(r, 'withdraw')}>Intrekken</Button>}
          </TableCell>
        </TableRow>
      ))}</TableBody>
    </Table></div>
  );
}

export default function AuditView() {
  const { can } = useSession();
  const manage = can('audit.view');
  const { data, loading, reload } = useLoad(() => auditLogs({ action: manage ? 'allRequests' : 'myRequests' }), [manage]);
  const reqs = (data && 'items' in data ? data.items : []) as Req[];
  const [creating, setCreating] = useState(false);
  const [deciding, setDeciding] = useState<Req | null>(null);
  const [viewing, setViewing] = useState<Req | null>(null);
  const onAction = async (r: Req, kind: 'view' | 'decide' | 'withdraw') => {
    if (kind === 'view') setViewing(r);
    else if (kind === 'decide') setDeciding(r);
    else if (await run(auditLogs({ action: 'withdraw', id: r.id }), 'Ingetrokken')) reload();
  };
  if (viewing) return (
    <div>
      <PageHeader title="Auditlogs (tijdelijke inzage)" description={`${viewing.categories.join(', ')} · ${fmtDate(viewing.periodStart)} t/m ${fmtDate(viewing.periodEnd)} · toegang tot ${fmtDateTime(viewing.accessExpiresAt)}. Deze inzage wordt geregistreerd.`} actions={<Button variant="outline" onClick={() => setViewing(null)}><ArrowLeft className="mr-2 h-4 w-4" />Terug</Button>} />
      <LogViewer requestId={viewing.id} />
    </div>
  );
  if (!manage) return (
    <div>
      <PageHeader title="Auditlogs" description="Auditlogs zijn beveiligd. Vraag tijdelijke inzage aan; na goedkeuring zie je uitsluitend de goedgekeurde logs en periode." actions={<Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Toegang aanvragen</Button>} />
      <Card className="mb-4 border-primary/30 bg-primary/[0.03]"><CardContent className="flex gap-3 p-4 text-sm"><Lock className="h-5 w-5 shrink-0 text-primary" />Alle aanvragen, beslissingen en daadwerkelijke inzages worden vastgelegd. Je kunt jezelf nooit toestemming geven.</CardContent></Card>
      <Card><CardContent className="p-4">{loading ? <LoadingRows /> : <RequestsTable items={reqs} manage={false} onAction={onAction} />}</CardContent></Card>
      {creating && <RequestDialog onClose={() => setCreating(false)} onSaved={reload} />}
    </div>
  );
  const pending = reqs.filter((r) => r.status === 'In behandeling').length;
  return (
    <div>
      <PageHeader title="Auditlogs & inzageverzoeken" description="Volledige audittrail van het platform en de behandeling van inzageverzoeken van medewerkers." />
      <Tabs defaultValue="logs">
        <TabsList className="mb-4"><TabsTrigger value="logs"><ShieldCheck className="mr-2 h-4 w-4" />Auditlogs</TabsTrigger><TabsTrigger value="requests">Verzoeken {pending > 0 && <span className="ml-2 rounded-full bg-destructive px-1.5 text-[10px] text-white">{pending}</span>}</TabsTrigger></TabsList>
        <TabsContent value="logs"><LogViewer /></TabsContent>
        <TabsContent value="requests"><Card><CardContent className="p-4">{loading ? <LoadingRows /> : <RequestsTable items={reqs} manage onAction={onAction} />}</CardContent></Card></TabsContent>
      </Tabs>
      {deciding && <DecideDialog req={deciding} onClose={() => setDeciding(null)} onSaved={reload} />}
    </div>
  );
}
