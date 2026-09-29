'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Clock, Play, Square, Users, Calendar, Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, Save } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  user_id: string;
  employee_email: string;
  clock_in: string;
  clock_out: string | null;
  status: 'active' | 'completed';
}

interface Employee {
  id: string;
  full_name: string;
  role: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
}

// Pomoćna funkcija za lokalni format YYYY-MM-DD bez UTC pomeranja
function formatDateLocal(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Pomoćna funkcija za dobijanje ponedeljka tekuće nedelje po lokalnom vremenu
function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

export default function RestaurantAttendance() {
  const [activeShift, setActiveShift] = useState<AttendanceRecord | null>(null);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Record<string, string>>>({});
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(() => {
    return formatDateLocal(getMonday(new Date()));
  });

  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());

  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [newShiftName, setNewShiftName] = useState('');
  const [newStartTime, setNewStartTime] = useState('07:00');
  const [newEndTime, setNewEndTime] = useState('15:00');

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTmplName, setEditTmplName] = useState('');
  const [editTmplStart, setEditTmplStart] = useState('');
  const [editTmplEnd, setEditTmplEnd] = useState('');

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [tempFullName, setTempFullName] = useState('');

  const isOwnerOrChef = userRole.toLowerCase().includes('owner') || userRole.toLowerCase().includes('chef') || userRole.toLowerCase().includes('res_owner');

  function getShiftBadgeStyle(shiftName: string) {
    const s = (shiftName || '').toLowerCase();
    if (s.includes('prva')) return 'bg-amber-100 text-amber-800 border-amber-300';
    if (s.includes('druga')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (s.includes('među') || s.includes('medju')) return 'bg-violet-100 text-violet-800 border-violet-300';
    if (s.includes('slobodno')) return 'bg-slate-100 text-slate-400 border-slate-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
  }

  function renderShiftDisplay(shiftValue: string) {
    if (!shiftValue || shiftValue.toLowerCase().includes('slobodno')) return 'Slobodno';
    
    let code = 'P';
    const lower = shiftValue.toLowerCase();
    if (lower.includes('druga')) code = 'D';
    else if (lower.includes('među') || lower.includes('medju')) code = 'M';
    else if (lower.includes('vanredna') || lower.includes('vanredno')) code = 'V';
    else if (lower.includes('prva')) code = 'P';
    else code = shiftValue.charAt(0).toUpperCase();

    const tmpl = shiftTemplates.find(t => shiftValue.includes(t.name) || t.name === shiftValue);
    let startH = '';
    if (tmpl && tmpl.start_time) {
      startH = tmpl.start_time.split(':')[0];
    } else {
      const match = shiftValue.match(/(\d{2}:\d{2})/);
      if (match) {
        startH = match[1].split(':')[0];
      }
    }

    return startH ? `${code} od ${startH}h` : code;
  }

  // Precizno generisanje dana u nedelji bez vremenskih pomeranja
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

  function getCalendarWeeks(year: number, month: number) {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    let startDate = new Date(firstDayOfMonth);
    let dayOfWeek = startDate.getDay();
    let diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + diffToMonday);

    const weeks = [];
    let currentWeek = [];
    let curr = new Date(startDate);

    while (curr <= lastDayOfMonth || currentWeek.length > 0) {
      const dateStr = formatDateLocal(curr);
      const jsDay = curr.getDay();
      const map: Record<number, string> = { 1: 'pon', 2: 'uto', 3: 'sre', 4: 'cet', 5: 'pet', 6: 'sub', 0: 'ned' };

      currentWeek.push({
        dateStr,
        dayNum: curr.getDate(),
        isCurrentMonth: curr.getMonth() === month,
        dayKey: map[jsDay]
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      curr.setDate(curr.getDate() + 1);
      if (curr > lastDayOfMonth && currentWeek.length === 0) break;
    }
    return weeks;
  }

  const daysOfWeek = getDaysOfWeek(currentWeekStart);
  const calendarWeeks = getCalendarWeeks(currentYear, currentMonth);

  function getWeekRangeLabel(mondayStr: string) {
    const [y, m, d] = mondayStr.split('-').map(Number);
    const monday = new Date(y, m - 1, d);
    const sunday = new Date(y, m - 1, d + 6);
    return `${monday.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })} - ${sunday.toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  function getMonthLabel(year: number, month: number) {
    const d = new Date(year, month, 1);
    return d.toLocaleDateString('sr-RS', { month: 'long', year: 'numeric' });
  }

  function changePeriod(direction: 'prev' | 'next') {
    if (viewMode === 'weekly') {
      const [y, m, d] = currentWeekStart.split('-').map(Number);
      const date = new Date(y, m - 1, d + (direction === 'next' ? 7 : -7));
      setCurrentWeekStart(formatDateLocal(date));
    } else {
      if (direction === 'next') {
        if (currentMonth === 11) {
          setCurrentMonth(0);
          setCurrentYear(prev => prev + 1);
        } else {
          setCurrentMonth(prev => prev + 1);
        }
      } else {
        if (currentMonth === 0) {
          setCurrentMonth(11);
          setCurrentYear(prev => prev - 1);
        } else {
          setCurrentMonth(prev => prev - 1);
        }
      }
    }
  }

  function getMondayFromDate(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return formatDateLocal(getMonday(new Date(y, m - 1, d)));
  }

  function formatRole(roleStr: string) {
    if (!roleStr) return 'Kuvar';
    const r = roleStr.toLowerCase();
    if (r.includes('chef') || r.includes('res_chef')) return 'Chef';
    if (r.includes('cook')) return 'Kuvar';
    return roleStr.charAt(0).toUpperCase() + roleStr.slice(1);
  }

  const fetchData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserEmail(user.email || '');

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profile) {
      setUserRole(profile.role || '');
      if (profile.organization_id) {
        setRestaurantId(profile.organization_id);

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, role, full_name')
          .eq('organization_id', profile.organization_id);

        if (profilesData) {
          const filtered = profilesData.filter(p => {
            const r = (p.role || '').toLowerCase();
            return !r.includes('owner') && !r.includes('res_owner');
          });

          const empList: Employee[] = filtered.map(p => ({
            id: p.id,
            full_name: p.full_name || 'Unesi ime...',
            role: formatRole(p.role)
          }));
          setEmployees(empList);
        }

        const { data: tmplData } = await supabase
          .from('shift_templates')
          .select('*')
          .eq('restaurant_id', profile.organization_id);

        if (tmplData && tmplData.length > 0) {
          setShiftTemplates(tmplData);
        } else {
          const defaults = [
            { restaurant_id: profile.organization_id, name: 'Prva', start_time: '07:00', end_time: '15:00' },
            { restaurant_id: profile.organization_id, name: 'Druga', start_time: '15:00', end_time: '23:00' },
            { restaurant_id: profile.organization_id, name: 'Među', start_time: '11:00', end_time: '19:00' },
            { restaurant_id: profile.organization_id, name: 'Slobodno', start_time: '-', end_time: '-' },
          ];
          await supabase.from('shift_templates').insert(defaults);
          const { data: refetch } = await supabase.from('shift_templates').select('*').eq('restaurant_id', profile.organization_id);
          if (refetch) setShiftTemplates(refetch);
        }

        const { data: schedData } = await supabase
          .from('weekly_schedules')
          .select('*')
          .eq('restaurant_id', profile.organization_id);

        if (schedData) {
          const map: Record<string, Record<string, string>> = {};
          schedData.forEach(item => {
            if (!map[item.user_id]) map[item.user_id] = {};
            
            const [y, m, d] = item.week_start_date.split('-').map(Number);
            const dayOffsets: Record<string, number> = { pon: 0, uto: 1, sre: 2, cet: 3, pet: 4, sub: 5, ned: 6 };
            const offset = dayOffsets[item.day_of_week] || 0;
            const exactDate = new Date(y, m - 1, d + offset);
            const exactDateStr = formatDateLocal(exactDate);

            map[item.user_id][exactDateStr] = item.shift_name;
            map[item.user_id][`${item.week_start_date}_${item.day_of_week}`] = item.shift_name;
          });
          setSchedules(map);
        }
      }
    }

    const { data } = await supabase.from('staff_attendance').select('*').order('clock_in', { ascending: false });
    if (data) {
      setAllRecords(data);
      const currentActive = data.find(r => r.user_id === user.id && r.status === 'active');
      setActiveShift(currentActive || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentWeekStart, currentYear, currentMonth, viewMode]);

  function handleLocalShiftChange(userId: string, dateStr: string, dayOfWeekKey: string, shiftName: string) {
    if (!isOwnerOrChef) return;
    setSchedules(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), [dateStr]: shiftName, [`${currentWeekStart}_${dayOfWeekKey}`]: shiftName }
    }));
  }

  async function handleSaveSchedule() {
    if (!restaurantId || !isOwnerOrChef) return;
    const supabase = createClient();
    const upsertData = [];

    for (const [userId, daysMap] of Object.entries(schedules)) {
      for (const [key, shiftName] of Object.entries(daysMap)) {
        if (key.includes('_')) {
          const [wStart, dKey] = key.split('_');
          upsertData.push({
            restaurant_id: restaurantId,
            user_id: userId,
            day_of_week: dKey,
            week_start_date: wStart,
            shift_name: shiftName
          });
        }
      }
    }

    const { error } = await supabase
      .from('weekly_schedules')
      .upsert(upsertData, { onConflict: 'restaurant_id,user_id,day_of_week,week_start_date' });

    if (error) {
      alert('Greška pri čuvanju rasporeda: ' + error.message);
    } else {
      alert('Raspored je uspešno sačuvan! Kolege sada vide ažurirane smene.');
      fetchData();
    }
  }

  async function handleAddShiftTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newShiftName.trim() || !restaurantId) return;
    const supabase = createClient();
    const { data, error } = await supabase.from('shift_templates').insert({
      restaurant_id: restaurantId,
      name: newShiftName.trim(),
      start_time: newStartTime,
      end_time: newEndTime
    }).select().single();

    if (error) alert('Greška: ' + error.message);
    else if (data) {
      setShiftTemplates(prev => [...prev, data]);
      setNewShiftName('');
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Obrisati ovu smenu?')) return;
    const supabase = createClient();
    await supabase.from('shift_templates').delete().eq('id', id);
    setShiftTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function handleSaveTemplateEdit(id: string) {
    const supabase = createClient();
    await supabase.from('shift_templates').update({
      name: editTmplName,
      start_time: editTmplStart,
      end_time: editTmplEnd
    }).eq('id', id);
    setShiftTemplates(prev => prev.map(t => t.id === id ? { ...t, name: editTmplName, start_time: editTmplStart, end_time: editTmplEnd } : t));
    setEditingTemplateId(null);
  }

  async function handleSaveEmployeeName(userId: string) {
    const supabase = createClient();
    await supabase.from('profiles').update({ full_name: tempFullName }).eq('id', userId);
    setEmployees(prev => prev.map(e => e.id === userId ? { ...e, full_name: tempFullName } : e));
    setEditingEmployeeId(null);
  }

  const activeStaffCount = allRecords.filter(r => r.status === 'active').length;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <h1 className="text-base font-semibold text-slate-900">Upravljanje smenama i rasporedom</h1>
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          <Users className="h-4 w-4 text-emerald-600" /> Aktivnih na smeni: <span className="font-bold text-slate-900">{activeStaffCount}</span>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-6">
        {isOwnerOrChef && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Definisanje šablona smena (Satnice i boje)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {shiftTemplates.map(tmpl => {
                const isEditing = editingTemplateId === tmpl.id;
                return (
                  <div key={tmpl.id} className={`rounded-lg border p-3 space-y-2 ${getShiftBadgeStyle(tmpl.name)}`}>
                    {isEditing ? (
                      <div className="space-y-2">
                        <input type="text" value={editTmplName} onChange={e => setEditTmplName(e.target.value)} className="w-full rounded border px-2 py-1 text-xs bg-white text-slate-900" placeholder="Naziv" />
                        <div className="flex gap-1">
                          <input type="text" value={editTmplStart} onChange={e => setEditTmplStart(e.target.value)} className="w-full rounded border px-1 py-1 text-xs bg-white text-center text-slate-900" placeholder="Od" />
                          <input type="text" value={editTmplEnd} onChange={e => setEditTmplEnd(e.target.value)} className="w-full rounded border px-1 py-1 text-xs bg-white text-center text-slate-900" placeholder="Do" />
                        </div>
                        <div className="flex justify-end gap-1 pt-1">
                          <button onClick={() => handleSaveTemplateEdit(tmpl.id)} className="p-1 rounded bg-emerald-600 text-white"><Check className="h-3 w-3" /></button>
                          <button onClick={() => setEditingTemplateId(null)} className="p-1 rounded bg-slate-200 text-slate-700"><X className="h-3 w-3" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-xs">{tmpl.name}</p>
                          <p className="text-[11px] opacity-80">{tmpl.start_time} - {tmpl.end_time}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditingTemplateId(tmpl.id); setEditTmplName(tmpl.name); setEditTmplStart(tmpl.start_time); setEditTmplEnd(tmpl.end_time); }} className="p-1 opacity-70 hover:opacity-100">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {tmpl.name !== 'Slobodno' && (
                            <button onClick={() => handleDeleteTemplate(tmpl.id)} className="p-1 opacity-70 hover:opacity-100 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleAddShiftTemplate} className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
              <input type="text" placeholder="Naziv smene" value={newShiftName} onChange={e => setNewShiftName(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600" required />
              <div className="flex items-center gap-1 text-xs">
                <span>Od:</span>
                <input type="text" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} className="w-16 rounded border px-2 py-1 text-center" placeholder="07:00" />
                <span>Do:</span>
                <input type="text" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} className="w-16 rounded border px-2 py-1 text-center" placeholder="15:00" />
              </div>
              <button type="submit" className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                <Plus className="h-3.5 w-3.5" /> Dodaj novu smenu
              </button>
            </form>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Raspored: <span className="text-emerald-700">{viewMode === 'weekly' ? getWeekRangeLabel(currentWeekStart) : getMonthLabel(currentYear, currentMonth)}</span>
                </h2>
                <p className="text-xs text-slate-500">{isOwnerOrChef ? 'Kreirajte i sačuvajte raspored za tim' : 'Pregled vašeg rasporeda'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isOwnerOrChef && (
                <button
                  onClick={handleSaveSchedule}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                >
                  <Save className="h-4 w-4" /> Sačuvaj raspored
                </button>
              )}

              <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                <button onClick={() => setViewMode('weekly')} className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'weekly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>Nedeljni</button>
                <button onClick={() => setViewMode('monthly')} className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>Mesečni</button>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => changePeriod('prev')} className="p-1.5 rounded bg-white text-slate-700 shadow-sm hover:bg-slate-200" title="Prethodni period">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => changePeriod('next')} className="p-1.5 rounded bg-white text-slate-700 shadow-sm hover:bg-slate-200" title="Sledeći period">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Učitavanje...</div>
          ) : employees.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">Nema evidentiranih radnika.</div>
          ) : viewMode === 'weekly' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-6 sticky left-0 bg-slate-50 z-10">Radnik</th>
                    {daysOfWeek.map(d => (
                      <th key={d.key} className="py-3 px-3 text-center w-40">
                        <div className="font-bold text-slate-800">{d.shortName}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{d.dateFormatted}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {employees.map(emp => {
                    const isEditingName = editingEmployeeId === emp.id;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50">
                        <td className="py-4 px-6 sticky left-0 bg-white z-10 shadow-r">
                          {isEditingName && isOwnerOrChef ? (
                            <div className="flex items-center gap-1">
                              <input type="text" value={tempFullName} onChange={e => setTempFullName(e.target.value)} className="rounded border px-2 py-1 text-xs bg-white" autoFocus />
                              <button onClick={() => handleSaveEmployeeName(emp.id)} className="p-1 rounded bg-emerald-600 text-white"><Check className="h-3 w-3" /></button>
                              <button onClick={() => setEditingEmployeeId(null)} className="p-1 rounded bg-slate-200"><X className="h-3 w-3" /></button>
                            </div>
                          ) : (
                            <div className="group cursor-pointer" onClick={() => { if (isOwnerOrChef) { setEditingEmployeeId(emp.id); setTempFullName(emp.full_name.startsWith('Unesi') ? '' : emp.full_name); } }}>
                              <p className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center gap-1">
                                {emp.full_name} {isOwnerOrChef && <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-400" />}
                              </p>
                              <p className="text-[11px] font-normal text-slate-400 uppercase tracking-wide">{emp.role}</p>
                            </div>
                          )}
                        </td>

                        {daysOfWeek.map(d => {
                          const currentShift = schedules[emp.id]?.[d.dateStr] || schedules[emp.id]?.[`${currentWeekStart}_${d.key}`] || 'Slobodno';
                          const formattedDisplay = renderShiftDisplay(currentShift);

                          return (
                            <td key={d.key} className="py-4 px-3 text-center">
                              {isOwnerOrChef ? (
                                <select
                                  value={currentShift}
                                  onChange={(e) => {
                                    if (e.target.value === 'custom_hours') {
                                      const custom = prompt('Unesite vanredno vreme (npr. 12:00 - 16:00):');
                                      if (custom) handleLocalShiftChange(emp.id, d.dateStr, d.key, custom);
                                    } else {
                                      handleLocalShiftChange(emp.id, d.dateStr, d.key, e.target.value);
                                    }
                                  }}
                                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 ${getShiftBadgeStyle(currentShift)}`}
                                >
                                  {shiftTemplates.map(tmpl => (
                                    <option key={tmpl.id} value={`${tmpl.name} (${tmpl.start_time}-${tmpl.end_time})`}>
                                      {tmpl.name} ({tmpl.start_time}-{tmpl.end_time})
                                    </option>
                                  ))}
                                  <option value="Slobodno">Slobodno</option>
                                  <option value="custom_hours">⚡ Vanredna satnica...</option>
                                </select>
                              ) : (
                                <span className={`inline-block px-3 py-1.5 rounded-lg border text-xs font-semibold ${getShiftBadgeStyle(currentShift)}`}>
                                  {formattedDisplay}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-7 gap-2 text-center font-semibold text-xs text-slate-600 uppercase border-b border-slate-200 pb-3">
                <div>PON</div>
                <div>UTO</div>
                <div>SRE</div>
                <div>ČET</div>
                <div>PET</div>
                <div>SUB</div>
                <div>NED</div>
              </div>

              <div className="space-y-2">
                {calendarWeeks.map((week, wIdx) => (
                  <div key={wIdx} className="grid grid-cols-7 gap-2">
                    {week.map(day => {
                      return (
                        <div key={day.dateStr} className={`min-h-[130px] rounded-xl border p-2.5 flex flex-col justify-between ${day.isCurrentMonth ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-slate-100 opacity-50'}`}>
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-800">{day.dayNum}.</span>
                            <span className="text-[10px] uppercase font-mono text-slate-400">{day.dayKey}</span>
                          </div>

                          <div className="space-y-1.5 overflow-y-auto max-h-[100px] pt-1">
                            {employees.map(emp => {
                              const weekStart = getMondayFromDate(day.dateStr);
                              const shift = schedules[emp.id]?.[day.dateStr] || schedules[emp.id]?.[`${weekStart}_${day.dayKey}`] || 'Slobodno';
                              if (shift.toLowerCase().includes('slobodno')) return null;

                              return (
                                <div key={emp.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${getShiftBadgeStyle(shift)}`} title={`${emp.full_name}: ${shift}`}>
                                  <span className="font-bold">{emp.full_name.split(' ')[0]}:</span> {renderShiftDisplay(shift)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}