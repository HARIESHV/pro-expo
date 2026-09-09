import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Search,
  MessageSquare,
  FileText,
  Home,
  BarChart3,
  BookOpen,
  AlertTriangle,
  Bot,
  History,
  Network,
  Shield,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
  Sparkles,
  Users,
  ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { cn } from '../utils/cn';
import { hasPermission as hasPermissionUtil, Permission } from '../auth/rbac';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { BrandLockup } from './BrandLockup';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  permission?: Permission;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const isAdminUser = (roles?: string[]) => !!roles && roles.some(r=> ['admin','super_admin'].includes(r.toLowerCase()));

const groups: NavGroup[] = [
  {
    title: 'Dashboards',
    items: [
      { to: '/dashboard', icon: Home, label: 'Executive Dashboard', permission: 'dashboards.executive' as Permission },
      { to: '/analytics', icon: BarChart3, label: 'Analytics', permission: 'dashboards.analytics' as Permission },
      { to: '/reports', icon: BookOpen, label: 'Reports', permission: 'reports.view' as Permission },
      { to: '/risks', icon: AlertTriangle, label: 'Decision Intelligence', permission: 'dashboards.risks' as Permission },
      { to: '/business-intelligence', icon: TrendingUp, label: 'Business Intelligence', permission: 'dashboards.bi' as Permission },
    ],
  },
  {
    title: 'My Reports',
    items: [
      { to: '/my-reports', icon: ClipboardCheck, label: 'My Reports' },
    ],
  },
  {
    title: 'Data Sources',
    items: [
      { to: '/documents', icon: FileText, label: 'Documents', permission: 'dashboards.documents' as Permission },
      { to: '/knowledge-graph', icon: Network, label: 'Knowledge Graph', permission: 'dashboards.knowledge_graph' as Permission },
      { to: '/evaluate-graph', icon: Shield, label: 'Evaluate Graph', permission: 'dashboards.evaluate_graph' as Permission },
      { to: '/knowledge-search', icon: Search, label: 'Knowledge Search' },
    ],
  },
  {
    title: 'AI Insights',
    items: [
      { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
      { to: '/agents', icon: Bot, label: 'AI Agents' },
      { to: '/search-home', icon: Search, label: 'Universal Search', permission: 'universal_search' as Permission },
      { to: '/query-history', icon: History, label: 'Query History' },
    ],
  },
];

// Sections hidden from the ADMIN sidebar ONLY. Normal users keep full access.
// 'My Reports' must remain visible for admin users per requirements.
const ADMIN_HIDDEN_GROUPS = new Set(['Dashboards', 'Data Sources', 'AI Insights']);

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onSearch: () => void;
  onNavigate?: () => void;
}

const railBtn =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sidebar-icon transition-all duration-150 hover:bg-sidebar-hover-bg hover:text-sidebar-icon-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95';

export function Sidebar({ collapsed, onToggle, onSearch, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const hasPermission = (permission?: Permission): boolean => {
    if (!permission) return true;
    return hasPermissionUtil(user?.permissions, permission);
  };

  const initial = (user?.displayName || user?.email || 'H').trim().charAt(0).toUpperCase() || 'H';
  const openAccountMenu = () => setMenuOpen((v) => !v);

  // ── Collapsed (icon-only) nav item ───────────────────────────────
  const renderItemCollapsed = (item: NavItem) => {
    const link = (
      <NavLink
        to={item.to}
        onClick={onNavigate}
        aria-label={item.label}
        title={item.label}
        className={({ isActive }) =>
          cn(
            'relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150',
            isActive
              ? 'bg-sidebar-active-bg text-sidebar-icon-active'
              : 'text-sidebar-icon hover:bg-sidebar-hover-bg hover:text-sidebar-icon-hover',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-orange-500" />
            )}
            <item.icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </>
        )}
      </NavLink>
    );
    return (
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  // ── Expanded (full) nav item ─────────────────────────────────────
  const renderItemExpanded = (item: NavItem) => (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      title={item.label}
className={({ isActive }) =>
          cn(
            'group relative flex w-full items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-[13.5px] font-medium transition-colors duration-150',
            isActive
              ? 'bg-sidebar-active-bg text-sidebar-text-strong'
              : 'text-sidebar-text hover:bg-sidebar-hover-bg hover:text-sidebar-text-hover',
          )
        }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-orange-500" />
          )}
          <item.icon className="h-[20px] w-[20px] shrink-0" strokeWidth={1.8} />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <div
      ref={menuRef}
      className={cn(
        'relative flex h-full flex-col border-r border-sidebar-border bg-sidebar-bg transition-[width] duration-200',
        collapsed ? 'w-full items-center' : 'w-full'
      )}
    >
      {/* ── Top: brand + quick action + profile ─────────────────────── */}
      <div className={cn('flex shrink-0 flex-col', collapsed ? 'items-center gap-2 pt-4' : 'gap-3 pt-4')}>
        <div className={cn('flex items-center', collapsed ? 'w-full flex-col gap-2.5' : 'justify-between px-3.5')}>
          {collapsed ? <BrandLockup variant="compact" /> : <BrandLockup />}
          <button
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-hover-bg text-sidebar-muted transition-all duration-150 hover:border-orange-400/40 hover:text-sidebar-icon-hover',
              collapsed && 'rotate-180'
            )}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        <span className={cn('h-px bg-sidebar-border', collapsed ? 'w-8 self-center' : 'mx-3')} />

        {/* Quick actions */}
        {collapsed ? (
          <Tooltip delayDuration={250}>
            <TooltipTrigger asChild>
              <button
                onClick={onSearch}
                aria-label="Quick actions"
                className={cn(
                  railBtn,
                  'border border-orange-300/20 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm hover:from-orange-600 hover:to-orange-700 hover:text-white'
                )}
              >
                <Sparkles className="h-5 w-5" strokeWidth={1.9} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Quick actions</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={onSearch}
            aria-label="Quick actions"
            title="Quick actions"
            className="mx-3 flex h-9 items-center gap-2.5 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 pl-2.5 text-[13px] font-medium text-white shadow-sm transition-all hover:from-orange-600 hover:to-orange-700"
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.9} />
            <span className="truncate">Quick actions</span>
          </button>
        )}

        <span className={cn('h-px bg-sidebar-border', collapsed ? 'w-8 self-center' : 'mx-3')} />

        {/* Profile */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <button
                  onClick={openAccountMenu}
                  aria-label="Account"
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-semibold text-white shadow-sm">
                    {initial}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Account</TooltipContent>
            </Tooltip>
            <span className="h-px w-8 bg-sidebar-border" />
          </div>
        ) : (
          <button
            onClick={openAccountMenu}
            className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-2 py-1.5 text-left transition-colors hover:bg-sidebar-hover-bg"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-semibold text-white shadow-sm">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-sidebar-text-strong">
                {user?.displayName || user?.email || 'Account'}
              </span>
              <span className="block truncate text-[11px] text-sidebar-muted">
                {user?.roles?.length ? user.roles[0] : 'Member'}
              </span>
            </span>
          </button>
        )}
      </div>

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <nav
        className={cn(
          'flex-1 overflow-y-auto',
          collapsed ? 'flex w-full flex-col items-center gap-1 py-2' : 'px-3 py-2'
        )}
      >
        {groups.map((group, idx) => {
          // For admin/super_admin users, hide DASHBOARDS / DATA SOURCES / AI INSIGHTS
          // (admin-only cleanup). Normal users keep the full navigation.
          if (isAdminUser(user?.roles) && group.title && ADMIN_HIDDEN_GROUPS.has(group.title)) return null;
          const items = group.items.filter((item) => hasPermission(item.permission));
          if (items.length === 0) return null;
          return (
            <div key={idx} className={cn('flex flex-col', collapsed ? 'w-full items-center gap-1' : 'w-full gap-0.5')}>
              {idx > 0 && <span className={cn('my-1.5 h-px bg-sidebar-border', collapsed ? 'w-8 self-center' : 'w-full')} />}
              {!collapsed && group.title && (
                <p className="px-1.5 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-muted">
                  {group.title}
                </p>
              )}
              <div className={cn('flex flex-col', collapsed ? 'items-center gap-1' : 'gap-0.5')}>
                {items.map((item) => (
                  <div key={item.to} className={cn(collapsed ? '' : 'w-full')}>
                    {collapsed ? renderItemCollapsed(item) : renderItemExpanded(item)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {isAdminUser(user?.roles) && (
          <div className={cn('flex flex-col', collapsed ? 'w-full items-center gap-1' : 'w-full gap-0.5')}>
            <span className={cn('my-1.5 h-px bg-sidebar-border', collapsed ? 'w-8 self-center' : 'w-full')} />
            {!collapsed && <p className="px-1.5 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-muted">Admin</p>}
            <div className={cn('flex flex-col', collapsed ? 'items-center gap-1' : 'gap-0.5')}>
              {[
                { to: '/admin/reports', icon: ClipboardCheck, label: 'Report Review' },
                { to: '/admin/members', icon: Users, label: 'Members' },
              ].map(item=> (
                <div key={item.to} className={cn(collapsed ? '' : 'w-full')}>
                  {collapsed ? renderItemCollapsed(item as any) : renderItemExpanded(item as any)}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── Bottom: settings ──────────────────────────────────────────── */}
      <div className={cn('flex shrink-0 flex-col', collapsed ? 'items-center gap-1 pb-4' : 'gap-1 px-3 pb-4')}>
        <span className={cn('mb-1.5 h-px bg-sidebar-border', collapsed ? 'w-8 self-center' : 'w-full')} />
        {collapsed ? (
          <>
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <button aria-label="Settings" title="Settings" className={railBtn} onClick={openAccountMenu}>
                  <Settings className="h-[22px] w-[22px]" strokeWidth={1.8} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Settings</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <button
              aria-label="Settings"
              className="group flex w-full items-center gap-3 rounded-lg py-2 pl-2.5 pr-3 text-[13.5px] font-medium text-sidebar-text transition-colors hover:bg-sidebar-hover-bg hover:text-sidebar-text-hover"
              onClick={openAccountMenu}
            >
              <Settings className="h-[20px] w-[20px] shrink-0" strokeWidth={1.8} />
              <span className="truncate">Settings</span>
            </button>
          </>
        )}
      </div>

      {/* ── Account menu ─────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="absolute left-[calc(100%+10px)] top-16 z-50 w-48 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-bg py-1 shadow-lg animate-zoom-in">
          <button
            onClick={() => {
              setMenuOpen(false);
              navigate('/dashboard');
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-sidebar-text transition-colors hover:bg-sidebar-hover-bg"
          >
            <Home className="h-4 w-4" /> Home
          </button>
          <button
            onClick={() => setMenuOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-sidebar-text transition-colors hover:bg-sidebar-hover-bg"
          >
            <Sparkles className="h-4 w-4" /> Quick actions
          </button>
          <div className="my-1 h-px bg-sidebar-border" />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-red-500 transition-colors hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
