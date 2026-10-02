'use client';

import React from 'react';
import { User } from 'lucide-react';

export interface UserAvatarProps {
  gender?: 'Male' | 'Female' | string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-20 w-20 text-2xl',
};

const iconPaddingClasses = {
  sm: 'p-1',
  md: 'p-1.5',
  lg: 'p-2.5',
  xl: 'p-3',
};

/**
 * Male Avatar Icon SVG:
 * Short cropped hair, ears, face contour, collared shoulders.
 */
function MaleAvatarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Short styled hair and face outline */}
      <path d="M7.5 7.5C7.5 5 9.5 3 12 3s4.5 2 4.5 4.5v1.5a4.5 4.5 0 0 1-9 0V7.5z" />
      {/* Hair parting detail */}
      <path
        d="M8 6.5c1-2 3-2.5 4.5-2.5 2 0 3.5.5 4 2.5-1.5-.7-3-.8-4.5-.6-1.5.2-2.8.6-4 .6z"
        fill="currentColor"
        fillOpacity="0.25"
      />
      {/* Neck & collared shoulders */}
      <path d="M4 20.5v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1" />
      {/* V-neck / shirt collar */}
      <path d="M10 14.5l2 2.5 2-2.5" />
    </svg>
  );
}

/**
 * Female Avatar Icon SVG:
 * Styled curved hair framing the face, neck, and curved collar shoulders.
 */
function FemaleAvatarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Hair silhouette framing face */}
      <path
        d="M7 8.5c0-3.5 2.2-5.5 5-5.5s5 2 5 5.5v3.5c0 2-.8 3-1.8 3.5.8-2 1-3.5.5-5-.7-.2-1.5-.5-2.2-.5-.8 0-1.5.3-2.2.5-.5 1.5-.3 3 .5 5-1-.5-1.8-1.5-1.8-3.5v-3.5z"
        fill="currentColor"
        fillOpacity="0.25"
      />
      {/* Face oval */}
      <ellipse cx="12" cy="9" rx="3.5" ry="4" />
      {/* Neck & shoulders */}
      <path d="M4.5 20.5v-1a7 7 0 0 1 7-6.5h1a7 7 0 0 1 7 6.5v1" />
      {/* Curved scoop collar */}
      <path d="M10 14.5c.6.8 1.3 1.2 2 1.2s1.4-.4 2-1.2" />
    </svg>
  );
}

export function UserAvatar({ gender, name, size = 'sm', className = '' }: UserAvatarProps) {
  const normalizedGender =
    typeof gender === 'string'
      ? gender.trim().toLowerCase() === 'male'
        ? 'Male'
        : gender.trim().toLowerCase() === 'female'
          ? 'Female'
          : null
      : null;

  const sizeClass = sizeClasses[size] ?? sizeClasses.sm;
  const paddingClass = iconPaddingClasses[size] ?? iconPaddingClasses.sm;

  if (normalizedGender === 'Male') {
    return (
      <div
        className={`flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-[#EBF3FC] text-[#1E56A0] border border-[#CDE0F7] shadow-2xs ${sizeClass} ${className}`}
        title={name ? `${name} (Male)` : 'Male Avatar'}
        aria-label={name ? `${name} (Male)` : 'Male Avatar'}
      >
        <MaleAvatarIcon className={`w-full h-full ${paddingClass}`} />
      </div>
    );
  }

  if (normalizedGender === 'Female') {
    return (
      <div
        className={`flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-[#FFF0F0] text-[#8B2424] border border-[#F9DADA] shadow-2xs ${sizeClass} ${className}`}
        title={name ? `${name} (Female)` : 'Female Avatar'}
        aria-label={name ? `${name} (Female)` : 'Female Avatar'}
      >
        <FemaleAvatarIcon className={`w-full h-full ${paddingClass}`} />
      </div>
    );
  }

  // Default / Generic avatar for users without specified gender
  return (
    <div
      className={`flex items-center justify-center rounded-full overflow-hidden shrink-0 bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs ${sizeClass} ${className}`}
      title={name ?? 'User Avatar'}
      aria-label={name ?? 'User Avatar'}
    >
      <User className={`w-full h-full ${paddingClass}`} />
    </div>
  );
}

export default UserAvatar;
