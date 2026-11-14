import { useState } from 'react';
import { settings } from 'zitejs/api';
import { Markdown } from '@project/components/markdown';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus, Pencil, Copy, Trash2, History, Eye, EyeOff, ArrowUp, ArrowDown, LayoutTemplate } from 'lucide-react';
import { useSession, fmtDateTime } from '../../lib/session';
import { PageHeader, Empty, LoadingRows, Field, useLoad, run } from '../../components/kit';
import { Select } from '../../components/fields';

type P = { id: string; title: string; content: string; minRank: number; published: boolean; sortOrder: number; updatedBy: string; history: { title: string; content: string; savedAt: string; by: string }[] };
const RANKS = [{ value: '0', label: 'Iedereen' }, { value: '60', label: 'Management en hoger' }, { value: '80', label: 'Bestuur en hoger' }, { value: '100', label: 'Alleen Beheer' }];
const WIDGETS: Record<string, string> = {
  'Kop': '\n## Nieuwe sectie\n',
  'Tekstblok': '\nSchrijf hier je tekst.\n',
  'Lijst': '\n- Punt 1\n- Punt 2\n- Punt 3\n',
  'Tabel': '\n| Kolom A | Kolom B |\n|---|---|\n| Waarde | Waarde |\n',
  'Callout': '\n> **Let op:** belangrijke informatie.\n',
  'Link': '\n[Linktekst](https://)\n',
  'Scheidingslijn': '\n---\n',
};

function Editor({ page, nextOrder, onClose, onSaved }: { page: P | null; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: page?.title || '', content: page?.content || '# Nieuwe pagina\n\nInhoud…', minRank: page?.minRank ?? 0, published: page?.published ?? false, sortOrder: page?.sortOrder ?? nextOrder });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader><DialogTitle>{page ? 'Pagina bewerken' : 'Nieuwe pagina'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Titel (ook in navigatie)" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Zichtbaar voor"><Select value={String(f.minRank)} onChange={(v) => setF({ ...f, minRank: Number(v) })} options={RANKS} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} />Gepubliceerd</label>
        </div>
        <div className="flex flex-wrap gap-1">{Object.entries(WIDGETS).map(([k, v]) => <Button key={k} size="sm" variant="outline" onClick={() => setF({ ...f, content: f.content + v })}><Plus className="mr-1 h-3 w-3" />{k}</Button>)}</div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Textarea rows={20} className="font-mono text-xs" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} />
          <div className="max-h-[480px] overflow-y-auto rounded-lg border p-4"><div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Live voorbeeld</div><Markdown>{f.content}</Markdown></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button disabled={f.title.trim().length < 2} onClick={async () => { if (await run(settings({ action: 'savePage', id: page?.id, page: f }), 'Pagina opgeslagen')) { onSaved(); onClose(); } }}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PagesAdmin() {
  const { refresh } = useSession();
  const { data, loading, reload } = useLoad(() => settings({ action: 'pages' }));
  const pages = (data && 'items' in data ? data.items : []) as P[];
  const [edit, setEdit] = useState<P | null | 'new'>(null);
  const [hist, setHist] = useState<P | null>(null);
  const done = () => { reload(); refresh(); };
  const save = async (p: P, patch: Partial<P>) => { if (await run(settings({ action: 'savePage', id: p.id, page: { title: p.title, content: p.content, minRank: p.minRank, published: p.published, sortOrder: p.sortOrder, ...patch } }))) done(); };
  const move = async (i: number, dir: number) => {
    const a = pages[i], b = pages[i + dir];
    if (!a || !b) return;
    await save(a, { sortOrder: b.sortOrder === a.sortOrder ? a.sortOrder + dir : b.sortOrder });
    await save(b, { sortOrder: a.sortOrder });
  };
  return (
    <div>
      <PageHeader title="Pagina- & panelbeheer" description="Maak informatiepagina's (bijv. staffhandboek, inwerktraject), bepaal zichtbaarheid per rol, volgorde in de navigatie en herstel eerdere versies. Modules en panels schakel je in via Systeeminstellingen; panelrechten via Rollen & rechten."
        actions={<Button onClick={() => setEdit('new')}><Plus className="mr-2 h-4 w-4" />Pagina</Button>} />
      <Card><CardContent className="p-4">
        {loading ? <LoadingRows /> : !pages.length ? <Empty text="Nog geen eigen pagina's" icon={LayoutTemplate} /> : (
          <div className="divide-y rounded-lg border">{pages.map((p, i) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex flex-col"><button disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button disabled={i === pages.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button></div>
              <div className="min-w-0 flex-1"><div className="font-semibold">{p.title}</div><div className="text-xs text-muted-foreground">{RANKS.find((r) => Number(r.value) === p.minRank)?.label || `Niveau ${p.minRank}+`} · {p.history.length} versie(s) · door {p.updatedBy || '—'}</div></div>
              <Button size="sm" variant="outline" onClick={() => save(p, { published: !p.published })}>{p.published ? <><Eye className="mr-1 h-4 w-4" />Gepubliceerd</> : <><EyeOff className="mr-1 h-4 w-4" />Verborgen</>}</Button>
              <Button size="icon" variant="ghost" title="Bewerken" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" title="Dupliceren" onClick={async () => { if (await run(settings({ action: 'duplicatePage', id: p.id }), 'Gedupliceerd')) done(); }}><Copy className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" title="Versies" onClick={() => setHist(p)}><History className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" title="Verwijderen" onClick={async () => { if (await run(settings({ action: 'deletePage', id: p.id }), 'Verwijderd')) done(); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}</div>
        )}
      </CardContent></Card>
      {edit && <Editor page={edit === 'new' ? null : edit} nextOrder={pages.length} onClose={() => setEdit(null)} onSaved={done} />}
      {hist && (
        <Dialog open onOpenChange={(o) => !o && setHist(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Versiegeschiedenis · {hist.title}</DialogTitle></DialogHeader>
            {!hist.history.length ? <Empty text="Nog geen eerdere versies" /> : <div className="max-h-96 space-y-2 overflow-y-auto">{hist.history.map((v, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div><b>{v.title}</b><div className="text-xs text-muted-foreground">{fmtDateTime(v.savedAt)}{v.by && ` · ${v.by}`}</div></div>
                <Button size="sm" variant="outline" onClick={async () => { if (await run(settings({ action: 'restorePage', id: hist.id, versionIndex: i }), 'Versie hersteld')) { setHist(null); done(); } }}>Herstellen</Button>
              </div>
            ))}</div>}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
