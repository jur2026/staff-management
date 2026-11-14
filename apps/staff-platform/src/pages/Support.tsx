import { useState } from 'react';
import { support, type SupportOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { LifeBuoy, Mail, Plus } from 'lucide-react';
import { fmtDateTime } from '../lib/session';
import { Empty, Field, LoadingRows, PageHeader, StatusBadge, run, selectCls, useLoad } from '../components/kit';
import { FileField } from '../components/fields';

const CATS = ['Inloggen', 'Accountproblemen', 'Wachtwoordproblemen', 'Websiteproblemen', 'Technische problemen', 'Rechten en toegang', 'Overige vragen'] as const;
const STATUSES = ['Open', 'In behandeling', 'Wacht op reactie', 'Opgelost', 'Gesloten'] as const;
type Ticket = SupportOutputType['tickets'][0];

export default function Support() {
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const { data, loading, setData } = useLoad(() => support({ action: 'list', scope }), [scope]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'Overige vragen' as (typeof CATS)[number], description: '', file: '' });
  const [open, setOpen] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);

  const create = async () => {
    if (form.subject.trim().length < 3) return;
    const r = await run(support({ action: 'create', scope, subject: form.subject, category: form.category, description: form.description, attachments: form.file ? [form.file] : [] }), 'Ticket aangemaakt');
    if (r) { setData(r); setCreating(false); setForm({ subject: '', category: 'Overige vragen', description: '', file: '' }); }
  };
  const openTicket = async (t: Ticket) => { setOpen(t); const r = await run(support({ action: 'thread', scope, id: t.id })); if (r) setData(r); };
  const send = async () => { if (!open || !reply.trim()) return; const r = await run(support({ action: 'reply', scope, id: open.id, body: reply, internal })); if (r) { setData(r); setReply(''); } };
  const setStatus = async (s: (typeof STATUSES)[number]) => { if (!open) return; const r = await run(support({ action: 'status', scope, id: open.id, status: s }), 'Status bijgewerkt'); if (r) { setData(r); setOpen({ ...open, status: s }); } };

  return (
    <div>
      <PageHeader title="Support" description="Stel een vraag of meld een probleem. Je ticket wordt intern behandeld." actions={<Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Nieuw ticket</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm"><Mail className="h-4 w-4 text-primary" />Kom je niet in je account? Mail <a className="font-semibold text-primary underline" href="mailto:support@bambooland.aclclouds.online">support@bambooland.aclclouds.online</a></div>
      {data?.canHandle && (
        <div className="mb-4 flex gap-2">{(['mine', 'all'] as const).map((s) => <Button key={s} size="sm" variant={scope === s ? 'default' : 'outline'} onClick={() => setScope(s)}>{s === 'mine' ? 'Mijn tickets' : 'Alle tickets (behandelen)'}</Button>)}</div>
      )}
      {loading ? <LoadingRows /> : !data?.tickets.length ? <Empty icon={LifeBuoy} text="Geen tickets" /> : (
        <div className="divide-y rounded-lg border bg-card">
          {data.tickets.map((t) => (
            <button key={t.id} onClick={() => openTicket(t)} className="flex w-full flex-wrap items-center gap-3 p-3 text-left hover:bg-muted/50">
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{t.subject}</div><div className="text-xs text-muted-foreground">{t.category} · {t.requester} · {fmtDateTime(t.updatedOn)}</div></div>
              <StatusBadge status={t.status} />
            </button>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent><DialogHeader><DialogTitle>Nieuw supportticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Onderwerp" error={form.subject && form.subject.trim().length < 3 ? 'Minimaal 3 tekens' : undefined}><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            <Field label="Categorie"><select className={selectCls + ' w-full'} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Omschrijving"><Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <FileField value={form.file} onChange={(url: string) => setForm({ ...form, file: url })} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreating(false)}>Annuleren</Button><Button onClick={create}>Versturen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{open?.subject}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{open.category} · {open.requester} · <StatusBadge status={open.status} />
                {data?.canHandle && <select className={selectCls + ' ml-auto'} value={open.status} onChange={(e) => setStatus(e.target.value as any)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>}
              </div>
              {open.description && <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{open.description}</p>}
              {open.attachments.map((a) => <a key={a} href={a} target="_blank" rel="noreferrer" className="block text-xs text-primary underline">Bijlage openen</a>)}
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {data?.thread.map((m) => <div key={m.id} className={`rounded-lg border p-2 text-sm ${m.internal ? 'border-amber-500/40 bg-amber-500/10' : ''}`}><div className="mb-1 text-xs text-muted-foreground">{m.author} · {fmtDateTime(m.createdOn)}{m.internal ? ' · interne notitie' : ''}</div><div className="whitespace-pre-wrap">{m.body}</div></div>)}
              </div>
              <Textarea rows={3} placeholder="Reactie…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="flex items-center justify-between">
                {data?.canHandle ? <label className="flex items-center gap-2 text-xs"><Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} />Interne notitie</label> : <span />}
                <Button onClick={send} disabled={!reply.trim()}>Versturen</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
