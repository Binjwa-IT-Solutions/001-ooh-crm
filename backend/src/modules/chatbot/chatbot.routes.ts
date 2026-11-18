import { Router } from 'express';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { ChatbotController } from './chatbot.controller.js';

export const chatbotRoutes = Router();

// Public routes
chatbotRoutes.get('/health', asyncHandler(ChatbotController.checkHealth));
chatbotRoutes.get('/charts/:filename', asyncHandler(ChatbotController.getChart));

// Authenticated chatbot & tool routes
chatbotRoutes.post('/message', requireAuth, asyncHandler(ChatbotController.sendMessage));
chatbotRoutes.post('/chat', requireAuth, asyncHandler(ChatbotController.sendMessage));
chatbotRoutes.post('/tool', requireAuth, asyncHandler(ChatbotController.executeTool));
chatbotRoutes.post('/reset', requireAuth, asyncHandler(ChatbotController.resetSession));

// Authenticated conversation management routes
chatbotRoutes.get('/conversations', requireAuth, asyncHandler(ChatbotController.listConversations));
chatbotRoutes.get('/conversations/:id', requireAuth, asyncHandler(ChatbotController.getConversation));
chatbotRoutes.delete('/conversations/:id', requireAuth, asyncHandler(ChatbotController.deleteConversation));

export default chatbotRoutes;
