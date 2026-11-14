import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Badge } from '@project/components/ui/badge';
import { Card, CardContent } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { Label } from '@project/components/ui/label';
import { cn } from '@project/components/lib/utils';
import { toast } from 'sonner';
import { errMsg } from '../lib/session';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25',
  red: 'bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/25',
  blue: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25',
  gray: 'bg-muted text-muted-foreground border-border',
  violet: 'bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/25',
};
const STATUS_TONE: Record<string, keyof typeof TONES> = {
  Actief: 'green', Goedgekeurd: 'green', Opgelost: 'green', Afgerond: 'green', Gebruikt: 'gray', Gepubliceerd: 'green', 'In dienst': 'green', Beschikbaar: 'green',
  Nieuw: 'blue', Open: 'blue', Ingediend: 'blue', Aangevraagd: 'blue', Concept: 'gray', Inwerktraject: 'blue',
  'In behandeling': 'amber', Bezig: 'amber', 'Wacht op informatie': 'amber', 'Aanvullende informatie nodig': 'amber', 'Correctie gevraagd': 'amber', 'Ter controle': 'violet', Doorgestuurd: 'violet', 'In bespreking': 'violet', Lopend: 'amber', Voorkeur: 'amber', Uitdiensttreding: 'amber',
  Afgewezen: 'red', Afgekeurd: 'red', Geblokkeerd: 'red', Ingetrokken: 'gray', Verlopen: 'gray', Geannuleerd: 'gray', Gesloten: 'gray', Gedeactiveerd: 'gray', Gearchiveerd: 'gray', 'Niet beschikbaar': 'red', 'Uit dienst': 'gray',
  Urgent: 'red', Hoog: 'amber', Normaal: 'blue', Laag: 'gray',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <Badge variant="outline" className={cn('whitespace-nowrap font-semibold', TONES[STATUS_TONE[status] || 'gray'], className)}>{status || '—'}</Badge>;
}

export function StatCard({ label, value, icon: Icon, hint, tone = 'primary' }: { label: string; value: ReactNode; icon: LucideIcon; hint?: string; tone?: 'primary' | 'amber' | 'red' | 'blue' }) {
  const t = { primary: 'bg-primary/10 text-primary', amber: 'bg-amber-500/12 text-amber-600', red: 'bg-red-500/12 text-red-600', blue: 'bg-sky-500/12 text-sky-600' }[tone];
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', t)}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-extrabold leading-tight">{value}</div>
          {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function Empty({ text = 'Nog niets te tonen', icon: Icon = Inbox }: { text?: string; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
      <Icon className="h-8 w-8 opacity-40" />
      {text}
    </div>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-2">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
}

export function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setData(await fn());
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { setLoading(true); reload(); }, [reload]);
  return { data, loading, reload, setData };
}

export async function run<T>(p: Promise<T>, success?: string) {
  try {
    const r = await p;
    if (success) toast.success(success);
    return r;
  } catch (e) {
    toast.error(errMsg(e));
    return undefined;
  }
}

export const selectCls = 'h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
