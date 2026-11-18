import { z } from 'zod';

export const chatbotMessageSchema = z.object({
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message cannot exceed 4000 characters'),
  sessionId: z.string().trim().optional(),
  conversationId: z.string().trim().optional(),
});

export const chatbotResetSchema = z.object({
  sessionId: z.string().trim().optional(),
  conversationId: z.string().trim().optional(),
});

export const chatbotToolSchema = z.object({
  toolName: z.string().trim().min(1, 'Tool name is required').optional(),
  tool: z.string().trim().min(1).optional(),
  toolArgs: z.record(z.any()).optional().default({}),
  args: z.record(z.any()).optional(),
  sessionId: z.string().trim().optional(),
  conversationId: z.string().trim().optional(),
}).refine(data => Boolean(data.toolName || data.tool), {
  message: 'toolName or tool is required',
  path: ['toolName'],
});

export type ChatbotMessageInput = z.infer<typeof chatbotMessageSchema>;
export type ChatbotResetInput = z.infer<typeof chatbotResetSchema>;
export type ChatbotToolInput = z.infer<typeof chatbotToolSchema>;
