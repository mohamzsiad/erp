import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  answer: string;
  data?: Record<string, unknown>[];
  chartHint?: 'bar' | 'line' | 'pie' | null;
}

async function sendChat(payload: ChatRequest): Promise<ChatResponse> {
  const { data } = await apiClient.post<ChatResponse>('/ai/chat', payload);
  return data;
}

export function useChatMutation() {
  return useMutation({ mutationFn: sendChat });
}
