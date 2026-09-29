'use client';

import React, { useState } from 'react';
import { X, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { profileApi } from '../profile/profile-api';
import { UserAvatar } from '../ui/UserAvatar';
import { Button, Dropdown } from '../ui';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [designation, setDesignation] = useState(user?.designation ?? '');
  const [gender, setGender] = useState<'Male' | 'Female' | ''>(
    user?.gender === 'Male' || user?.gender === 'Female' ? user.gender : '',
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Full Name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await profileApi.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        designation: designation.trim(),
        gender: gender ? gender : undefined,
      });

      if (res && res.user) {
        updateUser(res.user);
        onClose();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update profile. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 id="edit-profile-title" className="text-base font-bold text-slate-900">
              Edit Profile
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close edit profile dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                {error}
              </div>
            )}

            {/* Avatar Live Preview */}
            <div className="flex flex-col items-center justify-center py-2 text-center">
              <UserAvatar gender={gender} name={name} size="lg" className="ring-4 ring-slate-100" />
              <span className="mt-2 text-xs font-medium text-slate-500">
                Avatar preview based on gender: {gender || 'Generic'}
              </span>
            </div>

            {/* Full Name */}
            <div>
              <label
                htmlFor="edit-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            {/* Email (Read-only) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-email" className="block text-xs font-semibold text-slate-700">
                  Email
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <Lock className="h-3 w-3" /> Read-only
                </span>
              </div>
              <input
                id="edit-email"
                type="email"
                readOnly
                disabled
                value={user?.email ?? ''}
                className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-200 bg-slate-100/70 text-slate-500 cursor-not-allowed select-none shadow-2xs"
                title="Email cannot be changed"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="edit-phone"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Phone Number
              </label>
              <input
                id="edit-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                placeholder="e.g. 9876543210"
              />
            </div>

            {/* Designation */}
            <div>
              <label
                htmlFor="edit-designation"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Designation
              </label>
              <input
                id="edit-designation"
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full h-10 px-3.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
                placeholder="e.g. Administrator"
              />
            </div>

            {/* Gender Selection */}
            <div>
              <label
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Gender
              </label>
              <Dropdown
                showArrow={false}
                value={gender}
                onChange={(val) => setGender(val as 'Male' | 'Female' | '')}
                placeholder="Select Gender"
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                ]}
                triggerClassName="w-full h-11 px-4 py-2.5 text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Avatar icon updates automatically based on selected gender.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="text-xs h-9 bg-primary hover:bg-primary-dark text-white cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;
