import {
  LayoutDashboard, CalendarOff, MessageSquareWarning, Clock, CalendarDays, ListChecks, BookOpen, Megaphone, MessagesSquare, Bell, GraduationCap, ScrollText, User,
  Users, UserCog, ShieldCheck, KeyRound, Building, Gavel, BarChart3, Settings, PanelsTopLeft, CalendarCheck, Handshake, FileText, Code2, LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey, Perm } from './permissions';

export type NavItem = { to: string; label: string; icon: LucideIcon; module?: ModuleKey };

export const STAFF_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/rooster', label: 'Mijn rooster', icon: CalendarDays, module: 'schedule' },
  { to: '/uren', label: 'Urenregistratie', icon: Clock, module: 'time' },
  { to: '/afwezigheid', label: 'Afwezigheid & verlof', icon: CalendarOff, module: 'absence' },
  { to: '/taken', label: 'Taken & projecten', icon: ListChecks, module: 'tasks' },
  { to: '/berichten', label: 'Berichten', icon: MessagesSquare, module: 'messages' },
  { to: '/mededelingen', label: 'Mededelingen', icon: Megaphone, module: 'announcements' },
  { to: '/documenten', label: 'Documenten & kennisbank', icon: BookOpen, module: 'documents' },
  { to: '/klachten', label: 'Klachten', icon: MessageSquareWarning, module: 'complaints' },
  { to: '/ontwikkeling', label: 'Ontwikkeling & gesprekken', icon: GraduationCap, module: 'reviews' },
  { to: '/audit', label: 'Auditlogs', icon: ScrollText },
  { to: '/support', label: 'Support', icon: LifeBuoy, module: 'support' },
  { to: '/meldingen', label: 'Notificaties', icon: Bell },
  { to: '/profiel', label: 'Mijn profiel', icon: User },
];

export type SectionKey =
  | 'dashboard' | 'gebruikers' | 'personeel' | 'rollen' | 'codes' | 'afdelingen' | 'afwezigheid' | 'klachten' | 'uren' | 'rooster'
  | 'beschikbaarheid' | 'taken' | 'gesprekken' | 'besluiten' | 'documenten' | 'mededelingen' | 'rapportages' | 'audit' | 'instellingen' | 'paginas';

export const SECTIONS: Record<SectionKey, { label: string; icon: LucideIcon; perms: Perm[]; module?: ModuleKey }> = {
  dashboard: { label: 'Dashboard', icon: LayoutDashboard, perms: ['reports.view'] },
  gebruikers: { label: 'Gebruikersbeheer', icon: UserCog, perms: ['users.manage'] },
  personeel: { label: 'Medewerkers', icon: Users, perms: ['members.view'] },
  rollen: { label: 'Rollen & rechten', icon: ShieldCheck, perms: ['roles.manage'] },
  codes: { label: 'Toegangscodes', icon: KeyRound, perms: ['codes.manage'] },
  afdelingen: { label: 'Afdelingen', icon: Building, perms: ['users.manage'] },
  afwezigheid: { label: 'Afwezigheid & verlof', icon: CalendarOff, perms: ['absence.handle'], module: 'absence' },
  klachten: { label: 'Klachtenbehandeling', icon: MessageSquareWarning, perms: ['complaints.handle'], module: 'complaints' },
  uren: { label: 'Urencontrole', icon: Clock, perms: ['time.approve'], module: 'time' },
  rooster: { label: 'Roosterplanner', icon: CalendarDays, perms: ['shifts.manage'], module: 'schedule' },
  beschikbaarheid: { label: 'Beschikbaarheid & ruilen', icon: CalendarCheck, perms: ['shifts.manage'], module: 'schedule' },
  taken: { label: 'Takenverdeling', icon: ListChecks, perms: ['tasks.assign'], module: 'tasks' },
  gesprekken: { label: 'Gesprekken & evaluaties', icon: Handshake, perms: ['reviews.manage'], module: 'reviews' },
  besluiten: { label: 'Besluitenregister', icon: Gavel, perms: ['decisions.manage'], module: 'decisions' },
  documenten: { label: 'Documentenbeheer', icon: FileText, perms: ['documents.manage'], module: 'documents' },
  mededelingen: { label: 'Mededelingen', icon: Megaphone, perms: ['announcements.manage'], module: 'announcements' },
  rapportages: { label: 'Rapportages & exports', icon: BarChart3, perms: ['reports.view'] },
  audit: { label: 'Auditlogs & verzoeken', icon: ScrollText, perms: ['audit.view'] },
  instellingen: { label: 'Systeeminstellingen', icon: Settings, perms: ['settings.manage'] },
  paginas: { label: 'Pagina- & panelbeheer', icon: PanelsTopLeft, perms: ['pages.manage'] },
};

export const PANELS = {
  beheer: { label: 'Beheer', access: ['roles.manage'] as Perm[], sections: ['dashboard', 'gebruikers', 'rollen', 'codes', 'afdelingen', 'afwezigheid', 'klachten', 'uren', 'rooster', 'beschikbaarheid', 'taken', 'gesprekken', 'besluiten', 'documenten', 'mededelingen', 'rapportages', 'audit', 'paginas', 'instellingen'] as SectionKey[] },
  bestuur: { label: 'Bestuur', access: ['decisions.manage'] as Perm[], sections: ['dashboard', 'personeel', 'codes', 'afwezigheid', 'klachten', 'uren', 'rooster', 'beschikbaarheid', 'taken', 'gesprekken', 'besluiten', 'documenten', 'mededelingen', 'rapportages', 'audit'] as SectionKey[] },
  management: { label: 'Management', access: ['absence.handle', 'time.approve', 'shifts.manage', 'tasks.assign'] as Perm[], sections: ['dashboard', 'personeel', 'afwezigheid', 'klachten', 'uren', 'rooster', 'beschikbaarheid', 'taken', 'gesprekken', 'mededelingen', 'rapportages', 'audit'] as SectionKey[] },
};
export type PanelKey = keyof typeof PANELS;

export const DEV_NAV: NavItem = { to: '/developer', label: 'Developer Panel', icon: Code2 };
