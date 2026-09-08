import api from './axios';
import { ApiResponse } from '../types';

export interface ReportParameters {
  startDate: string;
  endDate: string;
  departmentId?: string;
  sources?: string[];
  context?: Record<string, unknown>;
  sections?: {
    kpis: boolean;
    trends: boolean;
    risks: boolean;
    aiInsights: boolean;
    recommendations: boolean;
  };
}

export interface GeneratedReport {
  _id: string;
  organizationId: string;
  createdById: string;
  title: string;
  type: 'executive' | 'sales' | 'finance' | 'operations';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  parameters: ReportParameters;
  content: {
    executiveSummary?: string;
    kpis?: Array<{ name: string; value: string; change?: number }>;
    trends?: Array<{ period: string; metric: string; value: number }>;
    risks?: Array<{ title: string; severity: string; status: string }>;
    aiInsights?: string[];
    recommendations?: string[];
    errors?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export const reportsApi = {
  generateReport: (data: {
    title: string;
    type: 'executive' | 'sales' | 'finance' | 'operations';
    startDate: string;
    endDate: string;
    departmentId?: string;
    sources?: string[];
    context?: Record<string, unknown>;
    sections?: ReportParameters['sections'];
  }) =>
    api.post<ApiResponse<{ report: GeneratedReport }>>('/reports', data),

  getReports: () =>
    api.get<ApiResponse<{ reports: GeneratedReport[] }>>('/reports'),

  getReport: (id: string) =>
    api.get<ApiResponse<{ report: GeneratedReport }>>(`/reports/${id}`),

  deleteReport: (id: string) =>
    api.delete<ApiResponse>(`/reports/${id}`),

  exportReport: (id: string, format: 'pdf' | 'excel' | 'docx' | 'csv' | 'json') =>
    api.post<ApiResponse<{ reportId: string; format: string; content: any }>>(`/reports/${id}/export`, { format }),

  regenerateReport: (id: string) =>
    api.post<ApiResponse<{ report: GeneratedReport }>>(`/reports/${id}/regenerate`),

  download: async (id: string, format: 'pdf' | 'excel' | 'docx' | 'csv') => {
    const response = await api.get<Blob>(`/reports/${id}/${format}`, { responseType: 'blob' });
    const contentDisposition = response.headers['content-disposition'] || '';
    const filename = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] || `report-${id}.${format === 'excel' ? 'xlsx' : format}`;
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },
};
