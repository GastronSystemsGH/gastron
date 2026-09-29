'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Clock, Calendar, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getImpersonatedUserId } from '@/utils/impersonation';

interface Employee {
  id: string;
  full_name: string;
  role: string;
  sanitary_expiry?: string;
  contract_end?: string;
  contract_indeterminate?: boolean;
}

interface ShiftTemplate {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

// Validacija dokumenata
function checkDocuments(emp: any) {
  const today = new Date();
  if (!emp.sanitary_expiry) return "Nedostaje sanitarna knjižica";
  const sDate = new Date(emp.sanitary_expiry);
  const sValidUntil = new Date(sDate.setMonth(sDate.getMonth() + 6));
  if (today > sValidUntil) return "Sanitarna knjižica je istekla";
  if (!emp.contract_indeterminate && emp.contract_end) {
    if (today > new Date(emp.contract_end)) return "Ugovor je istekao";
  }
  return null;
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

export default function ChefSchedule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [schedules, setSchedules] = useState<Record<string, Record<string, string>>>({});
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const [currentWeekStart, setCurrentWeekStart] = useState<string>(() => {
    return formatDateLocal(getMonday(new Date()));
  });

  const isCook = !currentUserRole.toLowerCase().includes('owner') && !currentUserRole.toLowerCase().includes('chef');

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

    const effectiveUserId = getImpersonatedUserId() || user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', effectiveUserId)
      .single();

    if (!profile?.organization_id) return;
    setRestaurantId(profile.organization_id);
    setCurrentUserRole(profile.role || '');

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, role, sanitary_expiry, contract_end, contract_indeterminate')
      .eq('organization_id', profile.organization_id);

    if (profilesData) {
      const filtered = profilesData.filter(p => {
        const r = (p.role || '').toLowerCase();
        return !r.includes('owner') && !r.includes('res_owner');
      });
      setEmployees(filtered);
    }

    const { data: tmplData } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('restaurant_id', profile.organization_id);

    if (tmplData) setShiftTemplates(tmplData);

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

  async function handleShiftChange(userId: string, dayKey: string, shiftName: string) {
    if (isCook) {
      alert("Nemate dozvolu za izmenu rasporeda.");
      return;
    }

    const emp = employees.find(e => e.id === userId);
    if (emp && shiftName !== 'Slobodno') {
      const errorMsg = checkDocuments(emp);
      if (errorMsg) {
        alert(`Nije moguće dodati radnika u smenu: ${errorMsg}`);
        return;
      }
    }

    if (!restaurantId) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('weekly_schedules')
      .upsert({
        restaurant_id: restaurantId,
        user_id: userId,
        day_of_week: dayKey,
        week_start_date: currentWeekStart,
        shift_name: shiftName
      }, { onConflict: 'restaurant_id,user_id,day_of_week,week_start_date' });

    if (error) {
      alert('Greška pri čuvanju smene: ' + error.message);
    } else {
      setSchedules(prev => ({
        ...prev,
        [userId]: {
          ...(prev[userId] || {}),
          [dayKey]: shiftName
        }
      }));
    }
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
          <Link href="/chef" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
            <Clock className="h-4 w-4" /> Moja Smena
          </Link>
          <Link href="/chef/schedule" className="flex items-center gap-3 rounded-md bg-amber-600 px-3 py-2.5 text-sm font-medium text-white">
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
            <table className="w-full text-left border-collapse">
                {/* ... tabela ostaje ista ... */}
                {/* Samo obezbedi da select ima disabled={isCook} */}
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}