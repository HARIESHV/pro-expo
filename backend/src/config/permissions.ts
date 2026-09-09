import { UserRole } from '../types';

export type PermissionType =
  | 'users.view'
  | 'users.manage'
  | 'audit_logs.view'
  | 'reports.view'
  | 'reports.generate'
  | 'reports.export'
  | 'reports.delete'
  | 'reports.view_all'
  | 'reports.employee_submit'
  | 'reports.admin_review'
  | 'dashboards.executive'
  | 'dashboards.analytics'
  | 'dashboards.risks'
  | 'dashboards.bi'
  | 'dashboards.di'
  | 'dashboards.documents'
  | 'dashboards.knowledge_graph'
  | 'dashboards.evaluate_graph'
  | 'dashboards.admin'
  | 'universal_search';

export const ALL_PERMISSIONS: PermissionType[] = [
  'users.view', 'users.manage', 'audit_logs.view',
  'reports.view', 'reports.generate', 'reports.export', 'reports.delete', 'reports.view_all',
  'reports.employee_submit', 'reports.admin_review',
  'dashboards.executive', 'dashboards.analytics', 'dashboards.risks', 'dashboards.bi', 'dashboards.di',
  'dashboards.documents', 'dashboards.knowledge_graph', 'dashboards.evaluate_graph',
  'dashboards.admin',
  'universal_search'
];

// RBAC: admin/super_admin have full access including admin dashboard; employees limited.
export const ROLE_PERMISSIONS: Record<UserRole, PermissionType[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  ceo: ALL_PERMISSIONS,
  manager: ALL_PERMISSIONS,
  employee: ['reports.view','reports.generate','reports.export','reports.delete','reports.employee_submit','dashboards.executive','dashboards.analytics','dashboards.risks','dashboards.bi','dashboards.di','dashboards.documents','dashboards.knowledge_graph','dashboards.evaluate_graph','universal_search'],
  analyst: ALL_PERMISSIONS,
  hr: ALL_PERMISSIONS,
  finance: ALL_PERMISSIONS,
  sales: ALL_PERMISSIONS
};

export function hasPermission(roles: string[], permission: PermissionType): boolean {
  if (!roles || !Array.isArray(roles)) return false;
  return roles.some((role) => {
    const normalizedRole = role.toLowerCase().trim() as UserRole;
    return ROLE_PERMISSIONS[normalizedRole]?.includes(permission);
  });
}
