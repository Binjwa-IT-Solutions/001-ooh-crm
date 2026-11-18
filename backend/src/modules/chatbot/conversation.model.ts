import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../core/db/basePlugin.js';

export interface IConversationMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  toolCalls?: unknown[];
  isError?: boolean;
}

export interface IConversation extends BaseDocument {
  conversationId: string;
  userId: Types.ObjectId;
  title: string;
  role: string;
  messages: IConversationMessage[];
}

const conversationMessageSchema = new Schema<IConversationMessage>(
  {
    id: { type: String, required: true },
    sender: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    toolCalls: { type: [Schema.Types.Mixed], default: [] },
    isError: { type: Boolean, default: false },
  },
  { _id: false },
);

const conversationSchema = new Schema<IConversation>(
  {
    conversationId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'New Conversation' },
    role: { type: String, required: true, default: 'employee' },
    messages: { type: [conversationMessageSchema], default: [] },
  },
  { timestamps: true },
);

conversationSchema.plugin(basePlugin);

export const Conversation =
  (mongoose.models.Conversation as mongoose.Model<IConversation>) ??
  mongoose.model<IConversation>('Conversation', conversationSchema);
