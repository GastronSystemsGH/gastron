'use client';

import { useEffect, useState } from 'react';
import { getImpersonatedUserId, stopImpersonation } from '@/utils/impersonation';
import { Ghost, XCircle } from 'lucide-react';

export default function ImpersonationBanner() {
  const [impersonatedId, setImpersonatedId] = useState<string | undefined>();

  useEffect(() => {
    // Proveravamo odmah i stavljamo interval da bi reagovalo u realnom vremenu bez refresha
    setImpersonatedId(getImpersonatedUserId());
    const interval = setInterval(() => {
      setImpersonatedId(getImpersonatedUserId());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!impersonatedId) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] bg-indigo-950 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 border border-indigo-500/50">
      <div className="flex items-center gap-2 text-xs font-bold tracking-wide">
        <Ghost className="h-5 w-5 text-indigo-400 animate-pulse" />
        <div className="flex flex-col">
          <span className="text-indigo-300 text-[9px] uppercase tracking-wider">Ghost Mode aktivan</span>
          <span className="leading-tight">ID: {impersonatedId.slice(0,8)}</span>
        </div>
      </div>
      <button 
        onClick={stopImpersonation}
        className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm ml-2"
      >
        <XCircle className="h-4 w-4" />
        Završi i izađi
      </button>
    </div>
  );
}