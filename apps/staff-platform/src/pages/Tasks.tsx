import { useMemo, useState } from 'react';
import { tasks, type TasksOutputType } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus, Search, Pencil, Trash2, CalendarClock, FolderKanban, Download } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { useSession, fmtDate, today, exportCSV } from '../lib/session';
import { PageHeader, StatusBadge, Empty, LoadingRows, Field, useLoad, run } from '../components/kit';
import { DateField, MemberSelect, Select } from '../components/fields';

type Item = Extract<TasksOutputType, { items: unknown }>['items'][0];
const COLS = ['Open', 'Bezig', 'Ter controle', 'Afgerond'] as const;

function TaskDialog({ item, team, onClose, onSaved }: { item: Item | null; team: boolean; onClose: () => void; onSaved: () => void }) {
  const { me } = useSession();
  const [f, setF] = useState({ title: item?.title || '', description: item?.description || '', assigneeId: item?.assigneeId || (team ? '' : me.id), dueDate: item?.dueDate?.slice(0, 10) || '', priority: item?.priority || 'Normaal', project: item?.project || '' });
  const [err, setErr] = useState('');
  const save = async () => {
    if (f.title.trim().length < 2) return setErr('Titel is verplicht');
    if (team && !f.assigneeId) return setErr('Kies een medewerker');
    if (await run(tasks({ action: 'save', id: item?.id, data: { ...f, assigneeId: f.assigneeId || undefined, dueDate: f.dueDate || undefined } }), 'Taak opgeslagen')) { onSaved(); onClose(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? 'Taak bewerken' : 'Nieuwe taak'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titel" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Omschrijving" className="sm:col-span-2"><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          {team && <Field label="Toewijzen aan" className="sm:col-span-2"><MemberSelect value={f.assigneeId} onChange={(v) => setF({ ...f, assigneeId: v })} /></Field>}
          <Field label="Deadline"><DateField value={f.dueDate} onChange={(v) => setF({ ...f, dueDate: v })} /></Field>
          <Field label="Prioriteit"><Select value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={['Laag', 'Normaal', 'Hoog', 'Urgent']} /></Field>
          <Field label="Project" className="sm:col-span-2"><Input value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} placeholder="Bijv. Inwerktraject Q1" /></Field>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={save}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TasksView({ mode = 'mine' }: { mode?: 'mine' | 'team' }) {
  const team = mode === 'team';
  const { data, loading, reload, setData } = useLoad(() => tasks({ action: 'list', scope: mode }), [mode]);
  const [edit, setEdit] = useState<Item | null | 'new'>(null);
  const [q, setQ] = useState('');
  const [project, setProject] = useState('');
  const all = (data && 'items' in data ? data.items : []) as Item[];
  const projects = [...new Set(all.map((t) => t.project).filter(Boolean))];
  const items = useMemo(() => all.filter((t) => (!project || t.project === project) && `${t.title} ${t.assignee} ${t.project}`.toLowerCase().includes(q.toLowerCase())), [all, q, project]);
  const setStatus = async (t: Item, status: (typeof COLS)[number]) => {
    setData({ items: all.map((x) => (x.id === t.id ? { ...x, status } : x)) } as typeof data);
    if (!(await run(tasks({ action: 'status', id: t.id, status })))) reload();
  };
  return (
    <div>
      <PageHeader title={team ? 'Takenverdeling' : 'Taken & projecten'} description={team ? 'Wijs taken toe, controleer de voortgang en bewaak deadlines.' : 'Je persoonlijke takenlijst met deadlines en prioriteiten.'}
        actions={<>
          <Button variant="outline" onClick={() => exportCSV('taken', items.map((t) => ({ Titel: t.title, Medewerker: t.assignee, Project: t.project, Deadline: t.dueDate, Prioriteit: t.priority, Status: t.status })))}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button onClick={() => setEdit('new')}><Plus className="mr-2 h-4 w-4" />Taak</Button>
        </>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select className="w-auto" value={project} onChange={setProject} placeholder="Alle projecten" options={projects} />
      </div>
      {loading ? <LoadingRows /> : !all.length ? <Card><CardContent><Empty text="Nog geen taken" /></CardContent></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLS.map((col) => {
            const list = items.filter((t) => t.status === col);
            return (
              <div key={col} className="rounded-xl bg-muted/50 p-3">
                <div className="mb-3 flex items-center justify-between px-1"><span className="text-sm font-bold">{col}</span><span className="rounded-full bg-background px-2 text-xs font-semibold">{list.length}</span></div>
                <div className="space-y-2">
                  {list.map((t) => {
                    const overdue = t.dueDate && t.dueDate.slice(0, 10) < today() && t.status !== 'Afgerond';
                    return (
                      <Card key={t.id} className="shadow-sm"><CardContent className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2"><div className="font-semibold leading-tight">{t.title}</div><StatusBadge status={t.priority} /></div>
                        {t.description && <p className="line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {t.dueDate && <span className={cn('flex items-center gap-1', overdue && 'font-semibold text-destructive')}><CalendarClock className="h-3 w-3" />{fmtDate(t.dueDate)}</span>}
                          {t.project && <span className="flex items-center gap-1"><FolderKanban className="h-3 w-3" />{t.project}</span>}
                          {team && <span>{t.assignee}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Select className="h-8 flex-1 text-xs" value={t.status} onChange={(v) => setStatus(t, v as (typeof COLS)[number])} options={[...COLS]} />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={async () => { if (await run(tasks({ action: 'delete', id: t.id }), 'Taak verwijderd')) reload(); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </CardContent></Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {edit && <TaskDialog item={edit === 'new' ? null : edit} team={team} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  );
}
