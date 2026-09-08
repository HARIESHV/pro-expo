import api from './axios';
import { ApiResponse } from '../types';

export interface OrganizationDetails {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  industry?: string;
  size?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  settings: {
    allowedDomains: string[];
    maxUsers: number;
    aiEnabled: boolean;
    vectorSearchEnabled: boolean;
    auditLogRetentionDays: number;
  };
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  _id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  email: string;
  roles: string[];
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

export const organizationsApi = {
  getCurrentOrganization: () =>
    api.get<ApiResponse<{ organization: OrganizationDetails; stats: { memberCount: number; documentCount: number; queryCount: number } }>>('/organizations/current'),

  getOrganizationMembers: () =>
    api.get<ApiResponse<{ members: OrganizationMember[] }>>('/organizations/current/members'),

  updateOrganizationSettings: (data: {
    name?: string;
    description?: string;
    industry?: string;
    website?: string;
    settings?: Partial<OrganizationDetails['settings']>;
  }) =>
    api.put<ApiResponse<{ organization: OrganizationDetails }>>('/organizations/current/settings', data),
};
