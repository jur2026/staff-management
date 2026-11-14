import { useState, type ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { logout } from 'zitejs/auth';
import { Button } from '@project/components/ui/button';
import { Sheet, SheetContent } from '@project/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@project/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@project/components/ui/dropdown-menu';
import { cn } from '@project/components/lib/utils';
import { Bell, Building2, ChevronsLeft, ChevronsRight, FileText, LogOut, Menu, Moon, Sun, User, Shield, Landmark, Briefcase, Wrench } from 'lucide-react';
import { useSession, initials } from '../lib/session';
import { STAFF_NAV, PANELS, DEV_NAV, type NavItem } from '../lib/nav';

const PANEL_ICONS = { beheer: Shield, bestuur: Landmark, management: Briefcase };

function NavGroup({ title, items, collapsed, onNav }: { title: string; items: NavItem[]; collapsed: boolean; onNav?: () => void }) {
  if (!items.length) return null;
  return (
    <div className="mb-4">
      {!collapsed && <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/50">{title}</div>}
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.to === '/'} onClick={onNav} title={i.label}
          className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-sidebar-accent text-white' : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white', collapsed && 'justify-center px-0')}>
          {({ isActive }) => (<><i.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-sidebar-primary')} />{!collapsed && <span className="truncate">{i.label}</span>}</>)}
        </NavLink>
      ))}
    </div>
  );
}

function SidebarBody({ collapsed, onNav }: { collapsed: boolean; onNav?: () => void }) {
  const { data, me, canAny, can, moduleOn } = useSession();
  const staff = STAFF_NAV.filter((n) => !n.module || moduleOn(n.module));
  const panels: NavItem[] = (Object.keys(PANELS) as (keyof typeof PANELS)[])
    .filter((k) => canAny(...PANELS[k].access))
    .map((k) => ({ to: `/${k}`, label: `Panel ${PANELS[k].label}`, icon: PANEL_ICONS[k] }));
  const pages: NavItem[] = data.pages.map((p) => ({ to: `/pagina/${p.id}`, label: p.title, icon: FileText }));
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center gap-2 px-4 font-extrabold text-white', collapsed && 'justify-center px-0')}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Building2 className="h-4 w-4" /></div>
        {!collapsed && <span className="truncate">{data.platformName}</span>}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {panels.length > 0 && <NavGroup title="Panels" items={panels} collapsed={collapsed} onNav={onNav} />}
        {can('developer.view') && <NavGroup title="Techniek" items={[DEV_NAV]} collapsed={collapsed} onNav={onNav} />}
        <NavGroup title="Mijn werkplek" items={staff} collapsed={collapsed} onNav={onNav} />
        <NavGroup title="Informatie" items={pages} collapsed={collapsed} onNav={onNav} />
      </nav>
      {!collapsed && (
        <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/70">
          <div className="font-semibold text-white">{me.name}</div>
          <div>{me.roleName}{me.department ? ` · ${me.department}` : ''}</div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { data, me } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const loc = useLocation();
  const toggleTheme = () => {
    const d = !dark;
    document.documentElement.classList.toggle('dark', d);
    localStorage.setItem('theme', d ? 'dark' : 'light');
    setDark(d);
  };
  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 bg-sidebar transition-all lg:block', collapsed ? 'w-[68px]' : 'w-64')}>
        <SidebarBody collapsed={collapsed} />
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0"><SidebarBody collapsed={false} onNav={() => setMobile(false)} /></SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)}><Menu className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}</Button>
          {data.maintenance && <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300"><Wrench className="h-3 w-3" />Onderhoudsmodus actief</span>}
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Thema wisselen">{dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button>
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link to="/meldingen"><Bell className="h-5 w-5" />{data.unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">{data.unread > 99 ? '99+' : data.unread}</span>}</Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
                <Avatar className="h-9 w-9"><AvatarImage src={me.avatar} /><AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">{initials(me.name)}</AvatarFallback></Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel><div className="font-semibold">{me.name}</div><div className="text-xs font-normal text-muted-foreground">{me.email}</div></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/profiel"><User className="mr-2 h-4 w-4" />Mijn profiel</Link></DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />Uitloggen</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main key={loc.pathname.split('/')[1]} className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
