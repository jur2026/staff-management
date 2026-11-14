import { useNavigate } from 'react-router-dom';
import { notifications } from 'zitejs/api';
import { Card, CardContent } from '@project/components/ui/card';
import { Button } from '@project/components/ui/button';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { cn } from '@project/components/lib/utils';
import { useSession, fmtDateTime } from '../lib/session';
import { NOTIFICATION_TYPES } from '../lib/permissions';
import { PageHeader, Empty, LoadingRows, useLoad, run } from '../components/kit';

type N = { id: string; title: string; body: string; type: string; read: boolean; link: string; createdOn: string };

export default function Notifications() {
  const { refresh } = useSession();
  const nav = useNavigate();
  const { data, loading, reload, setData } = useLoad(() => notifications({ action: 'list' }));
  const items = (data && 'items' in data ? data.items : []) as N[];
  const open = async (n: N) => {
    if (!n.read) { setData({ items: items.map((x) => (x.id === n.id ? { ...x, read: true } : x)) } as typeof data); await notifications({ action: 'read', id: n.id }).catch(() => {}); refresh(); }
    if (n.link) nav(n.link);
  };
  return (
    <div>
      <PageHeader title="Notificaties" description="Alle meldingen over aanvragen, roosters, taken, berichten en meer. Voorkeuren stel je in via je profiel."
        actions={<Button variant="outline" onClick={async () => { if (await run(notifications({ action: 'readAll' }), 'Alles gelezen')) { reload(); refresh(); } }}><CheckCheck className="mr-2 h-4 w-4" />Alles gelezen</Button>} />
      <Card><CardContent className="p-0">
        {loading ? <div className="p-4"><LoadingRows /></div> : !items.length ? <Empty text="Geen notificaties" icon={Bell} /> : (
          <div className="divide-y">
            {items.map((n) => (
              <div key={n.id} className={cn('flex items-start gap-3 p-4 hover:bg-muted/40', !n.read && 'bg-primary/[0.04]')}>
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
                <button className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                  <div className={cn('text-sm', !n.read && 'font-bold')}>{n.title}</div>
                  <div className="text-sm text-muted-foreground">{n.body}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{NOTIFICATION_TYPES[n.type as keyof typeof NOTIFICATION_TYPES] || n.type} · {fmtDateTime(n.createdOn)}</div>
                </button>
                <Button size="icon" variant="ghost" onClick={async () => { if (await run(notifications({ action: 'delete', id: n.id }))) { reload(); refresh(); } }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
