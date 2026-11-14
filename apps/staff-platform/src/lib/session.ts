import { createContext, useContext } from 'react';
import type { GetMeOutputType } from 'zitejs/api';
import type { Perm, ModuleKey } from './permissions';

export type ActiveMe = Extract<GetMeOutputType, { state: 'active' }>;

export const SessionContext = createContext<{ data: ActiveMe; refresh: () => Promise<void> } | null>(null);

export function useSession() {
  const s = useContext(SessionContext)!;
  const perms = new Set(s.data.me.perms);
  return {
    ...s,
    me: s.data.me,
    can: (p: Perm) => perms.has(p),
    canAny: (...p: Perm[]) => p.some((x) => perms.has(x)),
    moduleOn: (m: ModuleKey) => s.data.modules[m] !== false,
  };
}

export const fmtDate = (s?: string) => (s ? new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (s?: string) => (s ? new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtTime = (s?: string) => (s ? new Date(s).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '—');
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
export const workedHours = (start?: string, end?: string, br = 0) => (start && end ? Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 3600000 - br / 60) : 0);
export const errMsg = (e: unknown) => (e as { userFacingMessage?: string })?.userFacingMessage || (e as Error)?.message || 'Er ging iets mis';
export const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('');

export function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.map(esc).join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
}
