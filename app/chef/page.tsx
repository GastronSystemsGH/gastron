'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Clock, Play, Square, LogOut, Calendar } from 'lucide-react';
import Link from 'next/link';
import { getImpersonatedUserId } from '@/utils/impersonation';

interface AttendanceRecord {
  id: string;
  user_id: string;
  employee_email: string;
  restaurant_id: string;
  clock_in: string;
  clock_out: string | null;
  status: 'active' | 'completed';
}

export default function ChefDashboard() {
  const [activeShift, setActiveShift] = useState<AttendanceRecord | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchChefData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Određivanje efektivnog ID-a
    const effectiveUserId = getImpersonatedUserId() || user.id;

    // Povlačimo profil efektivnog korisnika da bismo dobili pravi mejl i ime za prikaz
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', effectiveUserId)
      .single();

    setCurrentUserEmail(profile?.full_name || profile?.email || 'Chef');

    const { data } = await supabase
      .from('staff_attendance')
      .select('*')
      .eq('user_id', effectiveUserId) // TRAŽIMO SMENU EFEKTIVNOG KORISNIKA
      .eq('status', 'active')
      .single();

    setActiveShift(data || null);
    setLoading(false);
  };

  useEffect(() => {
    fetchChefData();
  }, []);

  async function handleClockIn() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const effectiveUserId = getImpersonatedUserId() || user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, email, full_name')
      .eq('id', effectiveUserId)
      .single();

    if (!profile?.organization_id) {
      alert('Greška: Korisnik nema dodeljenu organizaciju.');
      return;
    }

    // Upisujemo smenu na ime onoga koga impersoniramo
    await supabase.from('staff_attendance').insert({
      restaurant_id: profile.organization_id,
      user_id: effectiveUserId, 
      employee_email: profile.email || profile.full_name || 'Nepoznato',
      status: 'active'
    });
    
    // AUDIT LOG: Ako je ovo impersonacija, zapisujemo ko je zapravo kliknuo
    if (effectiveUserId !== user.id) {
      await supabase.from('audit_logs').insert({
        user_id: user.id, // Pravi admin ID
        action: 'IMPERSONATION_ACTION',
        restaurant_id: profile.organization_id,
        details: `Admin Clock-In za korisnika ${profile.email || effectiveUserId}`,
        location: 'Chef Panel (Impersonated)'
      });
    }

    fetchChefData();
  }

  async function handleClockOut() {
    if (!activeShift) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Završavamo smenu
    await supabase.from('staff_attendance').update({
      clock_out: new Date().toISOString(),
      status: 'completed'
    }).eq('id', activeShift.id);

    // 2. Upisujemo u Audit Log ako je ovo impersonacija
    const effectiveUserId = getImpersonatedUserId();
    if (effectiveUserId && user && effectiveUserId !== user.id) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'IMPERSONATION_ACTION',
        restaurant_id: activeShift.restaurant_id, // Čisto referenciranje objekta
        details: `Admin Clock-Out za korisnika ID: ${effectiveUserId}`,
        location: 'Chef Panel (Impersonated)'
      });
    }

    setActiveShift(null);
    fetchChefData();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-64 flex-col bg-slate-900 lg:flex">
        <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white font-bold">C</div>
          <span className="text-base font-semibold text-white">Chef Hub</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link href="/chef" className="flex items-center gap-3 rounded-md bg-amber-600 px-3 py-2.5 text-sm font-medium text-white">
            <Clock className="h-4 w-4" /> Moja Smena
          </Link>
          <Link href="/chef/schedule" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
            <Calendar className="h-4 w-4" /> Raspored Smena
          </Link>
        </nav>
        <div className="border-t border-slate-800 p-3">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
            <LogOut className="h-4 w-4" /> Odjava
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="text-base font-semibold text-slate-900">Kontrolna tabla šefa kuhinje</h1>
        </header>

        <main className="flex-1 p-6 max-w-xl">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center space-y-6">
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-4 border border-amber-100">
                <Clock className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Evidencija radnog vremena (Chef)</h2>
              <p className="text-xs text-slate-500 mt-1">{currentUserEmail}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              {activeShift ? (
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></span> Smena je u toku
                  </span>
                  <p className="text-xs text-slate-600">Prijavljeni od: <span className="font-semibold text-slate-900">{new Date(activeShift.clock_in).toLocaleTimeString('sr-RS')}</span></p>
                  
                  <button onClick={handleClockOut} className="w-full flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 transition-colors">
                    <Square className="h-4 w-4" /> Završi smenu (Clock-Out)
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                    Niste na smeni
                  </span>
                  <button onClick={handleClockIn} className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 transition-colors">
                    <Play className="h-4 w-4" /> Započni smenu (Clock-In)
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}