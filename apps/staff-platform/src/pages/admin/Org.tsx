import { useState } from 'react';
import { listOrg, saveOrg, type ListOrgOutputType } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Checkbox } from '@project/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@project/components/ui/dialog';
import { Plus, Pencil, Trash2, Lock, Building } from 'lucide-react';
import { PERMISSIONS, PERM_KEYS } from '../../lib/permissions';
import { PageHeader, Field, LoadingRows, useLoad, run, Empty } from '../../components/kit';

type Role = ListOrgOutputType['roles'][0];
type Dept = ListOrgOutputType['departments'][0];

function RoleDialog({ role, onClose, onSaved }: { role: Role | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: role?.name || '', description: role?.description || '', rank: role?.rank ?? 20, permissions: role?.permissions || [] });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{role ? `Rol: ${role.name}` : 'Nieuwe rol'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Naam" className="sm:col-span-2"><Input value={f.name} disabled={role?.isSystem} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Niveau (1–100)"><Input type="number" min={1} max={100} value={f.rank} onChange={(e) => setF({ ...f, rank: Math.min(100, Math.max(1, Number(e.target.value))) })} /></Field>
          <Field label="Omschrijving" className="sm:col-span-3"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Niveau bepaalt hiërarchie: een rol kan alleen medewerkers met een lager niveau beheren (Beheer 100 · Bestuur 80 · Management 60 · Staff 10).</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PERM_KEYS.map((p) => (
            <label key={p} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted">
              <Checkbox className="mt-0.5" checked={f.permissions.includes(p)} onCheckedChange={(v) => setF({ ...f, permissions: v ? [...f.permissions, p] : f.permissions.filter((x) => x !== p) })} />
              <span>{PERMISSIONS[p]}<span className="block font-mono text-[10px] text-muted-foreground">{p}</span></span>
            </label>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button disabled={f.name.trim().length < 2} onClick={async () => { if (await run(saveOrg({ kind: 'role', action: 'save', id: role?.id, ...f }), 'Rol opgeslagen')) { onSaved(); onClose(); } }}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Roles() {
  const { data, loading, reload } = useLoad(() => listOrg({}));
  const [edit, setEdit] = useState<Role | null | 'new'>(null);
  const roles = data?.roles || [];
  return (
    <div>
      <PageHeader title="Rollen & rechten" description="Stel per rol in welke pagina's, functies en gegevens toegankelijk zijn. Rechten worden server-side afgedwongen." actions={<Button onClick={() => setEdit('new')}><Plus className="mr-2 h-4 w-4" />Nieuwe rol</Button>} />
      {loading ? <LoadingRows /> : (<>
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div><CardTitle className="flex items-center gap-2 text-base">{r.name}{r.isSystem && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}</CardTitle><CardDescription>Niveau {r.rank} · {r.members} medewerker(s)</CardDescription></div>
                  <div className="flex"><Button size="icon" variant="ghost" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>{!r.isSystem && <Button size="icon" variant="ghost" onClick={async () => { if (await run(saveOrg({ kind: 'role', action: 'delete', id: r.id }), 'Rol verwijderd')) reload(); }}><Trash2 className="h-4 w-4" /></Button>}</div>
                </div>
              </CardHeader>
              <CardContent><p className="mb-2 text-sm text-muted-foreground">{r.description}</p><div className="text-xs font-semibold">{r.permissions.length} van {PERM_KEYS.length} rechten</div></CardContent>
            </Card>
          ))}
        </div>
        <Card><CardHeader><CardTitle className="text-base">Rechtenmatrix</CardTitle></CardHeader><CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="py-2 text-left font-semibold">Recht</th>{roles.map((r) => <th key={r.id} className="px-2 py-2 text-center font-semibold">{r.name}</th>)}</tr></thead>
            <tbody>{PERM_KEYS.map((p) => (
              <tr key={p} className="border-b last:border-0"><td className="py-2 pr-4">{PERMISSIONS[p]}</td>{roles.map((r) => (
                <td key={r.id} className="px-2 text-center"><Checkbox checked={r.permissions.includes(p)} onCheckedChange={async (v) => { if (await run(saveOrg({ kind: 'role', action: 'save', id: r.id, name: r.name, description: r.description, rank: r.rank, permissions: v ? [...r.permissions, p] : r.permissions.filter((x) => x !== p) }))) reload(); }} /></td>
              ))}</tr>
            ))}</tbody>
          </table>
        </CardContent></Card>
      </>)}
      {edit && <RoleDialog role={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </div>
  );
}

export function Departments() {
  const { data, loading, reload } = useLoad(() => listOrg({}));
  const [edit, setEdit] = useState<Dept | null | 'new'>(null);
  const [f, setF] = useState({ name: '', description: '' });
  const open = (d: Dept | null | 'new') => { setEdit(d); setF(d && d !== 'new' ? { name: d.name, description: d.description } : { name: '', description: '' }); };
  return (
    <div>
      <PageHeader title="Afdelingen & teamstructuur" description="Beheer afdelingen. Management ziet en beheert alleen medewerkers van de eigen afdeling." actions={<Button onClick={() => open('new')}><Plus className="mr-2 h-4 w-4" />Afdeling</Button>} />
      {loading ? <LoadingRows /> : !data?.departments.length ? <Empty /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.departments.map((d) => (
            <Card key={d.id}><CardContent className="flex gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><div className="font-bold">{d.name}</div><div className="text-xs text-muted-foreground">{d.members} medewerker(s)</div><p className="mt-1 text-sm text-muted-foreground">{d.description}</p></div>
              <div className="flex flex-col"><Button size="icon" variant="ghost" onClick={() => open(d)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={async () => { if (await run(saveOrg({ kind: 'department', action: 'delete', id: d.id }), 'Verwijderd')) reload(); }}><Trash2 className="h-4 w-4" /></Button></div>
            </CardContent></Card>
          ))}
        </div>
      )}
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit === 'new' ? 'Nieuwe afdeling' : 'Afdeling bewerken'}</DialogTitle></DialogHeader>
            <Field label="Naam"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Omschrijving"><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Annuleren</Button><Button disabled={f.name.trim().length < 2} onClick={async () => { if (await run(saveOrg({ kind: 'department', action: 'save', id: edit === 'new' ? undefined : edit.id, ...f }), 'Opgeslagen')) { setEdit(null); reload(); } }}>Opslaan</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
