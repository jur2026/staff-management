import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { audit, fail, parseJson, requireMe } from '../server/core';

async function setSetting(key: string, value: string) {
  await zite.settings.bulkCreate({ records: [{ key, value }], matchOn: ['key'] });
}

export default createEndpoint({
  description: 'Systeeminstellingen (modules, onderhoudsmodus, platformnaam) en pagina-/panelbeheer',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['get', 'save', 'pages', 'page', 'savePage', 'deletePage', 'duplicatePage', 'restorePage']),
    modules: z.record(z.boolean()).optional(),
    maintenance: z.boolean().optional(),
    platformName: z.string().min(2).optional(),
    id: z.string().optional(),
    versionIndex: z.number().optional(),
    page: z.object({ title: z.string().min(2), content: z.string(), minRank: z.number().min(0).max(100), published: z.boolean(), sortOrder: z.number() }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    if (input.action === 'page') {
      const me = await requireMe(context);
      const p = await zite.pages.findOne({ id: input.id! });
      if (!p || ((!p.published || (p.minRank ?? 0) > me.rank) && !me.perms.has('pages.manage'))) throw fail('NOT_FOUND', 'Pagina niet gevonden.');
      return { id: p.id, title: p.title || '', content: p.content || '' };
    }
    if (input.action === 'get' || input.action === 'save') {
      const me = await requireMe(context, 'settings.manage');
      if (input.action === 'save') {
        if (input.modules) await setSetting('modules', JSON.stringify(input.modules));
        if (input.maintenance !== undefined) await setSetting('maintenance', String(input.maintenance));
        if (input.platformName) await setSetting('platformName', input.platformName);
        await audit(me, 'Systeeminstellingen gewijzigd', 'Instellingen', 'settings', JSON.stringify({ modules: input.modules, maintenance: input.maintenance, platformName: input.platformName }));
      }
      const { records } = await zite.settings.findAll({ limit: 100 });
      const get = (k: string) => records.find((r) => r.key === k)?.value;
      return { modules: parseJson<Record<string, boolean>>(get('modules'), {}), maintenance: get('maintenance') === 'true', platformName: get('platformName') || 'Staff HQ' };
    }
    const me = await requireMe(context, 'pages.manage');
    if (input.action === 'pages') {
      const { records } = await zite.pages.findAll({ sort: [{ field: 'sortOrder', direction: 'asc' }], limit: 200 });
      return { items: records.map((p) => ({ id: p.id, title: p.title || '', content: p.content || '', minRank: p.minRank ?? 0, published: !!p.published, sortOrder: p.sortOrder ?? 0, updatedBy: p.updatedBy || '', history: parseJson<{ title: string; content: string; savedAt: string; by: string }[]>(p.history, []) })) };
    }
    if (input.action === 'savePage') {
      const d = input.page!;
      if (input.id) {
        const p = await zite.pages.findOne({ id: input.id });
        if (!p) throw fail('NOT_FOUND', 'Pagina niet gevonden.');
        const hist = parseJson<{ title: string; content: string; savedAt: string; by: string }[]>(p.history, []);
        hist.unshift({ title: p.title || '', content: p.content || '', savedAt: new Date().toISOString(), by: p.updatedBy || '' });
        await zite.pages.update({ id: p.id, record: { ...d, history: JSON.stringify(hist.slice(0, 20)), updatedBy: me.name } });
        await audit(me, `Pagina bijgewerkt: ${d.title}`, 'Instellingen', p.id);
      } else {
        const p = await zite.pages.create({ record: { ...d, history: '[]', updatedBy: me.name } });
        await audit(me, `Pagina aangemaakt: ${d.title}`, 'Instellingen', p.id);
      }
      return { success: true };
    }
    const p = await zite.pages.findOne({ id: input.id! });
    if (!p) throw fail('NOT_FOUND', 'Pagina niet gevonden.');
    if (input.action === 'deletePage') {
      await zite.pages.delete({ id: p.id });
      await audit(me, `Pagina verwijderd: ${p.title}`, 'Instellingen', p.id);
    } else if (input.action === 'duplicatePage') {
      await zite.pages.create({ record: { title: `${p.title} (kopie)`, content: p.content || '', minRank: p.minRank ?? 0, published: false, sortOrder: (p.sortOrder ?? 0) + 1, history: '[]', updatedBy: me.name } });
      await audit(me, `Pagina gedupliceerd: ${p.title}`, 'Instellingen', p.id);
    } else {
      const hist = parseJson<{ title: string; content: string; savedAt: string; by: string }[]>(p.history, []);
      const v = hist[input.versionIndex ?? -1];
      if (!v) throw fail('BAD_REQUEST', 'Versie niet gevonden.');
      hist.unshift({ title: p.title || '', content: p.content || '', savedAt: new Date().toISOString(), by: p.updatedBy || '' });
      await zite.pages.update({ id: p.id, record: { title: v.title, content: v.content, history: JSON.stringify(hist.slice(0, 20)), updatedBy: me.name } });
      await audit(me, `Pagina hersteld naar versie van ${v.savedAt}`, 'Instellingen', p.id);
    }
    return { success: true };
  },
});
