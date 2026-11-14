import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';
import { BEHEER_ONLY_PERMS, BEHEER_RANK, type Perm } from '../lib/permissions';

export const isBeheer = (me: Me) => me.rank >= BEHEER_RANK && me.perms.has('roles.manage');

/** Throws when `me` tries to hand out rights that only Beheer may grant. */
export function assertCanGrant(me: Me, perms: string[]) {
  if (isBeheer(me)) return;
  const blocked = perms.filter((p) => (BEHEER_ONLY_PERMS as string[]).includes(p));
  if (blocked.length) throw fail('FORBIDDEN', `Alleen Beheer mag deze rechten toekennen of intrekken: ${blocked.join(', ')}`);
}

/** Prevents removing/demoting the last active Beheer account. */
export async function assertNotLastBeheer(memberId: string) {
  const { records: roles } = await zite.roles.findAll({ limit: 200 });
  const beheerRoles = roles.filter((r) => (r.rank ?? 0) >= BEHEER_RANK).map((r) => r.id);
  const m = await zite.members.findOne({ id: memberId });
  if (!m || !beheerRoles.includes(first(m.role) || '')) return;
  const { records } = await zite.members.findAll({ filters: { status: 'Actief' }, limit: 2000 });
  const others = records.filter((x) => x.id !== memberId && beheerRoles.includes(first(x.role) || ''));
  if (!others.length) throw fail('FORBIDDEN', 'Dit is de laatste actieve Beheer-account en kan niet worden verwijderd, geblokkeerd of gedegradeerd.');
}

export const first = (v?: string | string[] | null) => (Array.isArray(v) ? v[0] : v || undefined) as string | undefined;
export const many = (v?: string | string[] | null): string[] => (Array.isArray(v) ? v : v ? [v] : []);

export type Me = {
  id: string;
  name: string;
  email: string;
  rank: number;
  roleId?: string;
  roleName: string;
  departmentId?: string;
  perms: Set<string>;
};

export const fail = (code: 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'UNAUTHORIZED' | 'CONFLICT', msg: string) =>
  new ZiteError({ code, message: msg, userFacingMessage: msg });

export function parseJson<T>(s: string | undefined | null, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function getSetting(key: string) {
  const r = await zite.settings.findOne({ filters: { key } });
  return r?.value;
}

export async function buildMe(member: { id: string; fullName?: string; email?: string; role?: string | string[]; department?: string | string[]; permissionOverrides?: string }): Promise<Me> {
  const roleId = first(member.role);
  const role = roleId ? await zite.roles.findOne({ id: roleId }) : undefined;
  const perms = new Set(parseJson<string[]>(role?.permissions, []));
  const ov = parseJson<{ grant?: string[]; deny?: string[] }>(member.permissionOverrides, {});
  (ov.grant || []).forEach((p) => perms.add(p));
  (ov.deny || []).forEach((p) => perms.delete(p));
  return {
    id: member.id,
    name: member.fullName || member.email || 'Onbekend',
    email: member.email || '',
    rank: role?.rank ?? 0,
    roleId,
    roleName: role?.name || 'Geen rol',
    departmentId: first(member.department),
    perms,
  };
}

export async function findMemberByUser(userId: string) {
  return zite.members.findOne({ filters: { user: userId } });
}

type Ctx = { user: { id: string } };

export async function requireMe(context: Ctx, perm?: Perm): Promise<Me> {
  const member = await findMemberByUser(context.user.id);
  if (!member) throw fail('FORBIDDEN', 'Je account is nog niet geactiveerd.');
  if (member.status !== 'Actief') throw fail('FORBIDDEN', `Je account is ${(member.status || 'niet actief').toLowerCase()}.`);
  const me = await buildMe(member);
  if ((await getSetting('maintenance')) === 'true' && !me.perms.has('settings.manage')) {
    throw fail('FORBIDDEN', 'Het platform is in onderhoud.');
  }
  if (perm && !me.perms.has(perm)) throw fail('FORBIDDEN', 'Je hebt geen rechten voor deze actie.');
  const last = member.lastActive ? new Date(member.lastActive).getTime() : 0;
  if (Date.now() - last > 5 * 60 * 1000) {
    await zite.members.update({ id: member.id, record: { lastActive: new Date().toISOString() } });
  }
  return me;
}

/** Member ids this person may manage. null = all. */
export async function scopeIds(me: Me): Promise<string[] | null> {
  if (me.perms.has('scope.all')) return null;
  if (!me.departmentId) return [me.id];
  const { records } = await zite.members.findAll({ filters: { department: me.departmentId }, limit: 2000, fields: ['id'] as any });
  return records.map((r) => r.id);
}

export async function assertInScope(me: Me, memberId?: string) {
  if (!memberId) return;
  const ids = await scopeIds(me);
  if (ids && !ids.includes(memberId)) throw fail('FORBIDDEN', 'Deze medewerker valt buiten je afdeling.');
}

export async function audit(me: Me | null, action: string, category: string, entity: string, details = '') {
  await zite.auditLogs.create({
    record: { action, category, actor: me?.name || 'Systeem', actorId: me?.id || '', entity, details },
  });
}

export async function notify(memberIds: string[], type: string, title: string, body: string, link = '') {
  const ids = [...new Set(memberIds.filter(Boolean))];
  if (!ids.length) return;
  const { records } = await zite.members.findAll({ filters: { id: { in: ids } } as any, limit: 2000 });
  const targets = records.filter((m) => m.status === 'Actief' && !parseJson<string[]>(m.notificationPreferences, []).includes(type));
  for (let i = 0; i < targets.length; i += 100) {
    await zite.notifications.bulkCreate({
      records: targets.slice(i, i + 100).map((m) => ({ title, body, member: [m.id], type, read: false, link })),
    });
  }
}

/** All active members having a permission (optionally limited to a department unless they have scope.all). */
export async function holdersOf(perm: Perm, departmentId?: string, excludeId?: string) {
  const { records: roles } = await zite.roles.findAll({ limit: 200 });
  const { records: members } = await zite.members.findAll({ filters: { status: 'Actief' }, limit: 2000 });
  const roleMap = new Map(roles.map((r) => [r.id, new Set(parseJson<string[]>(r.permissions, []))]));
  return members
    .filter((m) => {
      const p = new Set(roleMap.get(first(m.role) || '') || []);
      const ov = parseJson<{ grant?: string[]; deny?: string[] }>(m.permissionOverrides, {});
      (ov.grant || []).forEach((x) => p.add(x));
      (ov.deny || []).forEach((x) => p.delete(x));
      if (!p.has(perm) || m.id === excludeId) return false;
      if (departmentId && !p.has('scope.all') && first(m.department) !== departmentId) return false;
      return true;
    })
    .map((m) => m.id);
}

export async function memberNames(ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map<string, string>();
  const { records } = await zite.members.findAll({ filters: { id: { in: uniq } } as any, limit: 2000, fields: ['id', 'fullName'] as any });
  return new Map(records.map((r) => [r.id, r.fullName || '—']));
}
