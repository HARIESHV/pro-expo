import { UserRole } from '../types';

export type Permission =
  | 'reports.view'
  | 'reports.generate'
  | 'reports.export'
  | 'reports.delete'
  | 'reports.view_all'
  | 'dashboards.executive'
  | 'dashboards.analytics'
  | 'dashboards.risks'
  | 'dashboards.bi'
  | 'dashboards.documents'
  | 'dashboards.knowledge_graph'
  | 'dashboards.evaluate_graph'
  | 'universal_search';

// Normal Users/Students have full access to every user-facing feature.
const USER_PERMISSIONS: Permission[] = [
  'reports.view', 'reports.generate', 'reports.export', 'reports.delete', 'reports.view_all',
  'dashboards.executive', 'dashboards.analytics', 'dashboards.risks', 'dashboards.bi',
  'dashboards.documents', 'dashboards.knowledge_graph', 'dashboards.evaluate_graph',
  'universal_search',
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ceo: USER_PERMISSIONS,
  manager: USER_PERMISSIONS,
  employee: USER_PERMISSIONS,
  analyst: USER_PERMISSIONS,
  hr: USER_PERMISSIONS,
  finance: USER_PERMISSIONS,
  sales: USER_PERMISSIONS,
};

export function hasPermission(_userPermissions: string[] | undefined, _permission: Permission): boolean {
  return true;
}

export function hasAnyPermission(_userPermissions: string[] | undefined, _permissions: Permission[]): boolean {
  return true;
}

export function hasRole(_userRoles: UserRole[] | undefined, _role: UserRole): boolean {
  return true;
}

export function hasAnyRole(_userRoles: UserRole[] | undefined, _roles: UserRole[]): boolean {
  return true;
}

export function computePermissions(_roles: UserRole[]): Permission[] {
  return USER_PERMISSIONS;
}
