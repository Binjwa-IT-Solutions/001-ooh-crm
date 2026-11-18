'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Mail,
  Phone,
  Briefcase,
  User as UserIcon,
  LogOut,
  Pencil,
} from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { ROLE_LABELS } from '../auth/types';
import { UserAvatar } from '../ui/UserAvatar';
import { EditProfileModal } from './EditProfileModal';

export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const displayRoleOrDesignation =
    user?.designation || (user ? (ROLE_LABELS[user.role] ?? user.role) : 'Administrator');

  return (
    <>
      <div ref={popoverRef} className="relative">
        {/* Profile Pill Trigger Button */}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="User profile menu"
          className="flex items-center gap-2 border border-[#E6E8EC] rounded-full p-1 pr-3 shadow-2xs cursor-pointer hover:bg-slate-50 transition-colors bg-white focus:outline-none"
        >
          <UserAvatar gender={user?.gender} name={user?.name} size="sm" />
          <div className="hidden sm:flex flex-col text-left mr-1">
            <span className="text-[13px] font-semibold leading-none text-[#1F2937]">
              {user?.name ?? 'User'}
            </span>
            <span className="text-[11px] font-medium text-[#687280] mt-0.5 capitalize truncate max-w-[130px]">
              {displayRoleOrDesignation}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-[#687280] transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Profile Dropdown / Panel */}
        {open && (
          <div className="absolute right-0 mt-3 w-80 sm:w-88 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header with Gender-based Avatar */}
            <div className="flex flex-col items-center justify-center border-b border-slate-100 bg-slate-50/70 p-5 text-center">
              <UserAvatar
                gender={user?.gender}
                name={user?.name}
                size="lg"
                className="ring-4 ring-white shadow-xs"
              />
              <h3 className="mt-3 text-base font-bold text-slate-900 leading-tight">
                {user?.name ?? 'User'}
              </h3>
              <p className="mt-0.5 text-xs font-medium text-slate-500 capitalize">
                {displayRoleOrDesignation}
              </p>
            </div>

            {/* Profile Information List */}
            <div className="p-4 space-y-3 divide-y divide-slate-100/80">
              {/* Email */}
              <div className="flex items-start gap-3 pt-1">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Email
                  </span>
                  <span
                    className="block text-xs font-medium text-slate-800 truncate"
                    title={user?.email}
                  >
                    {user?.email ?? '—'}
                  </span>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3 pt-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 mt-0.5">
                  <Phone className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Phone
                  </span>
                  <span className="block text-xs font-medium text-slate-800">
                    {user?.phone ? (
                      user.phone
                    ) : (
                      <span className="text-slate-400 italic">Not provided</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Designation */}
              <div className="flex items-start gap-3 pt-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 mt-0.5">
                  <Briefcase className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Designation
                  </span>
                  <span className="block text-xs font-medium text-slate-800">
                    {user?.designation
                      ? user.designation
                      : user
                        ? (ROLE_LABELS[user.role] ?? user.role)
                        : '—'}
                  </span>
                </div>
              </div>

              {/* Gender */}
              <div className="flex items-start gap-3 pt-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 mt-0.5">
                  <UserIcon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Gender
                  </span>
                  <div className="mt-0.5">
                    {user?.gender === 'Male' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        Male
                      </span>
                    ) : user?.gender === 'Female' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-[#8B2424] border border-rose-200">
                        Female
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not specified</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="border-t border-slate-100 bg-slate-50/70 p-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setIsEditModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Dialog */}
      {isEditModalOpen && (
        <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
      )}
    </>
  );
}

export default ProfileMenu;
