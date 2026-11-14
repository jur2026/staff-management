import { useMemo, useState } from 'react';
import { content, type ContentOutputType } from 'zitejs/api';
import { Markdown } from '@project/components/markdown';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus, Search, FileText, Paperclip, Pencil, Trash2, BookOpen } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { fmtDate } from '../lib/session';
import { PageHeader, Empty, LoadingRows, Field, useLoad, run } from '../components/kit';
import { FileField, Select } from '../components/fields';

type Doc = { id: string; title: string; category: string; content: string; file: string; minRank: number; updatedBy: string; createdOn: string };
const CATS = ['Staffhandboek', 'Kennisbank', 'Reglement', 'Procedure', 'Formulier', 'Training', 'Beleid', 'Verslag', 'Overig'];
const RANKS = [{ value: '0', label: 'Iedereen' }, { value: '60', label: 'Management en hoger' }, { value: '80', label: 'Bestuur en hoger' }, { value: '100', label: 'Alleen Beheer' }];

function DocDialog({ doc, onClose, onSaved }: { doc: Doc | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: doc?.title || '', category: doc?.category || 'Kennisbank', content: doc?.content || '', file: doc?.file || '', minRank: doc?.minRank ?? 0 });
  const save = async () => { if (f.title.trim().length >= 2 && (await run(content({ kind: 'document', action: 'save', id: doc?.id, doc: f }), 'Document opgeslagen'))) { onSaved(); onClose(); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{doc ? 'Document bewerken' : 'Nieuw document'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Titel" className="sm:col-span-3"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Categorie"><Select value={f.category} onChange={(v) => setF({ ...f, category: v })} options={CATS} /></Field>
          <Field label="Zichtbaar voor" className="sm:col-span-2"><Select value={String(f.minRank)} onChange={(v) => setF({ ...f, minRank: Number(v) })} options={RANKS} /></Field>
          <Field label="Inhoud (Markdown)" className="sm:col-span-3"><Textarea rows={10} className="font-mono text-xs" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Field>
          <Field label="Bestand" className="sm:col-span-3"><FileField value={f.file} onChange={(v) => setF({ ...f, file: v })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={save} disabled={f.title.trim().length < 2}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Documents({ manage = false }: { manage?: boolean }) {
  const { data, loading, reload } = useLoad(() => content({ kind: 'document', action: 'list' }));
  const canManage = !!(data && 'canManage' in data && data.canManage);
  const docs = (data && 'items' in data ? data.items : []) as Doc[];
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Doc | null>(null);
  const [edit, setEdit] = useState<Doc | null | 'new'>(null);
  const list = useMemo(() => docs.filter((d) => (!cat || d.category === cat) && `${d.title} ${d.content}`.toLowerCase().includes(q.toLowerCase())), [docs, cat, q]);
  return (
    <div>
      <PageHeader title={manage ? 'Documentenbeheer' : 'Documenten & kennisbank'} description="Staffhandboek, reglementen, procedures, formulieren, trainingen en beleid."
        actions={canManage && <Button onClick={() => setEdit('new')}><Plus className="mr-2 h-4 w-4" />Document</Button>} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="flex gap-1 overflow-x-auto lg:flex-col">
          {['', ...CATS].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn('flex items-center justify-between whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm', cat === c ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {c || 'Alles'}<span className="ml-2 text-xs opacity-70">{docs.filter((d) => !c || d.category === c).length}</span>
            </button>
          ))}
        </div>
        <div>
          <div className="relative mb-4"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Zoek in documenten…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {loading ? <LoadingRows /> : !list.length ? <Card><CardContent><Empty text="Geen documenten" icon={BookOpen} /></CardContent></Card> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((d) => (
                <Card key={d.id} className="cursor-pointer transition hover:border-primary/50 hover:shadow-md" onClick={() => setOpen(d)}>
                  <CardContent className="flex gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{d.title}</div>
                      <div className="text-xs text-muted-foreground">{d.category} · {fmtDate(d.createdOn)}{d.minRank > 0 && ' · beperkt'}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.content.replace(/[#*_>`-]/g, '')}</p>
                    </div>
                    {canManage && <div className="flex flex-col" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => { if (await run(content({ kind: 'document', action: 'delete', id: d.id }), 'Verwijderd')) reload(); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(null)}>
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            <DialogHeader><DialogTitle>{open.title}</DialogTitle></DialogHeader>
            <div className="text-xs text-muted-foreground">{open.category} · bijgewerkt door {open.updatedBy || '—'}</div>
            {open.content ? <Markdown>{open.content}</Markdown> : <p className="text-sm text-muted-foreground">Geen tekstinhoud.</p>}
            {open.file && <a href={open.file} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline"><Paperclip className="h-4 w-4" />Bestand openen</a>}
          </DialogContent>
        </Dialog>
      )}
      {edit && <DocDialog doc={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  );
}

export type { ContentOutputType };
