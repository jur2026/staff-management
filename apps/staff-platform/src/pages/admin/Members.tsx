import { useMemo, useState } from 'react';
import { listMembers, listOrg, saveMember, type ListMembersOutputType } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Checkbox } from '@project/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@project/components/ui/avatar';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { Search, MoreHorizontal, UserPlus, Download, ArrowUpDown, FolderOpen, Pencil, Ban, CheckCircle2, Archive, RotateCcw, Trash2, ShieldCheck, Users } from 'lucide-react';
import { useSession, fmtDateTime, initials, exportCSV } from '../../lib/session';
import { PERMISSIONS, PERM_KEYS } from '../../lib/permissions';
import { PageHeader, StatusBadge, Empty, LoadingRows, Field, StatCard, useLoad, run } from '../../components/kit';
import { DateField, Select } from '../../components/fields';
import { CodeDialog, ShowCode } from './Codes';
import Dossier from './Dossier';

type M = ListMembersOutputType['members'][0] & { username?: string; roleId?: string; rank?: number; status?: string; employmentStatus?: string; activated?: boolean; lastActive?: string; startDate?: string; overrides?: { grant?: string[]; deny?: string[] } };
type SortKey = 'fullName' | 'roleName' | 'department' | 'status' | 'lastActive';

function EditDialog({ m, onClose, onSaved }: { m: M; onClose: () => void; onSaved: () => void }) {
  const { data: org } = useLoad(() => listOrg({}));
  const { me } = useSession();
  const [f, setF] = useState({ fullName: m.fullName, username: m.username || '', jobTitle: m.jobTitle, phone: m.phone || '', departmentId: m.departmentId, roleId: m.roleId || '', employmentStatus: m.employmentStatus || '', startDate: m.startDate?.slice(0, 10) || '' });
  const roles = (org?.roles || []).filter((r) => r.rank < me.rank || me.perms.includes('roles.manage'));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Medewerker bewerken</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Volledige naam"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
          <Field label="Gebruikersnaam"><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
          <Field label="Functie"><Input value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} /></Field>
          <Field label="Telefoon"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Rol"><Select value={f.roleId} onChange={(v) => setF({ ...f, roleId: v })} options={roles.map((r) => ({ value: r.id, label: r.name }))} /></Field>
          <Field label="Afdeling"><Select value={f.departmentId} onChange={(v) => setF({ ...f, departmentId: v })} placeholder="—" options={(org?.departments || []).map((d) => ({ value: d.id, label: d.name }))} /></Field>
          <Field label="Dienstverband"><Select value={f.employmentStatus} onChange={(v) => setF({ ...f, employmentStatus: v })} placeholder="—" options={['Inwerktraject', 'In dienst', 'Uitdiensttreding', 'Uit dienst']} /></Field>
          <Field label="Startdatum"><DateField value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Functiewijzigingen worden automatisch in het dossier vastgelegd.</p>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button disabled={f.fullName.trim().length < 2} onClick={async () => { if (await run(saveMember({ action: 'update', id: m.id, data: f }), 'Opgeslagen')) { onSaved(); onClose(); } }}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OverridesDialog({ m, onClose, onSaved }: { m: M; onClose: () => void; onSaved: () => void }) {
  const [grant, setGrant] = useState<string[]>(m.overrides?.grant || []);
  const [deny, setDeny] = useState<string[]>(m.overrides?.deny || []);
  const cycle = (p: string) => {
    if (grant.includes(p)) { setGrant(grant.filter((x) => x !== p)); setDeny([...deny, p]); }
    else if (deny.includes(p)) setDeny(deny.filter((x) => x !== p));
    else setGrant([...grant, p]);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Individuele rechten · {m.fullName}</DialogTitle><DialogDescription>Overschrijf de rechten van de rol ({m.roleName}) voor deze gebruiker. Klik om te wisselen: rol-standaard → extra toegekend → geweigerd.</DialogDescription></DialogHeader>
        <div className="space-y-1">{PERM_KEYS.map((p) => (
          <button key={p} onClick={() => cycle(p)} className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted">
            <span>{PERMISSIONS[p]}</span>
            {grant.includes(p) ? <StatusBadge status="Goedgekeurd" className="ml-2" /> : deny.includes(p) ? <StatusBadge status="Afgewezen" className="ml-2" /> : <span className="text-xs text-muted-foreground">rol-standaard</span>}
          </button>
        ))}</div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuleren</Button><Button onClick={async () => { if (await run(saveMember({ action: 'overrides', id: m.id, overrides: { grant, deny } }), 'Rechten bijgewerkt')) { onSaved(); onClose(); } }}>Opslaan</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MembersAdmin() {
  const { can, me } = useSession();
  const manage = can('users.manage');
  const { data, loading, reload } = useLoad(() => listMembers({}));
  const members = (data?.members || []) as M[];
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fRole, setFRole] = useState('');
  const [fDept, setFDept] = useState('');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'fullName', dir: 1 });
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [dossier, setDossier] = useState('');
  const [edit, setEdit] = useState<M | null>(null);
  const [perms, setPerms] = useState<M | null>(null);
  const [confirm, setConfirm] = useState<{ m: M; action: 'delete' | 'resetAccess' } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [code, setCode] = useState('');
  const PER = 25;

  const filtered = useMemo(() => members
    .filter((m) => (!fStatus || m.status === fStatus) && (!fRole || m.roleName === fRole) && (!fDept || m.department === fDept) && `${m.fullName} ${m.email} ${m.jobTitle} ${m.username}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(a[sort.k] || '').localeCompare(String(b[sort.k] || '')) * sort.dir), [members, q, fStatus, fRole, fDept, sort]);
  const pageItems = filtered.slice(page * PER, page * PER + PER);
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const status = async (m: M, s: 'Actief' | 'Geblokkeerd' | 'Gedeactiveerd' | 'Gearchiveerd') => { if (await run(saveMember({ action: 'status', id: m.id, status: s }), `Status: ${s}`)) reload(); };
  const H = ({ k, label }: { k: SortKey; label: string }) => <TableHead><button className="flex items-center gap-1" onClick={() => setSort({ k, dir: sort.k === k ? (-sort.dir as 1 | -1) : 1 })}>{label}<ArrowUpDown className="h-3 w-3" /></button></TableHead>;

  return (
    <div>
      <PageHeader title={manage ? 'Gebruikersbeheer' : 'Medewerkersoverzicht'} description={manage ? 'Beheer accounts, rollen, afdelingen, status en individuele rechten.' : 'Medewerkers binnen je bevoegdheid met hun dossiers.'}
        actions={<>
          <Button variant="outline" onClick={() => exportCSV('medewerkers', filtered.map((m) => ({ Naam: m.fullName, Email: m.email, Functie: m.jobTitle, Rol: m.roleName, Afdeling: m.department, Status: m.status, Dienstverband: m.employmentStatus, LaatstActief: m.lastActive })))}><Download className="mr-2 h-4 w-4" />CSV</Button>
          {can('codes.manage') && <Button onClick={() => setInviting(true)}><UserPlus className="mr-2 h-4 w-4" />Uitnodigen</Button>}
        </>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Totaal" value={members.length} icon={Users} />
        <StatCard label="Actief" value={members.filter((m) => m.status === 'Actief').length} icon={CheckCircle2} tone="blue" />
        <StatCard label="Geblokkeerd" value={members.filter((m) => m.status === 'Geblokkeerd').length} icon={Ban} tone="red" />
        <StatCard label="Inwerktraject" value={members.filter((m) => m.employmentStatus === 'Inwerktraject').length} icon={UserPlus} tone="amber" />
      </div>
      <Card><CardContent className="p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Zoek op naam, e-mail, functie…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
          <Select className="w-auto" value={fStatus} onChange={setFStatus} placeholder="Alle statussen" options={['Actief', 'Geblokkeerd', 'Gedeactiveerd', 'Gearchiveerd']} />
          <Select className="w-auto" value={fRole} onChange={setFRole} placeholder="Alle rollen" options={[...new Set(members.map((m) => m.roleName).filter(Boolean))]} />
          <Select className="w-auto" value={fDept} onChange={setFDept} placeholder="Alle afdelingen" options={[...new Set(members.map((m) => m.department).filter(Boolean))]} />
        </div>
        {manage && sel.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-2 text-sm">
            <b className="px-2">{sel.length} geselecteerd</b>
            {(['Actief', 'Geblokkeerd', 'Gedeactiveerd', 'Gearchiveerd'] as const).map((s) => <Button key={s} size="sm" variant="outline" onClick={async () => { if (await run(saveMember({ action: 'bulkStatus', ids: sel, status: s }), 'Bijgewerkt')) { setSel([]); reload(); } }}>{s}</Button>)}
          </div>
        )}
        {loading ? <LoadingRows /> : !filtered.length ? <Empty text="Geen medewerkers gevonden" /> : (<>
          <div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              {manage && <TableHead className="w-8"><Checkbox checked={pageItems.every((m) => sel.includes(m.id))} onCheckedChange={(v) => setSel(v ? [...new Set([...sel, ...pageItems.filter((m) => m.id !== me.id).map((m) => m.id)])] : [])} /></TableHead>}
              <H k="fullName" label="Medewerker" /><H k="roleName" label="Rol" /><H k="department" label="Afdeling" /><H k="status" label="Status" /><H k="lastActive" label="Laatst actief" /><TableHead />
            </TableRow></TableHeader>
            <TableBody>{pageItems.map((m) => (
              <TableRow key={m.id}>
                {manage && <TableCell><Checkbox disabled={m.id === me.id} checked={sel.includes(m.id)} onCheckedChange={(v) => setSel(v ? [...sel, m.id] : sel.filter((x) => x !== m.id))} /></TableCell>}
                <TableCell>
                  <button className="flex items-center gap-3 text-left" onClick={() => setDossier(m.id)}>
                    <Avatar className="h-9 w-9"><AvatarImage src={m.avatar} /><AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials(m.fullName)}</AvatarFallback></Avatar>
                    <div><div className="font-semibold">{m.fullName}</div><div className="text-xs text-muted-foreground">{m.jobTitle || m.email}</div></div>
                  </button>
                </TableCell>
                <TableCell>{m.roleName}{(m.overrides?.grant?.length || m.overrides?.deny?.length) ? <ShieldCheck className="ml-1 inline h-3 w-3 text-primary" /> : null}</TableCell>
                <TableCell>{m.department || '—'}</TableCell>
                <TableCell><StatusBadge status={m.status || ''} />{!m.activated && <div className="text-[10px] text-muted-foreground">niet gekoppeld</div>}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(m.lastActive)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDossier(m.id)}><FolderOpen className="mr-2 h-4 w-4" />Dossier</DropdownMenuItem>
                      {manage && m.id !== me.id && (<>
                        <DropdownMenuItem onClick={() => setEdit(m)}><Pencil className="mr-2 h-4 w-4" />Bewerken</DropdownMenuItem>
                        {can('roles.manage') && <DropdownMenuItem onClick={() => setPerms(m)}><ShieldCheck className="mr-2 h-4 w-4" />Individuele rechten</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        {m.status !== 'Actief' && <DropdownMenuItem onClick={() => status(m, 'Actief')}><CheckCircle2 className="mr-2 h-4 w-4" />Activeren / deblokkeren</DropdownMenuItem>}
                        {m.status !== 'Geblokkeerd' && <DropdownMenuItem onClick={() => status(m, 'Geblokkeerd')}><Ban className="mr-2 h-4 w-4" />Blokkeren</DropdownMenuItem>}
                        {m.status !== 'Gedeactiveerd' && <DropdownMenuItem onClick={() => status(m, 'Gedeactiveerd')}><Ban className="mr-2 h-4 w-4" />Deactiveren</DropdownMenuItem>}
                        {m.status !== 'Gearchiveerd' && <DropdownMenuItem onClick={() => status(m, 'Gearchiveerd')}><Archive className="mr-2 h-4 w-4" />Archiveren</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => setConfirm({ m, action: 'resetAccess' })}><RotateCcw className="mr-2 h-4 w-4" />Accountherstel (ontkoppelen)</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setConfirm({ m, action: 'delete' })}><Trash2 className="mr-2 h-4 w-4" />Verwijderen</DropdownMenuItem>
                      </>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} medewerkers</span>
            <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Vorige</Button>{page + 1} / {pages}<Button size="sm" variant="outline" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Volgende</Button></div>
          </div>
        </>)}
      </CardContent></Card>
      {dossier && <Dossier id={dossier} onClose={() => setDossier('')} />}
      {edit && <EditDialog m={edit} onClose={() => setEdit(null)} onSaved={reload} />}
      {perms && <OverridesDialog m={perms} onClose={() => setPerms(null)} onSaved={reload} />}
      {inviting && <CodeDialog onClose={() => setInviting(false)} onCreated={(c) => { setInviting(false); setCode(c); }} />}
      {code && <ShowCode code={code} onClose={() => setCode('')} />}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.action === 'delete' ? 'Medewerker verwijderen?' : 'Account ontkoppelen?'}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.action === 'delete' ? `${confirm?.m.fullName} wordt definitief verwijderd. Overweeg archiveren om de gegevens te bewaren.` : `De inlog van ${confirm?.m.fullName} wordt losgekoppeld. Met een nieuwe toegangscode op hetzelfde e-mailadres herstelt de medewerker zijn account inclusief alle gegevens.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annuleren</AlertDialogCancel><AlertDialogAction onClick={async () => { if (confirm && (await run(saveMember({ action: confirm.action, id: confirm.m.id }), 'Uitgevoerd'))) reload(); setConfirm(null); }}>Bevestigen</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
