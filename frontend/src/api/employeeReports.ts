import axiosInstance from './axios';

export interface EmployeeReport {
  _id: string;
  title: string;
  description: string;
  category: string;
  originalFileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PROCESS_ABORTED';
  submittedAt: string;
  reviewedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  adminComments?: string;
  submittedBy: { _id: string; firstName: string; lastName: string; email: string };
  reviewedBy?: { firstName: string; lastName: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export const employeeReportsApi = {
  submit: (formData: FormData) => axiosInstance.post('/employee-reports/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  myReports: () => axiosInstance.get<{ success: boolean; data: EmployeeReport[] }>('/employee-reports/my'),
  getOne: (id: string) => axiosInstance.get<{ success: boolean; data: EmployeeReport }>(`/employee-reports/${id}`),
  download: (id: string) => axiosInstance.get(`/employee-reports/${id}/download`, { responseType: 'blob' }),
  preview: (id: string) => axiosInstance.get(`/employee-reports/${id}/preview`, { responseType: 'blob' }),
};
