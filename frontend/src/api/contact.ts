import axiosInstance from './axios';

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactResponse {
  success: boolean;
  message: string;
  code?: string;
  emailId?: string;
  errors?: Record<string, string[]>;
}

export async function sendContact(payload: ContactPayload): Promise<ContactResponse> {
  const { data } = await axiosInstance.post<ContactResponse>('/contact', payload);
  return data;
}
