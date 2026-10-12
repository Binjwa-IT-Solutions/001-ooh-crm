import { Types } from 'mongoose';
import { config } from '../../config/index.js';
import { AppError, ForbiddenError, NotFoundError } from '../../core/errors/index.js';
import { ROLE_PERMISSIONS, type Permission, type Role } from '../../core/rbac/permissions.js';
import { Conversation, type IConversation } from './conversation.model.js';

export interface SendMessageParams {
  message: string;
  sessionId?: string;
  conversationId?: string;
  userId: string;
  role: string;
  name: string;
}

export interface ChatbotResponse {
  status: string;
  reply: string;
  response: string;
  sessionId: string;
  conversationId?: string;
  role?: string;
  current_employee?: string | null;
}

export interface ExecuteToolParams {
  toolName: string;
  toolArgs?: Record<string, unknown>;
  userId: string;
  role: string;
  name: string;
  sessionId?: string;
}

export const CHATBOT_TOOL_PERMISSIONS: Record<string, readonly Permission[]> = {
  // System & Audit
  get_role_access: ['users.view', 'employees.view', 'employees.self'],
  get_recent_activity: ['audit.view'],
  generate_analytical_image: ['reports.view'],

  // Employee
  get_employee: ['employees.view', 'employees.self'],
  get_employee_performance_summary: ['reports.view'],
  update_employee: ['users.update', 'employees.manage'],
  add_employee: ['users.create', 'employees.manage'],
  remove_employee: ['employees.manage'],

  // Leave
  get_leave_balance: ['leave.manage', 'leave.self'],
  update_leave_balance: ['leave.manage', 'holiday.manage'],
  apply_for_leave: ['leave.self'],
  get_pending_leave_requests: ['leave.manage'],
  approve_leave_request: ['leave.manage'],
  reject_leave_request: ['leave.manage'],
  generate_leave_image: ['reports.view'],

  // Attendance
  get_attendance_status: ['attendance.view_team', 'attendance.self'],
  update_attendance_status: ['attendance.view_team', 'holiday.manage'],

  // Salary / Finance
  get_salary_details: ['employees.sensitive', 'finance.manage', 'employees.self', 'employees.manage'],
  update_salary: ['finance.manage'],
  get_company_finance_summary: ['finance.view'],
  generate_salary_image: ['reports.view'],

  // Leads
  add_lead: ['leads.create'],
  get_leads: ['leads.view'],
  update_lead: ['leads.update'],
  claim_lead: ['leads.claim'],
  generate_lead_source_image: ['reports.view'],

  // Quotations
  generate_quotation_pdf: ['quotations.create'],
  get_quotations: ['quotations.view'],
  update_quotation: ['quotations.update'],

  // Purchase Orders
  generate_po_pdf: ['purchase_orders.manage'],
  get_purchase_orders: ['purchase_orders.view'],

  // Operations
  get_sites: ['sites.view'],
  get_bookings: ['bookings.view'],
  book_site: ['bookings.manage', 'sites.manage'],
  get_vendors: ['vendors.view'],
  get_campaigns: ['campaigns.view'],

  // Tasks
  get_my_tasks: ['tasks.view'],
  update_task_status: ['tasks.manage'],
  reassign_tasks: ['tasks.manage'],
  create_task: ['tasks.manage'],

  // Escalations
  get_escalations: ['tasks.manage'],
  acknowledge_escalation: ['tasks.manage'],
};

export function isToolAllowedForRole(role: string, toolName: string): boolean {
  if (role === 'admin') return true;
  if (toolName === 'remove_employee') return false;
  const requiredPermissions = CHATBOT_TOOL_PERMISSIONS[toolName];
  if (!requiredPermissions) {
    return false;
  }
  const userPerms = ROLE_PERMISSIONS[role as Role] || [];
  return requiredPermissions.some((perm) => (userPerms as readonly string[]).includes(perm));
}

export class ChatbotService {
  /**
   * Forwards a chat message to the internal Python Chatbot service,
   * enforcing user-scoped conversation identity and persisting history in MongoDB.
   */
  static async sendMessage(params: SendMessageParams): Promise<ChatbotResponse> {
    const { message, sessionId, conversationId, userId, role, name } = params;
    const requestedSessionId = conversationId || sessionId;

    let conversation: IConversation | null = null;
    const userObjectId = new Types.ObjectId(userId);

    if (requestedSessionId) {
      const isObjId = Types.ObjectId.isValid(requestedSessionId);
      conversation = await Conversation.findOne(
        isObjId
          ? {
              $or: [
                { _id: new Types.ObjectId(requestedSessionId) },
                { conversationId: requestedSessionId },
              ],
              deletedAt: null,
            }
          : { conversationId: requestedSessionId, deletedAt: null },
      );

      // CRITICAL: Ownership validation - User B cannot post to User A's conversation
      if (conversation && conversation.userId.toString() !== userId) {
        throw new ForbiddenError('You do not have access to this conversation session');
      }
    }

    if (!conversation) {
      const newConvId = requestedSessionId || `octus_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      conversation = await Conversation.create({
        conversationId: newConvId,
        userId: userObjectId,
        title: message.slice(0, 50),
        role,
        messages: [],
      });
    }

    const resolvedSessionId = conversation.conversationId;

    // Payload sent to trusted internal Python AI service
    const payload = {
      message,
      sessionId: resolvedSessionId,
      session_id: resolvedSessionId,
      user_id: userId,
      userId,
      role,
      name,
    };

    const pythonUrl = `${config.pythonChatbot.url}/api/chat`;

    try {
      const response = await fetch(pythonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.pythonChatbot.timeoutMs),
      });

      if (!response.ok) {
        let errMessage = 'AI assistant encountered an issue. Please try again.';
        try {
          const errBody = (await response.json()) as { message?: string };
          if (errBody?.message) {
            errMessage = errBody.message;
          }
        } catch {
          // Fallback to generic message
        }

        throw new AppError(
          errMessage,
          response.status >= 500 ? 502 : response.status,
          'CHATBOT_ERROR',
        );
      }

      const data = (await response.json()) as {
        status?: string;
        reply?: string;
        response?: string;
        sessionId?: string;
        role?: string;
        current_employee?: string | null;
      };

      const replyText = data.reply || data.response || 'No response received from assistant.';

      // Persist messages in database scoped to authenticated user
      const now = new Date();
      conversation.messages.push({
        id: `msg_u_${Date.now()}`,
        sender: 'user',
        text: message,
        timestamp: now,
      });
      conversation.messages.push({
        id: `msg_a_${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date(now.getTime() + 100),
      });
      await conversation.save();

      return {
        status: data.status || 'success',
        reply: replyText,
        response: replyText,
        sessionId: resolvedSessionId,
        conversationId: resolvedSessionId,
        role: data.role || role,
        current_employee: data.current_employee || null,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) {
        throw err;
      }

      const error = err as Error;
      if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
        throw new AppError(
          'AI assistant request timed out. Please try again.',
          504,
          'CHATBOT_TIMEOUT',
        );
      }

      console.error('[chatbot] Failed to reach Python service:', error?.message);
      throw new AppError(
        'AI assistant is temporarily unavailable. Please try again later.',
        503,
        'CHATBOT_UNAVAILABLE',
      );
    }
  }

  /**
   * Executes a tool with strict server-side authorization checks.
   */
  static async executeTool(params: ExecuteToolParams) {
    const { toolName, toolArgs = {}, userId, role, name, sessionId } = params;

    // 1. RBAC authorization check before executing the tool
    if (!isToolAllowedForRole(role, toolName)) {
      throw new ForbiddenError(
        `Your role (${role}) is not authorized to execute tool "${toolName}"`,
      );
    }

    // 2. Forward to Python tool execution endpoint
    const pythonUrl = `${config.pythonChatbot.url}/api/tool`;
    try {
      const response = await fetch(pythonUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: toolName,
          tool_args: toolArgs,
          user_id: userId,
          role,
          name,
          sessionId: sessionId || `tool_${Date.now()}`,
        }),
        signal: AbortSignal.timeout(config.pythonChatbot.timeoutMs),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new AppError(
          data?.message || `Tool execution failed with status ${response.status}`,
          response.status,
          'TOOL_EXECUTION_ERROR',
        );
      }

      return data;
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Failed to execute tool "${toolName}": ${(err as Error)?.message}`,
        502,
        'TOOL_EXECUTION_FAILED',
      );
    }
  }

  /**
   * Resets the conversation context for a given session.
   */
  static async resetSession(params: {
    sessionId?: string;
    conversationId?: string;
    userId: string;
    role: string;
    name: string;
  }): Promise<{ status: string; message: string }> {
    const { sessionId, conversationId, userId, role, name } = params;
    const requestedSessionId = conversationId || sessionId;

    if (requestedSessionId) {
      const isObjId = Types.ObjectId.isValid(requestedSessionId);
      const conversation = await Conversation.findOne(
        isObjId
          ? {
              $or: [
                { _id: new Types.ObjectId(requestedSessionId) },
                { conversationId: requestedSessionId },
              ],
              deletedAt: null,
            }
          : { conversationId: requestedSessionId, deletedAt: null },
      );

      if (conversation && conversation.userId.toString() !== userId) {
        throw new ForbiddenError('You do not have access to reset this conversation session');
      }

      if (conversation) {
        conversation.messages = [];
        await conversation.save();
      }
    }

    const payload = {
      sessionId: requestedSessionId || 'default_session',
      session_id: requestedSessionId || 'default_session',
      user_id: userId,
      userId,
      role,
      name,
    };

    try {
      const response = await fetch(`${config.pythonChatbot.url}/api/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new AppError('Failed to reset AI session.', 502, 'CHATBOT_RESET_ERROR');
      }

      return { status: 'success', message: 'Session context reset successfully.' };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      return { status: 'success', message: 'Session reset locally.' };
    }
  }

  /**
   * Lists conversations belonging exclusively to the authenticated user.
   */
  static async listConversations(userId: string) {
    const conversations = await Conversation.find({
      userId: new Types.ObjectId(userId),
      deletedAt: null,
    })
      .select('conversationId title role createdAt updatedAt')
      .sort({ updatedAt: -1 });

    return {
      status: 'success',
      conversations,
    };
  }

  /**
   * Retrieves a conversation and its messages with strict user ownership validation.
   */
  static async getConversation(userId: string, idOrConversationId: string) {
    const isObjId = Types.ObjectId.isValid(idOrConversationId);
    const conversation = await Conversation.findOne(
      isObjId
        ? {
            $or: [
              { _id: new Types.ObjectId(idOrConversationId) },
              { conversationId: idOrConversationId },
            ],
            deletedAt: null,
          }
        : { conversationId: idOrConversationId, deletedAt: null },
    );

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have permission to access this conversation');
    }

    return {
      status: 'success',
      conversation,
    };
  }

  /**
   * Deletes a conversation with ownership validation.
   */
  static async deleteConversation(userId: string, idOrConversationId: string) {
    const isObjId = Types.ObjectId.isValid(idOrConversationId);
    const conversation = await Conversation.findOne(
      isObjId
        ? {
            $or: [
              { _id: new Types.ObjectId(idOrConversationId) },
              { conversationId: idOrConversationId },
            ],
            deletedAt: null,
          }
        : { conversationId: idOrConversationId, deletedAt: null },
    );

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    if (conversation.userId.toString() !== userId) {
      throw new ForbiddenError('You do not have permission to delete this conversation');
    }

    conversation.deletedAt = new Date();
    await conversation.save();

    return {
      status: 'success',
      message: 'Conversation deleted successfully',
    };
  }

  /**
   * Health check to verify communication between Node.js and Python chatbot service.
   */
  static async checkHealth(): Promise<{ status: string; service: string; details?: unknown }> {
    try {
      const response = await fetch(`${config.pythonChatbot.url}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { status: 'degraded', service: 'python-chatbot' };
      }

      const details = await response.json();
      return { status: 'online', service: 'python-chatbot', details };
    } catch {
      return { status: 'offline', service: 'python-chatbot' };
    }
  }

  /**
   * Proxies chart image from Python static charts folder.
   */
  static async getChartStream(
    filename: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const sanitized = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
      const response = await fetch(`${config.pythonChatbot.url}/charts/${sanitized}`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/png';
      return { buffer, contentType };
    } catch {
      return null;
    }
  }
}
