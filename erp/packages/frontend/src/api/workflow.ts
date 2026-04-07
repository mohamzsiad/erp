import apiClient from './client';
import type { PaginatedResponse } from '@clouderp/shared';

export interface WorkflowTask {
  id: string;
  docType: string;
  docNo: string;
  subject: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
  priority: 'high' | 'medium' | 'low';
}

export const workflowApi = {
  getMyTasks: async (params?: { page?: number; limit?: number }) => {
    const { data } = await apiClient.get<{ data: PaginatedResponse<WorkflowTask> }>(
      '/workflow/my-tasks',
      { params }
    );
    return data.data;
  },
};
