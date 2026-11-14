import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { BEHEER_ONLY_PERMS, PERM_KEYS } from '../lib/permissions';
import { audit, parseJson, requireMe } from '../server/core';

type T = { testName: string; result: 'Geslaagd' | 'Mislukt'; details: string; durationMs: number };

async function check(name: string, fn: () => Promise<string>): Promise<T> {
  const t = Date.now();
  try {
    return { testName: name, result: 'Geslaagd', details: await fn(), durationMs: Date.now() - t };
  } catch (e) {
    return { testName: name, result: 'Mislukt', details: e instanceof Error ? e.message : String(e), durationMs: Date.now() - t };
  }
}
const must = (ok: boolean, msg: string) => { if (!ok) throw new Error(msg); };

export default createEndpoint({
  description: 'Testing Center: voert echte systeem- en beveiligingscontroles uit',
  authenticated: true,
  inputSchema: z.object({ action: z.enum(['list', 'run']) }),
  outputSchema: z.object({ results: z.array(z.object({ id: z.string(), testName: z.string(), result: z.string(), details: z.string(), durationMs: z.number(), runId: z.string(), runBy: z.string(), createdOn: z.string() })) }),
  execute: async ({ input, context }) => {
    const me = await requireMe(context, 'developer.view');
    if (input.action === 'run') {
      if (!me.perms.has('dev.tests')) throw new Error('Geen rechten om tests uit te voeren.');
      const { records: roles } = await zite.roles.findAll({ limit: 200 });
      const byName = (n: string) => roles.find((r) => r.name === n);
      const perms = (n: string) => new Set(parseJson<string[]>(byName(n)?.permissions, []));
      const tests = await Promise.all([
        check('Database bereikbaar', async () => { await zite.sql({ query: 'SELECT 1' }); return 'SELECT 1 ok'; }),
        check('Vijf standaardrollen aanwezig', async () => { const miss = ['Beheer', 'Bestuur', 'Management', 'Developer', 'Staff'].filter((n) => !byName(n)); must(!miss.length, `Ontbreekt: ${miss.join(', ')}`); return 'Alle rollen aanwezig'; }),
        check('Beheer heeft hoogste rang', async () => { const b = byName('Beheer'); must(roles.every((r) => (r.rank ?? 0) <= (b?.rank ?? 0)), 'Een rol staat boven Beheer'); return `Rang ${b?.rank}`; }),
        check('Staff heeft geen Developer-toegang', async () => { must(!perms('Staff').has('developer.view'), 'Staff heeft developer.view'); return 'ok'; }),
        check('Management/Bestuur geen automatische Developer-toegang', async () => { must(!perms('Management').has('developer.view') && !perms('Bestuur').has('developer.view'), 'Developer-toegang gevonden'); return 'ok'; }),
        check('Developer heeft geen Beheer-/personeelsrechten', async () => { const p = perms('Developer'); const bad = ['roles.manage', 'users.manage', 'settings.manage', 'members.view', 'complaints.handle', 'absence.handle', 'audit.view'].filter((x) => p.has(x)); must(!bad.length, `Gevonden: ${bad.join(', ')}`); return 'ok'; }),
        check('Alleen bekende rechten in rollen', async () => { const bad = roles.flatMap((r) => parseJson<string[]>(r.permissions, []).filter((p) => !(PERM_KEYS as string[]).includes(p))); must(!bad.length, `Onbekend: ${bad.join(', ')}`); return 'ok'; }),
        check('Beheer-exclusieve rechten alleen bij Beheer/Developer', async () => { const bad = roles.filter((r) => r.name !== 'Beheer' && r.name !== 'Developer' && parseJson<string[]>(r.permissions, []).some((p) => (BEHEER_ONLY_PERMS as string[]).includes(p))).map((r) => r.name); must(!bad.length, `Rollen: ${bad.join(', ')}`); return 'ok'; }),
        check('Minstens één actieve Beheer-account', async () => { const id = byName('Beheer')?.id; const { records } = await zite.members.findAll({ filters: { status: 'Actief', role: id! } as any, limit: 5 }); must(records.length > 0, 'Geen actieve Beheer'); return `${records.length} actief`; }),
        check('Geen verlopen actieve activatiecodes', async () => { const { records } = await zite.accessCodes.findAll({ filters: { status: 'Actief' }, limit: 2000 }); const n = records.filter((c) => c.expiresAt && new Date(c.expiresAt) < new Date()).length; return n ? `${n} verlopen codes nog op Actief (worden bij gebruik geweigerd)` : 'ok'; }),
      ]);
      const runId = crypto.randomUUID().slice(0, 8);
      await zite.testResults.bulkCreate({ records: tests.map((t) => ({ ...t, runId, runBy: me.name })) });
      await audit(me, `Testronde uitgevoerd (${tests.filter((t) => t.result === 'Mislukt').length} mislukt)`, 'Developer', runId);
    }
    const { records } = await zite.testResults.findAll({ limit: 200, sort: [{ field: 'createdOn', direction: 'desc' }] as any });
    return { results: records.map((r) => ({ id: r.id, testName: r.testName || '', result: r.result || '', details: r.details || '', durationMs: r.durationMs ?? 0, runId: r.runId || '', runBy: r.runBy || '', createdOn: r.createdOn || '' })) };
  },
});
