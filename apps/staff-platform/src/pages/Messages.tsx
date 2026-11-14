import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messages, type MessagesOutputType } from 'zitejs/api';
import { Card } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Checkbox } from '@project/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus, Send, Users, MessagesSquare, ArrowLeft } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { useSession, fmtDateTime, initials } from '../lib/session';
import { PageHeader, Empty, Field, run } from '../components/kit';
import { useDirectory } from '../components/fields';

type Conv = { id: string; title: string; isGroup: boolean; participants: string[]; lastMessageAt: string };
type Msg = { id: string; body: string; senderId: string; sender: string; createdOn: string; mine: boolean };

function NewConv({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { me } = useSession();
  const dir = useDirectory().filter((m) => m.id !== me.id);
  const [sel, setSel] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nieuw gesprek</DialogTitle></DialogHeader>
        {sel.length > 1 && <Field label="Groepsnaam"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Team Support" /></Field>}
        <Input placeholder="Zoek collega…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {dir.filter((m) => m.fullName.toLowerCase().includes(q.toLowerCase())).map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted">
              <Checkbox checked={sel.includes(m.id)} onCheckedChange={(v) => setSel(v ? [...sel, m.id] : sel.filter((x) => x !== m.id))} />
              <span className="text-sm font-medium">{m.fullName}</span><span className="text-xs text-muted-foreground">{m.jobTitle}</span>
            </label>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button disabled={!sel.length} onClick={async () => { const r = await run(messages({ action: 'create', participantIds: sel, title })); if (r && 'id' in r) onCreated(r.id as string); }}>Starten</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const active = params.get('c') || '';
  const [convs, setConvs] = useState<Conv[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState('');
  const [creating, setCreating] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadConvs = async () => { const r = (await messages({ action: 'conversations' }).catch(() => null)) as Extract<MessagesOutputType, { items: unknown }> | null; if (r) setConvs(r.items as Conv[]); };
  const loadMsgs = async (id: string) => { const r = (await messages({ action: 'messages', id }).catch(() => null)) as { items: Msg[] } | null; if (r) setMsgs(r.items); };
  useEffect(() => { loadConvs(); const t = setInterval(loadConvs, 15000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!active) return; setMsgs([]); loadMsgs(active); const t = setInterval(() => loadMsgs(active), 6000); return () => clearInterval(t); }, [active]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  const send = async () => {
    if (!body.trim()) return;
    const text = body; setBody('');
    setMsgs((m) => [...m, { id: `tmp${Date.now()}`, body: text, senderId: '', sender: 'Jij', createdOn: new Date().toISOString(), mine: true }]);
    if (await run(messages({ action: 'send', id: active, body: text }))) { loadMsgs(active); loadConvs(); } else setBody(text);
  };
  const conv = convs.find((c) => c.id === active);

  return (
    <div>
      <PageHeader title="Berichten" description="Privéberichten en groepsgesprekken met collega's." actions={<Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Nieuw gesprek</Button>} />
      <Card className="grid h-[calc(100vh-14rem)] min-h-[420px] overflow-hidden md:grid-cols-[300px_1fr]">
        <div className={cn('overflow-y-auto border-r', active && 'hidden md:block')}>
          {!convs.length ? <Empty text="Nog geen gesprekken" icon={MessagesSquare} /> : convs.map((c) => (
            <button key={c.id} onClick={() => setParams({ c: c.id })} className={cn('flex w-full items-center gap-3 border-b p-3 text-left hover:bg-muted/60', active === c.id && 'bg-muted')}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{c.isGroup ? <Users className="h-4 w-4" /> : initials(c.title)}</div>
              <div className="min-w-0"><div className="truncate text-sm font-semibold">{c.title}</div><div className="truncate text-xs text-muted-foreground">{c.isGroup ? `${c.participants.length} deelnemers` : fmtDateTime(c.lastMessageAt)}</div></div>
            </button>
          ))}
        </div>
        <div className={cn('flex min-h-0 flex-col', !active && 'hidden md:flex')}>
          {!conv ? <div className="flex flex-1 items-center justify-center"><Empty text="Kies een gesprek" icon={MessagesSquare} /></div> : (<>
            <div className="flex items-center gap-2 border-b p-3">
              <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setParams({})}><ArrowLeft className="h-4 w-4" /></Button>
              <div><div className="font-bold">{conv.title}</div><div className="text-xs text-muted-foreground">{conv.participants.join(', ')}</div></div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.map((m) => (
                <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[75%] rounded-2xl px-4 py-2 text-sm', m.mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted')}>
                    {!m.mine && conv.isGroup && <div className="text-xs font-bold">{m.sender}</div>}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <div className="mt-1 text-[10px] opacity-60">{fmtDateTime(m.createdOn)}</div>
                  </div>
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Typ een bericht…" />
              <Button type="submit" size="icon" disabled={!body.trim()}><Send className="h-4 w-4" /></Button>
            </form>
          </>)}
        </div>
      </Card>
      {creating && <NewConv onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); loadConvs(); setParams({ c: id }); }} />}
    </div>
  );
}
