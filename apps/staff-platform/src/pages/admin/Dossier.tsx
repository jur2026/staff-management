import { getMemberDossier } from 'zitejs/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@project/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@project/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@project/components/ui/avatar';
import { Lock } from 'lucide-react';
import { fmtDate, fmtDateTime, fmtTime, initials, workedHours } from '../../lib/session';
import { StatusBadge, LoadingRows, Empty, useLoad } from '../../components/kit';

function Row({ a, b, c }: { a: React.ReactNode; b?: React.ReactNode; c?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0"><div className="min-w-0 truncate">{a}</div><div className="shrink-0 text-xs text-muted-foreground">{b}</div>{c}</div>;
}

export default function Dossier({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = useLoad(() => getMemberDossier({ id }), [id]);
  const m = data?.member;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {loading || !data || !m ? <LoadingRows /> : (
          <div className="space-y-5">
            <SheetHeader><SheetTitle>Personeelsdossier</SheetTitle></SheetHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16"><AvatarImage src={m.avatar || ''} /><AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">{initials(m.fullName || '')}</AvatarFallback></Avatar>
              <div>
                <div className="text-xl font-extrabold">{m.fullName}</div>
                <div className="text-sm text-muted-foreground">{m.jobTitle || '—'} · {m.email}</div>
                <div className="mt-1 flex gap-2"><StatusBadge status={m.status || ''} />{m.employmentStatus && <StatusBadge status={m.employmentStatus} />}{!m.activated && <StatusBadge status="Niet geactiveerd" />}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/60 p-4 text-sm sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">In dienst sinds</div><b>{fmtDate(m.startDate)}</b></div>
              <div><div className="text-xs text-muted-foreground">Laatst actief</div><b>{fmtDateTime(m.lastActive)}</b></div>
              <div><div className="text-xs text-muted-foreground">Uren (recent)</div><b>{data.hours}</b></div>
              <div><div className="text-xs text-muted-foreground">Telefoon</div><b>{m.phone || '—'}</b></div>
            </div>
            <Tabs defaultValue="uren">
              <TabsList className="flex-wrap"><TabsTrigger value="uren">Uren</TabsTrigger><TabsTrigger value="rooster">Rooster</TabsTrigger><TabsTrigger value="afwezig">Afwezigheid</TabsTrigger><TabsTrigger value="taken">Taken</TabsTrigger><TabsTrigger value="gesprekken">Gesprekken</TabsTrigger><TabsTrigger value="klachten">Klachten</TabsTrigger><TabsTrigger value="activiteit">Activiteit</TabsTrigger></TabsList>
              <TabsContent value="uren">{!data.time.length ? <Empty /> : data.time.map((t) => <Row key={t.id} a={<>{fmtDate(t.workDate)} · {t.activity}</>} b={`${fmtTime(t.start)}–${fmtTime(t.end)} · ${workedHours(t.start, t.end, t.breakMinutes || 0).toFixed(1)}u`} c={<StatusBadge status={t.status || ''} />} />)}</TabsContent>
              <TabsContent value="rooster">{!data.shifts.length ? <Empty text="Geen komende diensten" /> : data.shifts.map((s) => <Row key={s.id} a={s.title} b={`${fmtDate(s.start)} ${fmtTime(s.start)}–${fmtTime(s.end)}`} />)}</TabsContent>
              <TabsContent value="afwezig">{!data.absences.length ? <Empty /> : data.absences.map((a) => <Row key={a.id} a={a.category} b={`${fmtDate(a.startDate)} – ${fmtDate(a.endDate)}`} c={<StatusBadge status={a.status || ''} />} />)}</TabsContent>
              <TabsContent value="taken">{!data.tasks.length ? <Empty /> : data.tasks.map((t) => <Row key={t.id} a={t.title} b={fmtDate(t.dueDate)} c={<StatusBadge status={t.status || ''} />} />)}</TabsContent>
              <TabsContent value="gesprekken">{!data.reviews.length ? <Empty text="Geen registraties of geen toegang" /> : data.reviews.map((r: { id: string; title: string; type: string; date: string; confidential: boolean }) => <Row key={r.id} a={<>{r.confidential && <Lock className="mr-1 inline h-3 w-3 text-amber-500" />}{r.title}</>} b={`${r.type} · ${fmtDate(r.date)}`} />)}</TabsContent>
              <TabsContent value="klachten"><p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Alleen zichtbaar voor bevoegde klachtbehandelaars.</p>{!data.complaints.length ? <Empty /> : data.complaints.map((c) => <Row key={c.id} a={`#${c.number} ${c.subject}`} c={<StatusBadge status={c.status || ''} />} />)}</TabsContent>
              <TabsContent value="activiteit">{!data.activity.length ? <Empty text="Geen activiteit of geen toegang tot auditlogs" /> : data.activity.map((l: { id: string; action: string; category: string; createdOn: string }) => <Row key={l.id} a={l.action} b={`${l.category} · ${fmtDateTime(l.createdOn)}`} />)}</TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
