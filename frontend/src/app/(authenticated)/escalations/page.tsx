"use client";

import EscalationsPage from "@/modules/escalations/components/EscalationsPage";

export default function Page() {
  return (
    <main className="min-h-screen bg-white p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <EscalationsPage />
      </div>
    </main>
  );
}