'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../auth/auth-context';
import { ROLE_LABELS } from '../auth/types';
import { chatbotApi } from './chatbot-api';
import { MarkdownRenderer } from './MarkdownRenderer';

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function ModernAiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Antenna with glowing tip */}
      <circle cx="12" cy="2.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 3.7v2.3" />
      {/* Robot Head */}
      <rect x="4.5" y="6" width="15" height="11.5" rx="4.5" />
      {/* Side Ears */}
      <path d="M3 10.2a1.5 1.5 0 0 0 0 3.1" />
      <path d="M21 10.2a1.5 1.5 0 0 1 0 3.1" />
      {/* Friendly Smiling Eyes */}
      <path d="M8.5 11.2c.4-.6 1.1-.6 1.5 0" />
      <path d="M14 11.2c.4-.6 1.1-.6 1.5 0" />
      {/* Smile */}
      <path d="M10.5 14.2c.5.5 1.5.5 2 0" />
      {/* Shoulders */}
      <path d="M7.5 20.5a5 5 0 0 1 9 0" />
    </svg>
  );
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}

const STARTER_PROMPTS = [
  'Check my leave balance',
  'Who reports to me?',
  'Show recent activity logs',
  'What permissions does my role have?',
];

export function ChatbotWidget() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // User-scoped storage keys ensuring complete isolation between users
  const userId = user?.id || 'guest';
  const storagePrefix = `octus_chatbot_${userId}`;
  const sessionKey = `${storagePrefix}_session_id`;
  const messagesKey = `${storagePrefix}_messages`;

  // Initialize or restore session ID and messages whenever authenticated user changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let storedId = window.sessionStorage.getItem(sessionKey);
      if (!storedId) {
        storedId = `octus_${userId}_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
        window.sessionStorage.setItem(sessionKey, storedId);
      }
      setSessionId(storedId);

      // Restore messages scoped exclusively to this authenticated user
      const cachedMessages = window.sessionStorage.getItem(messagesKey);
      if (cachedMessages) {
        try {
          const parsed = JSON.parse(cachedMessages);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          } else {
            setMessages([]);
          }
        } catch {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
      setErrorMessage(null);
      setLastUserMessage(null);
    }
  }, [userId, sessionKey, messagesKey]);

  // Sync messages to user-scoped sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (messages.length > 0) {
        window.sessionStorage.setItem(messagesKey, JSON.stringify(messages));
      } else {
        window.sessionStorage.removeItem(messagesKey);
      }
    }
  }, [messages, messagesKey]);

  // Auto-scroll to bottom of message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend ?? input).trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setErrorMessage(null);
    setLastUserMessage(messageText);
    setIsLoading(true);

    try {
      const response = await chatbotApi.sendMessage(messageText, sessionId, sessionId);
      const replyText = response.reply || response.response || 'No response received from assistant.';

      const assistantMessage: Message = {
        id: 'msg_ai_' + Date.now(),
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const errorStr = (err as Error)?.message || 'AI assistant is temporarily unavailable. Please try again.';
      setErrorMessage(errorStr);

      const errorMsg: Message = {
        id: 'msg_err_' + Date.now(),
        sender: 'assistant',
        text: 'AI assistant is temporarily unavailable. Please check your connection or try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!lastUserMessage || isLoading) return;
    setMessages((prev) => prev.filter((m) => !m.isError));
    await handleSendMessage(lastUserMessage);
  };

  const handleResetSession = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await chatbotApi.resetSession(sessionId, sessionId);
      setMessages([]);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(messagesKey);
        const newId = `octus_${userId}_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
        window.sessionStorage.setItem(sessionKey, newId);
        setSessionId(newId);
      }
    } catch {
      setMessages([]);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(messagesKey);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const userRoleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : 'Team Member';
  const userName = user?.name || 'there';

  // Hide the chatbot widget on the login page and for unauthenticated sessions (Rules of Hooks compliant)
  if (!isAuthenticated || pathname === '/login' || pathname?.startsWith('/login')) {
    return null;
  }

  return (
    <>
      {/* ──────────────────────────────────────────────────────────────────────────
          1. FLOATING AI LAUNCHER ("Ask Octus AI / Manager" visual redesign)
          Rounded horizontal pill card matching visual reference
      ────────────────────────────────────────────────────────────────────────── */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-4 rounded-full bg-white/98 pl-4 pr-8 py-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/90 backdrop-blur-md transition-all duration-300 hover:border-[#6E1D1D]/35 hover:shadow-[0_16px_44px_rgba(110,29,29,0.14)] hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-[#6E1D1D]/20 active:scale-[0.98] cursor-pointer select-none"
            aria-label="Open Octus AI Chat Assistant"
          >
            {/* AI Icon Avatar */}
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#6E1D1D] shadow-[0_0_18px_rgba(110,29,29,0.45)] shrink-0 overflow-hidden ring-1 ring-[#882424]/40">
              <Image
                src="/octus-ai-avatar.png"
                alt="Ask Octus AI"
                width={48}
                height={48}
                className="h-full w-full object-cover select-none pointer-events-none"
                draggable={false}
                priority
              />
            </div>

            {/* Conversational Label & Status */}
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-3">
                <span className="text-[17px] font-bold tracking-tight text-[#111827] group-hover:text-[#6E1D1D] transition-colors leading-tight">
                  Ask Octus AI
                </span>
                <span
                  className="relative flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#16A36A]/15 shrink-0"
                  title="Online"
                  aria-label="Online"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#16A36A]" />
                </span>
              </div>
              <span className="text-[14.5px] font-medium text-[#5B6B82] leading-tight mt-1">
                Manager
              </span>
            </div>
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          2. OPEN CHAT PANEL
          Floating overlay panel, responsive, compact width, Media Octus theme
      ────────────────────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 flex h-[600px] max-h-[calc(100vh-48px)] w-[calc(100vw-32px)] sm:w-[420px] flex-col overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white shadow-2xl shadow-slate-900/20 animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-label="Media Octus AI Assistant"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#6E1D1D] px-4 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur-xs border border-white/20">
                <ModernAiIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Octus AI</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#16A36A]" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-white/80">
                  {isAuthenticated ? `${userRoleLabel} Assistant` : 'Media Octus CRM AI'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Reset / New conversation button */}
              <button
                onClick={() => void handleResetSession()}
                disabled={isLoading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-50 cursor-pointer"
                title="Reset conversation memory"
                aria-label="Reset conversation"
              >
                <RefreshCw className="h-4 w-4" />
              </button>

              {/* Close panel button */}
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white cursor-pointer"
                title="Close chat panel"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex flex-1 flex-col overflow-y-auto bg-[#FAFAFA] p-4 space-y-3.5">
            {messages.length === 0 ? (
              /* Starter / Welcome Screen */
              <div className="my-auto flex flex-col items-center justify-center text-center px-2 py-4">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F8E6E6] text-[#6E1D1D] shadow-inner">
                  <ModernAiIcon className="h-7 w-7 text-[#6E1D1D]" />
                </div>
                <h4 className="text-sm font-bold text-[#1F2937]">
                  Hi {userName}, how can I help you today?
                </h4>
                <p className="mt-1 text-xs text-[#687280] max-w-[280px]">
                  I am your company CRM assistant. Ask me about leaves, employees, leads, tasks, or role permissions.
                </p>

                {/* Suggested prompt chips */}
                <div className="mt-5 flex w-full flex-col gap-2">
                  <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Suggested Questions
                  </span>
                  {STARTER_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => void handleSendMessage(prompt)}
                      className="rounded-xl border border-[#E6E8EC] bg-white px-3.5 py-2 text-left text-xs font-medium text-[#1F2937] shadow-xs transition hover:border-[#6E1D1D]/40 hover:bg-[#F8E6E6]/30 hover:text-[#6E1D1D] cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message List */
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`relative max-w-[88%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                      msg.sender === 'user'
                        ? 'rounded-br-xs bg-[#6E1D1D] text-white leading-relaxed'
                        : msg.isError
                        ? 'rounded-bl-xs border border-red-200 bg-red-50 text-red-700'
                        : 'rounded-bl-xs border border-[#E6E8EC] bg-white text-[#1F2937] leading-relaxed'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <MarkdownRenderer content={msg.text} />
                    )}
                  </div>
                  <span className="mt-1 text-[10px] text-slate-400 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              ))
            )}

            {/* Typing / Loading indicator */}
            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F8E6E6] text-[#6E1D1D] shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-xs border border-[#E6E8EC] bg-white px-3.5 py-2 text-xs text-slate-600 shadow-xs">
                  <span className="font-medium text-[#6E1D1D]">Octus AI is typing</span>
                  <span className="flex gap-1 items-center ml-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6E1D1D] animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6E1D1D] animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6E1D1D] animate-bounce" />
                  </span>
                </div>
              </div>
            )}

            {/* Error & Retry banner */}
            {errorMessage && !isLoading && (
              <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Request failed.</span>
                </div>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1 font-semibold text-red-800 hover:underline cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <div className="shrink-0 border-t border-[#E6E8EC] bg-white p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSendMessage();
              }}
              className="flex items-end gap-2 rounded-xl border border-[#E6E8EC] bg-[#F9FAFB] p-1.5 focus-within:border-[#6E1D1D] focus-within:ring-1 focus-within:ring-[#6E1D1D] transition-all"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about employees, leaves, tasks, leads..."
                rows={1}
                className="max-h-24 min-h-[36px] flex-1 resize-none bg-transparent px-2.5 py-2 text-xs text-[#1F2937] placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6E1D1D] text-white shadow-xs transition-colors hover:bg-[#882424] disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer shrink-0"
                title="Send message (Enter)"
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <SendIcon className="h-4 w-4 text-white" />
                )}
              </button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
