import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { getMe, type GetMeOutputType } from 'zitejs/api';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { Loader2, ShieldOff, Wrench } from 'lucide-react';
import { SessionContext, type ActiveMe } from './lib/session';
import Activation from './pages/Activation';
import Layout from './components/Layout';
import AppRoutes from './AppRoutes';

if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');

function Splash({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-background p-6">{children}</div>;
}

export default function App() {
  const { user, isLoading } = useAuth();
  const [me, setMe] = useState<GetMeOutputType | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { if (!isLoading && !user) loginWithRedirect(); }, [isLoading, user]);

  const refresh = useCallback(async () => {
    try { setMe(await getMe({})); setError(''); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { if (user) refresh(); }, [user, refresh]);
  useEffect(() => {
    if (!user) return;
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [user, refresh]);

  if (isLoading || !user || (!me && !error)) return <Splash><Loader2 className="h-8 w-8 animate-spin text-primary" /></Splash>;
  if (error && !me) return <Splash><div className="text-center"><p className="mb-4 text-sm text-muted-foreground">{error}</p><Button onClick={refresh}>Opnieuw proberen</Button></div></Splash>;
  if (!me) return null;

  if (me.state === 'unactivated') return <><Activation bootstrap={me.bootstrap} platformName={me.platformName} email={user.email} onDone={refresh} /><Toaster /></>;
  if (me.state === 'blocked' || me.state === 'maintenance') {
    const blocked = me.state === 'blocked';
    return (
      <Splash>
        <div className="max-w-sm text-center">
          {blocked ? <ShieldOff className="mx-auto mb-4 h-10 w-10 text-destructive" /> : <Wrench className="mx-auto mb-4 h-10 w-10 text-amber-500" />}
          <h1 className="text-xl font-bold">{blocked ? `Account ${me.status.toLowerCase()}` : 'Onderhoud'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{blocked ? 'Je hebt momenteel geen toegang. Neem contact op met Beheer voor herstel van je account.' : 'Het platform wordt bijgewerkt. Probeer het later opnieuw.'}</p>
          <Button variant="outline" className="mt-6" onClick={() => logout()}>Uitloggen</Button>
        </div>
      </Splash>
    );
  }

  return (
    <SessionContext.Provider value={{ data: me as ActiveMe, refresh }}>
      <BrowserRouter>
        <Layout>
          <AppRoutes />
        </Layout>
      </BrowserRouter>
      <Toaster richColors />
    </SessionContext.Provider>
  );
}
