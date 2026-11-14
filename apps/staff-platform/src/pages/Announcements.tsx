import { useState } from 'react';
import { content } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus, Pin, Pencil, Trash2, Megaphone } from 'lucide-react';
import { fmtDateTime } from '../lib/session';
import { PageHeader, Empty, LoadingRows, Field, useLoad, run } from '../components/kit';

type Ann = { id: string; title: string; body: string; author: string; pinned: boolean; createdOn: string };

function AnnDialog({ item, onClose, onSaved }: { item: Ann | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: item?.title || '', body: item?.body || '', pinned: item?.pinned || false });
  const ok = f.title.trim().length >= 2 && f.body.trim().length >= 2;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'Mededeling bewerken' : 'Nieuwe mededeling'}</DialogTitle></DialogHeader>
        <Field label="Titel"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Bericht"><Textarea rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.pinned} onCheckedChange={(v) => setF({ ...f, pinned: v })} />Vastpinnen bovenaan</label>
        <p className="text-xs text-muted-foreground">Alle actieve medewerkers ontvangen een notificatie bij een nieuwe mededeling.</p>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button disabled={!ok} onClick={async () => { if (await run(content({ kind: 'announcement', action: 'save', id: item?.id, ann: f }), 'Gepubliceerd')) { onSaved(); onClose(); } }}>Publiceren</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Announcements() {
  const { data, loading, reload } = useLoad(() => content({ kind: 'announcement', action: 'list' }));
  const canManage = !!(data && 'canManage' in data && data.canManage);
  const items = (data && 'items' in data ? data.items : []) as Ann[];
  const [edit, setEdit] = useState<Ann | null | 'new'>(null);
  return (
    <div>
      <PageHeader title="Mededelingen" description="Aankondigingen en nieuws binnen de organisatie." actions={canManage && <Button onClick={() => setEdit('new')}><Plus className="mr-2 h-4 w-4" />Mededeling</Button>} />
      {loading ? <LoadingRows /> : !items.length ? <Card><CardContent><Empty text="Nog geen mededelingen" icon={Megaphone} /></CardContent></Card> : (
        <div className="space-y-4">
          {items.map((a) => (
            <Card key={a.id} className={a.pinned ? 'border-primary/40 bg-primary/[0.03]' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold">{a.pinned && <Pin className="h-4 w-4 text-primary" />}{a.title}</h2>
                    <div className="text-xs text-muted-foreground">{a.author} · {fmtDateTime(a.createdOn)}</div>
                  </div>
                  {canManage && <div className="flex">
                    <Button size="icon" variant="ghost" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => { if (await run(content({ kind: 'announcement', action: 'delete', id: a.id }), 'Verwijderd')) reload(); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{a.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {edit && <AnnDialog item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  );
}
