'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Clock, Calendar, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Employee {
  id: string;
  full_name: string;
  role: string;
}

function formatDateLocal(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

export default function CookSchedule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);

  const [currentWeekStart, setCurrentWeekStart] = useState<string>(() => {
    return formatDateLocal(getMonday(new Date()));
  });

  function getDaysOfWeek(mondayStr: string) {
    const [y, m, d] = mondayStr.split('-').map(Number);
    const days = [];
    const shortNames = ['PON', 'UTO', 'SRE', 'ČET', 'PET', 'SUB', 'NED'];
    const dbKeys = ['pon', 'uto', 'sre', 'cet', 'pet', 'sub', 'ned'];

    for (let i = 0; i < 7; i++) {
      const curr = new Date(y, m - 1, d + i);
      const dateFormatted = curr.toLocaleDateString('sr-RS', { day: 'numeric', month: 'numeric' });
      days.push({
        key: dbKeys[i],
        shortName: shortNames[i],
        dateFormatted: dateFormatted,
        dateStr: formatDateLocal(curr)
      });
    }
    return days;
  }

  const daysOfWeek = getDaysOfWeek(currentWeekStart);

  function getWeekRangeLabel(mondayStr: string) {
    const [y, m, d] = mondayStr.split('-').map(Number);
    const monday = new Date(y, m - 1, d);
    const sunday = new Date(y, m - 1, d + 6);
    return `${monday.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })} - ${sunday.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  function changeWeek(direction: 'prev' | 'next') {
    const [y, m, d] = currentWeekStart.split('-').map(Number);
    const date = new Date(y, m - 1, d + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(formatDateLocal(date));
  }

  function getShiftBadgeStyle(shiftName: string) {
    const s = (shiftName || '').toLowerCase();
    if (s.includes('prva')) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (s.includes('druga')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (s.includes('među') || s.includes('medju')) return 'bg-violet-100 text-violet-800 border-violet-300';
    if (s.includes('slobodno')) return 'bg-slate-100 text-slate-400 border-slate-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
  }

  const fetchScheduleData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) return;

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organization_id', profile.organization_id);

    if (profilesData) {
      const filtered = profilesData.filter(p => {
        const r = (p.role || '').toLowerCase();
        return !r.includes('owner') && !r.includes('res_owner');
      });
      const empList: Employee[] = filtered.map(p => ({
        id: p.id,
        full_name: p.full_name || 'Radnik',
        role: p.role || 'Chef'
      }));
      setEmployees(empList);
    }

    const { data: schedData } = await supabase
      .from('weekly_schedules')
      .select('*')
      .eq('restaurant_id', profile.organization_id)
      .eq('week_start_date', currentWeekStart);

    if (schedData) {
      const map: Record<string, Record<string, string>> = {};
      schedData.forEach(item => {
        if (!map[item.user_id]) map[item.user_id] = {};
        map[item.user_id][item.day_of_week] = item.shift_name;
      });
      setSchedules(map);
    } else {
      setSchedules({});
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchScheduleData();
  }, [currentWeekStart]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-64 flex-col bg-slate-900 lg:flex">
        <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">K</div>
          <span className="text-base font-semibold text-white">Kitchen Hub</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link href="/cook" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
            <Clock className="h-4 w-4" /> Moja Smena
          </Link>
          <Link href="/cook/schedule" className="flex items-center gap-3 rounded-md bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white">
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
          <h1 className="text-base font-semibold text-slate-900">Raspored radnih smena</h1>
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => changeWeek('prev')} className="p-1.5 rounded bg-white text-slate-700 shadow-sm hover:bg-slate-200" title="Prethodna nedelja">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold px-3 text-slate-700">{getWeekRangeLabel(currentWeekStart)}</span>
            <button onClick={() => changeWeek('next')} className="p-1.5 rounded bg-white text-slate-700 shadow-sm hover:bg-slate-200" title="Sledeća nedelja">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Nedeljni pregled smena tima</h2>
              <p className="text-xs text-slate-500">Uvid u raspored radnika za izabranu nedelju</p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Učitavanje rasporeda...</div>
            ) : employees.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">Nema evidentiranih radnika.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-6 sticky left-0 bg-slate-50 z-10">Radnik</th>
                    {daysOfWeek.map(d => (
                      <th key={d.key} className="py-3 px-3 text-center w-36">
                        <div className="font-bold text-slate-800">{d.shortName}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{d.dateFormatted}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 sticky left-0 bg-white z-10 font-medium text-slate-900">
                        {emp.full_name}
                        <span className="block text-[10px] text-slate-400 font-normal">{emp.role}</span>
                      </td>
                      {daysOfWeek.map(d => {
                        const currentShift = schedules[emp.id]?.[d.key] || 'Slobodno';
                        return (
                          <td key={d.key} className="py-4 px-3 text-center">
                            <span className={`inline-block px-3 py-1.5 rounded-lg border text-xs font-semibold ${getShiftBadgeStyle(currentShift)}`}>
                              {currentShift}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}