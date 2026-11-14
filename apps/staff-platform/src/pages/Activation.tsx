import { useState } from 'react';
import { activateAccount } from 'zitejs/api';
import { logout } from 'zitejs/auth';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { KeyRound, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { errMsg } from '../lib/session';
import { Field } from '../components/kit';

export default function Activation({ bootstrap, platformName, email, onDone }: { bootstrap: boolean; platformName: string; email: string; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootstrap && code.replace(/[^A-Z0-9]/gi, '').length < 12) return setErr('Een toegangscode heeft 12 tekens (XXXX-XXXX-XXXX).');
    if (bootstrap && name.trim().length < 2) return setErr('Vul je volledige naam in.');
    setBusy(true); setErr('');
    try { await activateAccount({ code, fullName: name }); toast.success('Account geactiveerd'); onDone(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-extrabold text-white"><Building2 className="h-6 w-6 text-sidebar-primary" />{platformName}</div>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight text-white">Het digitale hoofdkantoor<br />voor je hele team.</h2>
          <p className="mt-4 max-w-md text-sidebar-foreground/80">Roosters, uren, verlof, taken, documenten en communicatie — veilig op één plek.</p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Toegang alleen op uitnodiging · AVG-proof</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-extrabold">{bootstrap ? 'Platform inrichten' : 'Account activeren'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {bootstrap ? 'Je bent de eerste gebruiker en wordt de hoofdbeheerder (Beheer).' : <>Ingelogd als <b>{email}</b>. Voer de eenmalige toegangscode in die je van Beheer, Bestuur of Management hebt gekregen.</>}
            </p>
          </div>
          {bootstrap ? (
            <Field label="Volledige naam"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Voornaam Achternaam" /></Field>
          ) : (
            <Field label="Toegangscode"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" className="font-mono text-lg tracking-widest" autoFocus /></Field>
          )}
          {err && <p className="text-sm font-medium text-destructive">{err}</p>}
          <Button className="w-full" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{bootstrap ? 'Start als Beheer' : 'Activeren'}</Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => logout()}>Ander account gebruiken</Button>
        </form>
      </div>
    </div>
  );
}
