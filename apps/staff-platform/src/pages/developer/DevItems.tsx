import { useMemo, useState } from 'react';
import { devItems, type DevItemsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus, Search, Trash2 } from 'lucide-react';
import { fmtDateTime } from '../../lib/session';
import { Empty, Field, LoadingRows, StatusBadge, run, selectCls, useLoad } from '../../components/kit';

type Kind = 'Bug' | 'Taak' | 'Documentatie';
type Item = DevItemsOutputType['items'][0];
const STATUSES = ['Nieuw', 'Te doen', 'Bezig', 'In controle', 'Afgerond', 'Gesloten'] as const;
const PRIOS = ['Laag', 'Normaal', 'Hoog', 'Kritiek'] as const;
const blank = { title: '', description: '', status: 'Nieuw' as (typeof STATUSES)[number], priority: 'Normaal' as (typeof PRIOS)[number], component: '', assigneeId: '' };

export default function DevItems({ kind, title }: { kind: Kind; title: string }) {
  const { data, loading, setData } = useLoad(() => devItems({ action: 'list', kind }), [kind]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [edit, setEdit] = useState<{ id?: string; v: typeof blank } | null>(null);
  const rows = useMemo(() => (data?.items || []).filter((i) => (!status || i.status === status) && `${i.title} ${i.component} ${i.description}`.toLowerCase().includes(q.toLowerCase())), [data, q, status]);

  const save = async () => {
    if (!edit || edit.v.title.trim().length < 2) return;
    const r = await run(devItems({ action: 'save', kind, id: edit.id, data: { ...edit.v, assigneeId: edit.v.assigneeId || undefined } }), 'Opgeslagen');
    if (r) { setData(r); setEdit(null); }
  };
  const del = async (i: Item) => { const r = await run(devItems({ action: 'delete', kind, id: i.id }), 'Verwijderd'); if (r) setData(r); };
  const open = (i?: Item) => setEdit(i ? { id: i.id, v: { title: i.title, description: i.description, status: i.status as any, priority: i.priority as any, component: i.component, assigneeId: i.assigneeId } } : { v: { ...blank } });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-xl font-bold">{title}</h1>
        <Button onClick={() => open()}><Plus className="mr-2 h-4 w-4" />Nieuw</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Alle statussen</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      {loading ? <LoadingRows /> : !rows.length ? <Empty /> : (
        <div className="divide-y rounded-lg border bg-card">
          {rows.map((i) => (
            <div key={i.id} className="flex cursor-pointer flex-wrap items-center gap-3 p-3 hover:bg-muted/50" onClick={() => open(i)}>
              <span className="font-mono text-[11px] text-muted-foreground">#{i.id.slice(0, 6)}</span>
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{i.title}</div><div className="text-xs text-muted-foreground">{i.component || '—'} · {i.assignee || 'Niet toegewezen'} · {fmtDateTime(i.updatedOn)}</div></div>
              <StatusBadge status={i.priority} /><StatusBadge status={i.status} />
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); del(i); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? 'Bewerken' : `Nieuw: ${kind}`}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <Field label="Titel" error={edit.v.title.trim().length < 2 ? 'Minimaal 2 tekens' : undefined}><Input value={edit.v.title} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, title: e.target.value } })} /></Field>
              <Field label={kind === 'Documentatie' ? 'Inhoud (Markdown)' : 'Omschrijving / reproductiestappen'}><Textarea rows={kind === 'Documentatie' ? 10 : 5} value={edit.v.description} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, description: e.target.value } })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status"><select className={selectCls + ' w-full'} value={edit.v.status} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, status: e.target.value as any } })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Prioriteit"><select className={selectCls + ' w-full'} value={edit.v.priority} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, priority: e.target.value as any } })}>{PRIOS.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Component"><Input value={edit.v.component} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, component: e.target.value } })} placeholder="bv. Roosters" /></Field>
                <Field label="Toegewezen aan"><select className={selectCls + ' w-full'} value={edit.v.assigneeId} onChange={(e) => setEdit({ ...edit, v: { ...edit.v, assigneeId: e.target.value } })}><option value="">—</option>{data?.developers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Annuleren</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
