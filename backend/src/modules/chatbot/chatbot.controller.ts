import { Request, Response } from 'express';
import { ChatbotService } from './chatbot.service.js';
import {
  chatbotMessageSchema,
  chatbotResetSchema,
  chatbotToolSchema,
} from './chatbot.validator.js';
import { NotFoundError, UnauthorizedError } from '../../core/errors/index.js';

export class ChatbotController {
  static async sendMessage(req: Request, res: Response) {
    const user = req.ctx?.user;
    if (!user) {
      throw new UnauthorizedError('Authentication required to use Octus AI');
    }

    const { message, sessionId, conversationId } = chatbotMessageSchema.parse(req.body);

    // Identity strictly derived from authenticated session/token - never from req.body
    const result = await ChatbotService.sendMessage({
      message,
      sessionId,
      conversationId,
      userId: user.id,
      role: user.role,
      name: user.name,
    });

    res.status(200).json(result);
  }

  static async executeTool(req: Request, res: Response) {
    const user = req.ctx?.user;
    if (!user) {
      throw new UnauthorizedError('Authentication required to execute CRM tools');
    }

    const parsed = chatbotToolSchema.parse(req.body);
    const toolName = (parsed.toolName || parsed.tool) as string;
    const toolArgs = parsed.toolArgs || parsed.args || {};

    const result = await ChatbotService.executeTool({
      toolName,
      toolArgs,
      userId: user.id,
      role: user.role,
      name: user.name,
      sessionId: parsed.sessionId || parsed.conversationId,
    });

    res.status(200).json(result);
  }

  static async resetSession(req: Request, res: Response) {
    const user = req.ctx?.user;
    if (!user) {
      throw new UnauthorizedError('Authentication required to reset session');
    }

    const { sessionId, conversationId } = chatbotResetSchema.parse(req.body);

    const result = await ChatbotService.resetSession({
      sessionId,
      conversationId,
      userId: user.id,
      role: user.role,
      name: user.name,
    });

    res.status(200).json(result);
  }

  static async listConversations(req: Request, res: Response) {
    const user = req.ctx?.user;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await ChatbotService.listConversations(user.id);
    res.status(200).json(result);
  }

  static async getConversation(req: Request, res: Response) {
    const user = req.ctx?.user;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    const id = req.params.id as string;
    const result = await ChatbotService.getConversation(user.id, id);
    res.status(200).json(result);
  }

  static async deleteConversation(req: Request, res: Response) {
    const user = req.ctx?.user;
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    const id = req.params.id as string;
    const result = await ChatbotService.deleteConversation(user.id, id);
    res.status(200).json(result);
  }

  static async checkHealth(_req: Request, res: Response) {
    const health = await ChatbotService.checkHealth();
    res.status(200).json(health);
  }

  static async getChart(req: Request, res: Response) {
    const filename = req.params.filename as string;
    const chart = await ChatbotService.getChartStream(filename);

    if (!chart) {
      throw new NotFoundError('Chart image not found');
    }

    res.setHeader('Content-Type', chart.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(chart.buffer);
  }
}
