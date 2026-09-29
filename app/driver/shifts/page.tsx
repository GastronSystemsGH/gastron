'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Clock, Play, Square } from 'lucide-react';

export default function DriverShiftsPage() {
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchShift = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .is('clock_out', null)
      .maybeSingle();

    if (data) setActiveShift(data);
    else setActiveShift(null);

    setLoading(false);
  };

  useEffect(() => {
    fetchShift();
  }, []);

  const handleClockIn = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    const { error } = await supabase
      .from('attendance')
      .insert([{
        user_id: user.id,
        organization_id: profile?.organization_id,
        clock_in: new Date().toISOString()
      }]);

    if (error) alert('Greška: ' + error.message);
    else fetchShift();
  };

  const handleClockOut = async () => {
    if (!activeShift) return;

    const { error } = await supabase
      .from('attendance')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', activeShift.id);

    if (error) alert('Greška: ' + error.message);
    else fetchShift();
  };

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje smena...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-4 text-center">
        <h1 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
          <Clock className="h-6 w-6 text-emerald-600" /> Radne Smene Vozača
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Evidencija dolaska i odlaska sa vožnje.</p>
      </div>

      <div className="border border-slate-200 bg-white rounded-xl p-8 text-center shadow-sm space-y-6">
        <div>
          <span className="text-xs font-semibold text-slate-400 block uppercase">Trenutni status</span>
          <span className={`text-base font-bold inline-block mt-1 px-3 py-1 rounded-full ${
            activeShift ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {activeShift ? 'Smena je u toku' : 'Niste u smeni'}
          </span>
        </div>

        {activeShift ? (
          <button
            onClick={handleClockOut}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition-colors"
          >
            <Square className="h-4 w-4" /> Završi smenu (Clock Out)
          </button>
        ) : (
          <button
            onClick={handleClockIn}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <Play className="h-4 w-4" /> Započni smenu (Clock In)
          </button>
        )}
      </div>
    </div>
  );
}