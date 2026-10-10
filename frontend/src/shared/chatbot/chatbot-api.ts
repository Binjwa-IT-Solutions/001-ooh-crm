import { api } from '../api/client';

export interface ChatMessageResponse {
  status: string;
  reply: string;
  response: string;
  sessionId: string;
  conversationId?: string;
  role?: string;
  current_employee?: string | null;
}

export interface ChatResetResponse {
  status: string;
  message: string;
}

export interface ToolExecutionResponse {
  status: string;
  tool: string;
  result: unknown;
  message?: string;
}

export const chatbotApi = {
  sendMessage: async (
    message: string,
    sessionId?: string,
    conversationId?: string,
  ): Promise<ChatMessageResponse> => {
    return api.post<ChatMessageResponse>('/api/chatbot/message', {
      message,
      sessionId,
      conversationId,
    });
  },

  executeTool: async (
    toolName: string,
    toolArgs?: Record<string, unknown>,
    sessionId?: string,
  ): Promise<ToolExecutionResponse> => {
    return api.post<ToolExecutionResponse>('/api/chatbot/tool', {
      toolName,
      toolArgs,
      sessionId,
    });
  },

  resetSession: async (sessionId?: string, conversationId?: string): Promise<ChatResetResponse> => {
    return api.post<ChatResetResponse>('/api/chatbot/reset', {
      sessionId,
      conversationId,
    });
  },

  listConversations: async (): Promise<{ status: string; conversations: unknown[] }> => {
    return api.get<{ status: string; conversations: unknown[] }>('/api/conversations');
  },

  getConversation: async (id: string): Promise<{ status: string; conversation: unknown }> => {
    return api.get<{ status: string; conversation: unknown }>(`/api/conversations/${id}`);
  },

  deleteConversation: async (id: string): Promise<{ status: string; message: string }> => {
    return api.delete<{ status: string; message: string }>(`/api/conversations/${id}`);
  },

  checkHealth: async (): Promise<{ status: string }> => {
    return api.get<{ status: string }>('/api/chatbot/health', { skipAuth: true });
  },
};
