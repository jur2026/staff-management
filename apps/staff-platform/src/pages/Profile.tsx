import { useState } from 'react';
import { updateProfile } from 'zitejs/api';
import { useUpload } from 'zitejs/upload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { Switch } from '@project/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@project/components/ui/avatar';
import { Loader2, Camera } from 'lucide-react';
import { useSession, initials } from '../lib/session';
import { NOTIFICATION_TYPES } from '../lib/permissions';
import { PageHeader, Field, run } from '../components/kit';

export default function Profile() {
  const { me, refresh } = useSession();
  const { upload, isUploading } = useUpload();
  const [f, setF] = useState({ fullName: me.name, username: me.username, phone: me.phone, bio: me.bio, avatar: me.avatar });
  const [off, setOff] = useState<string[]>(me.notificationPreferences);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (f.fullName.trim().length < 2) return setErr('Naam is verplicht');
    if (f.phone && !/^[+\d\s()-]{6,}$/.test(f.phone)) return setErr('Ongeldig telefoonnummer');
    setErr(''); setBusy(true);
    if (await run(updateProfile({ ...f, disabledNotifications: off }), 'Profiel opgeslagen')) await refresh();
    setBusy(false);
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr('Kies een afbeelding');
    const r = await run(upload(file));
    if (r) setF({ ...f, avatar: r.url });
  };

  return (
    <div>
      <PageHeader title="Mijn profiel" description="Beheer je gegevens en notificatievoorkeuren." actions={<Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Opslaan</Button>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Persoonlijke gegevens</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20"><AvatarImage src={f.avatar} /><AvatarFallback className="bg-primary text-xl font-bold text-primary-foreground">{initials(f.fullName)}</AvatarFallback></Avatar>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={isUploading} />
                <span className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}Profielfoto wijzigen</span>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Volledige naam"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
              <Field label="Gebruikersnaam"><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></Field>
              <Field label="Telefoon"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
              <Field label="E-mail"><Input value={me.email} disabled /></Field>
            </div>
            <Field label="Over mij"><Textarea rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <div className="grid gap-3 rounded-lg bg-muted/60 p-4 text-sm sm:grid-cols-3">
              <div><div className="text-xs text-muted-foreground">Rol</div><div className="font-semibold">{me.roleName}</div></div>
              <div><div className="text-xs text-muted-foreground">Functie</div><div className="font-semibold">{me.jobTitle || '—'}</div></div>
              <div><div className="text-xs text-muted-foreground">Afdeling</div><div className="font-semibold">{me.department || '—'}</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Notificaties</CardTitle><CardDescription>Kies waarover je meldingen ontvangt.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(NOTIFICATION_TYPES).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="text-sm">{label}</span>
                <Switch checked={!off.includes(k)} onCheckedChange={(v) => setOff(v ? off.filter((x) => x !== k) : [...off, k])} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
