import axiosInstance from './axios';

export interface AdminOverview {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  aborted: number;
  reportsToday: number;
  recent: any[];
}

export interface MemberStats {
  totalMembers: number;
  totalActive: number;
  totalInactive: number;
  newToday: number;
  newWeek: number;
  newMonth: number;
  totalAll: number;
}

export interface Member {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  isEmailVerified: boolean;
}

export const adminApi = {
  overview: () => axiosInstance.get<{ success: boolean; data: AdminOverview }>('/admin/reports/overview'),
  listReports: (params: Record<string,string|number|undefined>) => axiosInstance.get('/admin/reports/list', { params }),
  getReport: (id: string) => axiosInstance.get(`/admin/reports/${id}`),
  approve: (id: string) => axiosInstance.post(`/admin/reports/${id}/approve`),
  reject: (id: string, data: { rejectionReason: string; adminComments?: string }) => axiosInstance.post(`/admin/reports/${id}/reject`, data),
  download: (id: string) => axiosInstance.get(`/admin/reports/${id}/download`, { responseType: 'blob' }),
  preview: (id: string) => axiosInstance.get(`/admin/reports/${id}/preview`, { responseType: 'blob' }),
  textPreview: (id: string) => axiosInstance.get(`/admin/reports/text-preview/${id}`),
  memberStats: () => axiosInstance.get<{ success: boolean; data: MemberStats }>('/admin/members/stats'),
  memberList: (params: Record<string,string|number|undefined>) => axiosInstance.get('/admin/members/list', { params }),
  auditLogs: (params?: Record<string, any>) => axiosInstance.get('/audit-logs', { params }),
};
