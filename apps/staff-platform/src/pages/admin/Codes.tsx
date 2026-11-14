import { useState } from 'react';
import { manageCodes, listOrg } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@project/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { Plus, Copy, RefreshCw, Ban, Trash2, KeyRound, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useSession, fmtDateTime } from '../../lib/session';
import { PageHeader, StatusBadge, Empty, LoadingRows, Field, useLoad, run } from '../../components/kit';
import { Select } from '../../components/fields';

type Code = { id: string; code: string; fullName: string; email: string; jobTitle: string; role: string; status: string; expiresAt: string; createdBy: string; usedAt: string; createdOn: string };

export function ShowCode({ code, onClose }: { code: string; onClose: () => void }) {
  const text = `Je bent uitgenodigd voor ons Staff Platform.\n\n1. Ga naar ${window.location.origin}\n2. Log in met je e-mailadres\n3. Voer deze toegangscode in: ${code}`;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Toegangscode</DialogTitle><DialogDescription>Deel deze eenmalige code veilig met de medewerker. Na activatie blijft de medewerker ingelogd.</DialogDescription></DialogHeader>
        <div className="rounded-xl bg-sidebar p-6 text-center font-mono text-2xl font-bold tracking-[0.2em] text-sidebar-primary">{code}</div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(text); toast.success('Uitnodiging gekopieerd'); }}>Uitnodigingstekst kopiëren</Button>
          <Button onClick={() => { navigator.clipboard.writeText(code); toast.success('Code gekopieerd'); }}><Copy className="mr-2 h-4 w-4" />Code kopiëren</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CodeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (code: string) => void }) {
  const { me } = useSession();
  const { data: org } = useLoad(() => listOrg({}));
  const [f, setF] = useState({ fullName: '', email: '', jobTitle: '', roleId: '', departmentId: '', validDays: 14 });
  const [err, setErr] = useState('');
  const roles = (org?.roles || []).filter((r) => r.rank < me.rank || me.perms.includes('roles.manage'));
  const submit = async () => {
    if (f.fullName.trim().length < 2) return setErr('Naam is verplicht');
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Ongeldig e-mailadres');
    if (!f.roleId) return setErr('Kies een rol');
    const r = await run(manageCodes({ action: 'create', data: { ...f, departmentId: f.departmentId || undefined } }), 'Code aangemaakt');
    if (r && 'code' in r) onCreated(r.code as string);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Medewerker uitnodigen</DialogTitle><DialogDescription>Maak een unieke, eenmalige toegangscode aan.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Volledige naam"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
          <Field label="E-mail (koppelt code aan adres)"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Functie"><Input value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} /></Field>
          <Field label="Rol"><Select value={f.roleId} onChange={(v) => setF({ ...f, roleId: v })} placeholder="Kies rol" options={roles.map((r) => ({ value: r.id, label: r.name }))} /></Field>
          <Field label="Afdeling"><Select value={f.departmentId} onChange={(v) => setF({ ...f, departmentId: v })} placeholder="—" options={(org?.departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Field>
          <Field label="Geldig (dagen)"><Input type="number" min={1} max={365} value={f.validDays} onChange={(e) => setF({ ...f, validDays: Math.min(365, Math.max(1, Number(e.target.value))) })} /></Field>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={submit}>Code aanmaken</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Codes() {
  const { data, loading, reload } = useLoad(() => manageCodes({ action: 'list' }));
  const codes = (data && 'codes' in data ? data.codes : []) as Code[];
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const list = codes.filter((c) => (!status || c.status === status) && `${c.fullName} ${c.email} ${c.code}`.toLowerCase().includes(q.toLowerCase()));
  const act = async (c: Code, action: 'revoke' | 'renew' | 'delete') => {
    const r = await run(manageCodes({ action, id: c.id }), { revoke: 'Ingetrokken', renew: 'Nieuwe code uitgegeven', delete: 'Verwijderd' }[action]);
    if (r) { reload(); if (action === 'renew' && 'code' in r) setShown(r.code as string); }
  };
  return (
    <div>
      <PageHeader title="Toegangscodes" description="Eenmalige activatiecodes: aanmaken, intrekken, opnieuw uitgeven en vervaldatums." actions={<Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Nieuwe code</Button>} />
      <Card><CardContent className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select className="w-auto" value={status} onChange={setStatus} placeholder="Alle statussen" options={['Actief', 'Gebruikt', 'Ingetrokken', 'Verlopen']} />
        </div>
        {loading ? <LoadingRows /> : !list.length ? <Empty text="Geen codes" icon={KeyRound} /> : (
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Voor</TableHead><TableHead>Rol</TableHead><TableHead>Status</TableHead><TableHead>Verloopt</TableHead><TableHead>Aangemaakt door</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{list.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.status === 'Actief' ? c.code : '••••-••••-' + c.code.slice(-4)}</TableCell>
                <TableCell><div className="font-semibold">{c.fullName}</div><div className="text-xs text-muted-foreground">{c.email || 'elk e-mailadres'}</div></TableCell>
                <TableCell>{c.role}</TableCell>
                <TableCell><StatusBadge status={c.status} />{c.usedAt && <div className="text-xs text-muted-foreground">{fmtDateTime(c.usedAt)}</div>}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(c.expiresAt)}</TableCell>
                <TableCell className="text-xs">{c.createdBy}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {c.status === 'Actief' && <Button size="icon" variant="ghost" title="Kopiëren" onClick={() => setShown(c.code)}><Copy className="h-4 w-4" /></Button>}
                  {c.status !== 'Gebruikt' && <Button size="icon" variant="ghost" title="Opnieuw versturen (nieuwe code)" onClick={() => act(c, 'renew')}><RefreshCw className="h-4 w-4" /></Button>}
                  {c.status === 'Actief' && <Button size="icon" variant="ghost" title="Intrekken" onClick={() => act(c, 'revoke')}><Ban className="h-4 w-4" /></Button>}
                  <Button size="icon" variant="ghost" title="Verwijderen" onClick={() => act(c, 'delete')}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
        )}
      </CardContent></Card>
      {creating && <CodeDialog onClose={() => setCreating(false)} onCreated={(code) => { setCreating(false); setShown(code); reload(); }} />}
      {shown && <ShowCode code={shown} onClose={() => setShown('')} />}
    </div>
  );
}
