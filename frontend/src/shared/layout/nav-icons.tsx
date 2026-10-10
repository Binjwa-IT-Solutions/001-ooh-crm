import type { SVGProps } from 'react';

export function EmployeesNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Center person head */}
      <circle cx="12" cy="7" r="3" />
      {/* Center person body / suit & tie silhouette */}
      <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
      <path d="m10 11.5 2 3.5 2-3.5" />
      <path d="M12 15v6" />
      {/* Left person */}
      <circle cx="4" cy="9.5" r="2.2" />
      <path d="M1.5 20v-1a4.5 4.5 0 0 1 4.5-4.5" />
      {/* Right person */}
      <circle cx="20" cy="9.5" r="2.2" />
      <path d="M18 14.5a4.5 4.5 0 0 1 4.5 4.5v1" />
    </svg>
  );
}

export function InterviewsNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Top clip */}
      <rect x="8" y="2" width="8" height="4" rx="1" />
      {/* Clipboard board */}
      <path d="M16 4h2a2 2 0 0 1 2 2v6" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" />
      {/* Candidate silhouette inside clipboard */}
      <circle cx="11.5" cy="10.5" r="2.2" />
      <path d="M7 17a4.5 4.5 0 0 1 7.2-1.5" />
      <path d="M7 19.5h5" />
      {/* Check badge on bottom-right */}
      <circle cx="18" cy="18" r="3.5" />
      <path d="m16.5 18 1 1 2-2" />
    </svg>
  );
}

export function UserManagementNavIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Shield outline */}
      <path d="M12 21a11.5 11.5 0 0 1-8-9.5V5l8-3 8 3v5" />
      {/* User silhouette inside shield */}
      <circle cx="11" cy="9.5" r="2.3" />
      <path d="M6.5 16.5a4.5 4.5 0 0 1 7-1.5" />
      {/* Gear / Cog badge on bottom-right */}
      <circle cx="18.5" cy="18.5" r="1.5" />
      <path d="M18.5 15.5v1m0 4v1m-2.5-2.5h1m4 0h1m-3.2-2.2.7.7m3.4 3.4.7.7m-4.8 0 .7-.7m3.4-3.4.7-.7" />
    </svg>
  );
}
