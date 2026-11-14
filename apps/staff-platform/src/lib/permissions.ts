export const PERMISSIONS = {
  'users.manage': 'Gebruikers beheren (aanmaken, blokkeren, verwijderen)',
  'roles.manage': 'Rollen en rechten beheren',
  'codes.manage': 'Toegangscodes beheren',
  'members.view': 'Medewerkersoverzicht en dossiers bekijken',
  'absence.handle': 'Afwezigheid en verlof behandelen',
  'complaints.handle': 'Klachten behandelen',
  'time.approve': 'Uren controleren en goedkeuren',
  'shifts.manage': 'Roosters maken en inroosteren',
  'tasks.assign': 'Taken toewijzen en controleren',
  'documents.manage': 'Documenten en kennisbank beheren',
  'announcements.manage': 'Mededelingen publiceren',
  'reviews.manage': 'Gesprekken, evaluaties en waarschuwingen registreren',
  'decisions.manage': 'Besluitenregister beheren',
  'reports.view': 'Rapportages bekijken en exporteren',
  'audit.view': 'Auditlogs bekijken en inzageverzoeken behandelen',
  'settings.manage': 'Systeeminstellingen, modules en onderhoud',
  'pages.manage': 'Pagina- en panelbeheer',
  'developer.view': 'Developer Panel openen (systeemmonitor, technische logs)',
  'dev.bugs': 'Developer: bugs registreren en beheren',
  'dev.tasks': 'Developer: technische taken beheren',
  'dev.tests': 'Developer: tests uitvoeren in Testing Center',
  'dev.docs': 'Developer: technische documentatie beheren',
  'support.handle': 'Supporttickets behandelen',
  'scope.all': 'Alle afdelingen inzien (anders alleen eigen afdeling)',
} as const;

export type Perm = keyof typeof PERMISSIONS;
export const PERM_KEYS = Object.keys(PERMISSIONS) as Perm[];

/** Rights only the Beheer role (rank 100) may hand out — via roles or individual overrides. */
export const BEHEER_ONLY_PERMS: Perm[] = ['roles.manage', 'settings.manage', 'pages.manage', 'developer.view', 'dev.bugs', 'dev.tasks', 'dev.tests', 'dev.docs'];
export const BEHEER_RANK = 100;

export const MODULES = {
  absence: 'Afwezigheid & verlof',
  complaints: 'Klachten',
  time: 'Urenregistratie',
  schedule: 'Roosters',
  tasks: 'Taken & projecten',
  documents: 'Documenten & kennisbank',
  messages: 'Berichten',
  announcements: 'Mededelingen',
  reviews: 'Gesprekken & evaluaties',
  decisions: 'Besluitenregister',
  support: 'Supporttickets',
} as const;
export type ModuleKey = keyof typeof MODULES;

export const AUDIT_CATEGORIES = ['Gebruikers', 'Rechten', 'Toegangscodes', 'Afwezigheid', 'Klachten', 'Uren', 'Roosters', 'Taken', 'Documenten', 'Communicatie', 'Gesprekken', 'Besluiten', 'Instellingen', 'Systeem', 'Support', 'Developer'] as const;

export const NOTIFICATION_TYPES = {
  absence: 'Afwezigheid & verlof',
  complaint: 'Klachten',
  time: 'Uren',
  schedule: 'Roosters & wijzigingen',
  task: 'Taken & deadlines',
  message: 'Berichten',
  document: 'Documenten',
  announcement: 'Mededelingen',
  audit: 'Auditverzoeken',
  account: 'Account',
  support: 'Supporttickets',
} as const;
