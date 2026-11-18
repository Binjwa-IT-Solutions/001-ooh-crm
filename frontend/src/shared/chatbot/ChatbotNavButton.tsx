'use client';

import React from 'react';
import Image from 'next/image';
import { useAuth } from '../auth/auth-context';
import { ROLE_LABELS } from '../auth/types';
import { useChatbot } from './chatbot-context';

export function ChatbotNavButton() {
  const { isOpen, toggleChatbot } = useChatbot();
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  const roleSubtitle = user?.role ? (ROLE_LABELS[user.role] || user.role) : 'Manager';

  return (
    <button
      type="button"
      onClick={toggleChatbot}
      aria-expanded={isOpen}
      aria-label={isOpen ? 'Close Octus AI chat' : 'Open Octus AI chat'}
      title={isOpen ? 'Close Octus AI' : 'Ask Octus AI'}
      className={`group relative flex items-center gap-2.5 rounded-full border transition-all duration-200 pl-1.5 pr-3.5 py-1 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 active:scale-[0.98] shrink-0 ${
        isOpen
          ? 'bg-[#FDF8F8] border-[#6E1D1D]/50 shadow-sm ring-1 ring-[#6E1D1D]/20'
          : 'bg-white border-[#E6E8EC] shadow-xs hover:border-[#6E1D1D]/35 hover:bg-[#FDF8F8] hover:shadow-sm'
      }`}
    >
      {/* Robot Avatar */}
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#6E1D1D] shadow-[0_0_10px_rgba(110,29,29,0.35)] shrink-0 overflow-hidden ring-1 ring-[#882424]/40">
        <Image
          src="/octus-ai-avatar.png"
          alt="Ask Octus AI"
          width={32}
          height={32}
          className="h-full w-full object-cover select-none pointer-events-none"
          draggable={false}
          priority
        />
      </div>

      {/* Conversational Label & Status */}
      <div className="flex flex-col text-left leading-none">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-tight text-[#111827] group-hover:text-[#6E1D1D] transition-colors leading-tight">
            Ask Octus AI
          </span>
          <span
            className="relative flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#16A36A]/15 shrink-0"
            title="Online"
            aria-label="Online"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#16A36A]" />
          </span>
        </div>
        <span className="text-[10.5px] font-medium text-[#5B6B82] leading-tight mt-0.5">
          {roleSubtitle}
        </span>
      </div>
    </button>
  );
}

