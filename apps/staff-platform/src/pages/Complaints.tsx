import { useMemo, useState } from 'react';
import { complaints, type ComplaintsOutputType } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Plus, Search, Lock, Paperclip, Send, ShieldAlert } from 'lucide-react';
import { fmtDateTime, useSession } from '../lib/session';
import { PageHeader, StatusBadge, Empty, LoadingRows, Field, useLoad, run } from '../components/kit';
import { FileField, MemberSelect, Select, useDirectory } from '../components/fields';

type Item = Extract<ComplaintsOutputType, { items: unknown }>['items'][0];
type Detail = Extract<ComplaintsOutputType, { complaint: unknown }>;
const CATS = ['Samenwerking', 'Gedrag', 'Communicatie', 'Werkverdeling', 'Conflict', 'Ongewenst gedrag', 'Organisatie'];
const PRIOS = ['Laag', 'Normaal', 'Hoog', 'Urgent'];
const STATUSES = ['Nieuw', 'In behandeling', 'Wacht op informatie', 'Doorgestuurd', 'Opgelost', 'Afgewezen', 'Gesloten'];

function NewComplaint({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { me } = useSession();
  const [f, setF] = useState({ subject: '', category: 'Samenwerking', description: '', priority: 'Normaal', againstId: '', attachment: '' });
  const [err, setErr] = useState('');
  const submit = async () => {
    if (f.subject.trim().length < 3) return setErr('Onderwerp is te kort');
    if (f.description.trim().length < 10) return setErr('Beschrijf de klacht in minimaal 10 tekens');
    if (await run(complaints({ action: 'create', data: { ...f, againstId: f.againstId || undefined } }), 'Klacht vertrouwelijk ingediend')) { onSaved(); onClose(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Klacht indienen</DialogTitle></DialogHeader>
        <p className="flex gap-2 rounded-lg bg-accent p-3 text-xs text-accent-foreground"><Lock className="h-4 w-4 shrink-0" />Je klacht is vertrouwelijk. Gaat de klacht over een leidinggevende, dan komt deze nooit bij die persoon terecht.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Onderwerp" className="sm:col-span-2"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
          <Field label="Categorie"><Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={CATS} /></Field>
          <Field label="Prioriteit"><Select value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={PRIOS} /></Field>
          <Field label="Betreft persoon (optioneel)" className="sm:col-span-2"><MemberSelect value={f.againstId} onChange={(v) => setF({ ...f, againstId: v })} placeholder="Geen specifieke persoon" excludeId={me.id} /></Field>
          <Field label="Omschrijving" className="sm:col-span-2"><Textarea rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Bijlage" className="sm:col-span-2"><FileField value={f.attachment} onChange={(v) => setF({ ...f, attachment: v })} /></Field>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={submit}>Indienen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ComplaintDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, reload } = useLoad(() => complaints({ action: 'get', id }) as Promise<Detail>, [id]);
  const dir = useDirectory();
  const [msg, setMsg] = useState('');
  const [internal, setInternal] = useState(false);
  const c = data?.complaint;
  const update = async (patch: { status?: string; priority?: string; handlerId?: string }) => { if (await run(complaints({ action: 'update', id, ...patch }), 'Bijgewerkt')) { reload(); onChanged(); } };
  const send = async () => { if (!msg.trim()) return; if (await run(complaints({ action: 'comment', id, message: msg, internal }))) { setMsg(''); reload(); } };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {!c ? <LoadingRows /> : (
          <div className="space-y-5">
            <SheetHeader><SheetTitle>#{c.number} · {c.subject}</SheetTitle></SheetHeader>
            <div className="flex flex-wrap gap-2"><StatusBadge status={c.status} /><StatusBadge status={c.priority} /><span className="text-xs text-muted-foreground">{c.category} · {fmtDateTime(c.createdOn)}</span></div>
            {data.canHandle && (
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
                <Field label="Status"><Select value={c.status} onChange={(v) => update({ status: v })} options={STATUSES} /></Field>
                <Field label="Prioriteit"><Select value={c.priority} onChange={(v) => update({ priority: v })} options={PRIOS} /></Field>
                <Field label="Behandelaar"><Select value={c.handlerId} onChange={(v) => update({ handlerId: v })} placeholder="Niet toegewezen" options={dir.map((m) => ({ value: m.id, label: m.fullName }))} /></Field>
              </div>
            )}
            <div className="space-y-1 text-sm">
              {c.submitterName && <div><span className="text-muted-foreground">Ingediend door:</span> {c.submitterName}</div>}
              {c.againstName && <div className="flex items-center gap-1"><ShieldAlert className="h-4 w-4 text-amber-500" /><span className="text-muted-foreground">Betreft:</span> {c.againstName}</div>}
              <div><span className="text-muted-foreground">Behandelaar:</span> {c.handlerName || 'Nog niet toegewezen'}</div>
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-4 text-sm">{c.description}</p>
            {c.attachment && <a href={c.attachment} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline"><Paperclip className="h-4 w-4" />Bijlage</a>}
            <div>
              <h3 className="mb-2 text-sm font-bold">Behandelgeschiedenis & reacties</h3>
              <div className="space-y-2">
                {!data.updates.length && <p className="text-sm text-muted-foreground">Nog geen reacties.</p>}
                {data.updates.map((u) => (
                  <div key={u.id} className={`rounded-lg border p-3 text-sm ${u.internal ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><b className="text-foreground">{u.author}</b>{fmtDateTime(u.createdOn)}{u.internal && <span className="flex items-center gap-1 text-amber-600"><Lock className="h-3 w-3" />intern</span>}</div>
                    <p className="whitespace-pre-wrap">{u.message}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <Textarea rows={3} placeholder="Schrijf een reactie…" value={msg} onChange={(e) => setMsg(e.target.value)} />
                <div className="flex items-center justify-between">
                  {data.canHandle ? <label className="flex items-center gap-2 text-xs"><Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} />Interne notitie (niet zichtbaar voor indiener)</label> : <span />}
                  <Button size="sm" onClick={send}><Send className="mr-2 h-4 w-4" />Versturen</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function ComplaintsView({ mode = 'mine' }: { mode?: 'mine' | 'handle' }) {
  const { data, loading, reload } = useLoad(() => complaints({ action: 'list', scope: mode }), [mode]);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const items = useMemo(() => ((data && 'items' in data ? data.items : []) as Item[]).filter((i) => (!status || i.status === status) && `${i.subject} ${i.category} ${i.submitterName} #${i.number}`.toLowerCase().includes(q.toLowerCase())), [data, q, status]);
  const handle = mode === 'handle';
  return (
    <div>
      <PageHeader title={handle ? 'Klachtenbehandeling' : 'Mijn klachten'} description={handle ? 'Vertrouwelijk: je ziet alleen klachten waarvoor je bevoegd bent.' : 'Dien vertrouwelijk een klacht in en volg de voortgang.'}
        actions={!handle && <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Klacht indienen</Button>} />
      <Card><CardContent className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Zoek op onderwerp, ID…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-auto" value={status} onChange={setStatus} placeholder="Alle statussen" options={STATUSES} />
        </div>
        {loading ? <LoadingRows /> : !items.length ? <Empty text="Geen klachten" /> : (
          <div className="divide-y rounded-lg border">
            {items.map((i) => (
              <button key={i.id} onClick={() => setOpenId(i.id)} className="flex w-full flex-col gap-2 p-4 text-left hover:bg-muted/50 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold"><span className="font-mono text-xs text-muted-foreground">#{i.number}</span> {i.subject}</div>
                  <div className="text-xs text-muted-foreground">{i.category}{handle && i.submitterName && ` · ${i.submitterName}`} · {fmtDateTime(i.createdOn)}{i.handlerName && ` · behandelaar ${i.handlerName}`}</div>
                </div>
                <div className="flex gap-2"><StatusBadge status={i.priority} /><StatusBadge status={i.status} /></div>
              </button>
            ))}
          </div>
        )}
      </CardContent></Card>
      {creating && <NewComplaint onClose={() => setCreating(false)} onSaved={reload} />}
      {openId && <ComplaintDetail id={openId} onClose={() => setOpenId('')} onChanged={reload} />}
    </div>
  );
}
