import { useState } from 'react';
import { decisions } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus, Pencil, Trash2, Gavel, Download } from 'lucide-react';
import { fmtDate, exportCSV } from '../../lib/session';
import { PageHeader, StatusBadge, Empty, LoadingRows, Field, useLoad, run } from '../../components/kit';
import { DateField, Select } from '../../components/fields';

type D = { id: string; title: string; description: string; status: string; meetingDate: string; outcome: string; author: string; createdOn: string };
const STAGES = ['Concept', 'In bespreking', 'Goedgekeurd', 'Afgewezen', 'Gearchiveerd'];

function DecisionDialog({ item, onClose, onSaved }: { item: D | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: item?.title || '', description: item?.description || '', status: item?.status || 'Concept', meetingDate: item?.meetingDate?.slice(0, 10) || '', outcome: item?.outcome || '' });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? 'Besluit bewerken' : 'Nieuw besluit'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titel" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(v) => setF({ ...f, status: v })} options={STAGES} /></Field>
          <Field label="Vergaderdatum"><DateField value={f.meetingDate} onChange={(v) => setF({ ...f, meetingDate: v })} /></Field>
          <Field label="Voorstel / omschrijving" className="sm:col-span-2"><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Uitkomst / verslag" className="sm:col-span-2"><Textarea rows={3} value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button disabled={f.title.trim().length < 2} onClick={async () => { if (await run(decisions({ action: 'save', id: item?.id, data: { ...f, meetingDate: f.meetingDate || undefined } }), 'Opgeslagen')) { onSaved(); onClose(); } }}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Decisions() {
  const { data, loading, reload } = useLoad(() => decisions({ action: 'list' }));
  const items = (data && 'items' in data ? data.items : []) as D[];
  const [edit, setEdit] = useState<D | null | 'new'>(null);
  const [stage, setStage] = useState('');
  const list = items.filter((d) => (stage ? d.status === stage : d.status !== 'Gearchiveerd'));
  return (
    <div>
      <PageHeader title="Besluitenregister" description="Besluiten aanmaken, bespreken, goedkeuren en archiveren — inclusief vergaderverslagen."
        actions={<>
          <Button variant="outline" onClick={() => exportCSV('besluiten', items.map((d) => ({ Titel: d.title, Status: d.status, Vergadering: d.meetingDate, Uitkomst: d.outcome, Auteur: d.author })))}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button onClick={() => setEdit('new')}><Plus className="mr-2 h-4 w-4" />Besluit</Button>
        </>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {['', ...STAGES].map((s) => <Button key={s} size="sm" variant={stage === s ? 'default' : 'outline'} onClick={() => setStage(s)}>{s || 'Actueel'} <span className="ml-1 opacity-60">{s ? items.filter((d) => d.status === s).length : items.filter((d) => d.status !== 'Gearchiveerd').length}</span></Button>)}
      </div>
      {loading ? <LoadingRows /> : !list.length ? <Card><CardContent><Empty text="Geen besluiten" icon={Gavel} /></CardContent></Card> : (
        <div className="space-y-3">{list.map((d) => (
          <Card key={d.id}><CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div><div className="flex flex-wrap items-center gap-2"><b className="text-lg">{d.title}</b><StatusBadge status={d.status} /></div><div className="text-xs text-muted-foreground">{d.author} · aangemaakt {fmtDate(d.createdOn)}{d.meetingDate && ` · vergadering ${fmtDate(d.meetingDate)}`}</div></div>
              <div className="flex shrink-0">
                {d.status !== 'Gearchiveerd' && <Button size="sm" variant="ghost" onClick={async () => { if (await run(decisions({ action: 'save', id: d.id, data: { ...d, status: 'Gearchiveerd', meetingDate: d.meetingDate || undefined } }), 'Gearchiveerd')) reload(); }}>Archiveren</Button>}
                <Button size="icon" variant="ghost" onClick={() => setEdit(d)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={async () => { if (await run(decisions({ action: 'delete', id: d.id }), 'Verwijderd')) reload(); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            {d.description && <p className="mt-3 whitespace-pre-wrap text-sm">{d.description}</p>}
            {d.outcome && <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm"><b>Uitkomst:</b> {d.outcome}</div>}
          </CardContent></Card>
        ))}</div>
      )}
      {edit && <DecisionDialog item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  );
}
