import type { ReactNode } from 'react';

/**
 * The framed card used by the public auth screens (forgot / reset password),
 * matching the look of the login page.
 */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center md:justify-end bg-cover bg-center px-4 sm:px-12 lg:px-24 xl:px-32 py-12"
      style={{ backgroundImage: "url('/bglogin.png?v=2')" }}
    >
      <div className="w-full max-w-lg bg-[#e6ddcd] p-3 sm:p-4 rounded-[2.5rem] shadow-2xl">
        <div className="bg-white rounded-[2rem] p-8 sm:p-10 w-full">
          <div className="text-center mb-8">
            <img src="/logo.png?v=4" alt="Media Octus" className="h-16 mx-auto object-contain" />
            <p className="text-sm font-bold tracking-tight text-[#6a1b21] mt-3">Employee Portal</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

export const authInputClass =
  'w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-slate-500 focus:outline-none focus:ring-2 bg-white text-slate-900';

export const authButtonClass =
  'w-full flex items-center justify-center gap-2 bg-[#6a1b21] hover:bg-[#521318] text-white font-semibold py-3.5 px-4 rounded-xl transition-colors duration-200 disabled:opacity-70';
