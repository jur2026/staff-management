import { useEffect, useState } from 'react';
import { settings } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Switch } from '@project/components/ui/switch';
import { AlertTriangle, Database, Loader2 } from 'lucide-react';
import { useSession } from '../../lib/session';
import { MODULES } from '../../lib/permissions';
import { PageHeader, Field, LoadingRows, useLoad, run } from '../../components/kit';

type S = { modules: Record<string, boolean>; maintenance: boolean; platformName: string };

export default function SettingsPage() {
  const { refresh } = useSession();
  const { data, loading } = useLoad(() => settings({ action: 'get' }) as Promise<S>);
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setS(data); }, [data]);
  const save = async () => { if (!s) return; setBusy(true); if (await run(settings({ action: 'save', ...s }), 'Instellingen opgeslagen')) await refresh(); setBusy(false); };
  if (loading || !s) return <LoadingRows rows={6} />;
  return (
    <div>
      <PageHeader title="Systeeminstellingen" description="Centraal configuratiecentrum: modules, onderhoudsmodus en platformidentiteit." actions={<Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Opslaan</Button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Modules & functies</CardTitle><CardDescription>Uitschakelen verbergt de module voor iedereen. Bestaande gegevens worden nooit verwijderd.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(MODULES).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm font-medium">{label}</span><Switch checked={s.modules[k] !== false} onCheckedChange={(v) => setS({ ...s, modules: { ...s.modules, [k]: v } })} /></div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Algemeen</CardTitle></CardHeader>
            <CardContent><Field label="Platformnaam"><Input value={s.platformName} onChange={(e) => setS({ ...s, platformName: e.target.value })} /></Field></CardContent>
          </Card>
          <Card className={s.maintenance ? 'border-amber-500/50' : ''}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" />Onderhoudsmodus</CardTitle><CardDescription>Alleen gebruikers met het recht “Systeeminstellingen” kunnen het platform nog gebruiken. Ook endpoints worden server-side geblokkeerd.</CardDescription></CardHeader>
            <CardContent><label className="flex items-center gap-3 text-sm"><Switch checked={s.maintenance} onCheckedChange={(v) => setS({ ...s, maintenance: v })} />{s.maintenance ? 'Onderhoud actief' : 'Platform normaal beschikbaar'}</label></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4" />Back-ups & herstel</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>De database maakt doorlopend back-ups met point-in-time herstel. Beheerders van de werkruimte kunnen een herstelpunt kiezen via het Backups-venster van de database.</p>
              <p>Gearchiveerde medewerkers, besluiten en gesloten klachten blijven bewaard in het archief; verwijderen gebeurt alleen bewust en wordt gelogd.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
