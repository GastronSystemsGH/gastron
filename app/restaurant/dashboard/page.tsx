'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { DollarSign, Clock, Users, Bell, Utensils, TrendingUp, AlertTriangle, Settings, Play, Square, Lock } from 'lucide-react';

export default function RestaurantDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isChef, setIsChef] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  
  const [spendingFilter, setSpendingFilter] = useState<'last_3_days' | 'last_7_days' | 'this_week' | 'this_month' | 'last_month' | 'last_6_months' | 'last_year'>('this_month');
  const [maxWeeklyHoursLimit, setMaxWeeklyHoursLimit] = useState<number>(160);
  const [editingMaxHours, setEditingMaxHours] = useState(false);
  const [tempMaxHours, setTempMaxHours] = useState('160');

  const [orders, setOrders] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [schedulesList, setSchedulesList] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role, full_name, email')
        .eq('id', user.id)
        .single();

      if (!profile || !profile.organization_id) {
        setLoading(false);
        return;
      }

      setCurrentUserName(profile.full_name || profile.email || 'Korisnik');
      const roleStr = (profile.role || '').toLowerCase();
      const ownerCheck = roleStr.includes('owner') || roleStr.includes('res_owner');
      const chefCheck = roleStr.includes('chef') || roleStr.includes('res_chef');
      
      setIsOwner(ownerCheck);
      setIsChef(chefCheck);

      const { data: profs } = await supabase.from('profiles').select('*').eq('organization_id', profile.organization_id);
      if (profs) setProfilesList(profs);

      const { data: scheds } = await supabase.from('weekly_schedules').select('*').eq('restaurant_id', profile.organization_id);
      if (scheds) setSchedulesList(scheds);

      const { data: attData } = await supabase.from('staff_attendance').select('*').order('clock_in', { ascending: false });
      if (attData) setAttendanceRecords(attData);

      const { data: recipeData } = await supabase.from('recipes').select('*, recipe_items(*, products(*))');
      if (recipeData) setRecipes(recipeData);

      const { data: prodData } = await supabase.from('products').select('*');
      if (prodData) setProducts(prodData);

      const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (orderData) setOrders(orderData);

      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Učitavanje dashboard-a...</div>;
  }

  // --- LOGIKA ZA DOKUMENTE (ISPRAVLJENO NA 15 DANA) ---
  const today = new Date();
  const docAlerts = profilesList.map(emp => {
    const alerts = [];
    const roleStr = (emp.role || '').toLowerCase();
    const isEmpOwner = roleStr.includes('owner') || roleStr.includes('res_owner');

    // 1. Sanitarna (važi 6 meseci od datuma unosa u sanitary_expiry_date)
    // Owneri su isključeni iz ove provere
    if (!isEmpOwner) {
      if (emp.sanitary_expiry_date) {
        const sDate = new Date(emp.sanitary_expiry_date);
        const validUntil = new Date(sDate.getFullYear(), sDate.getMonth() + 6, sDate.getDate());
        
        // Prag od 15 dana
        const fifteenDaysBefore = new Date(validUntil);
        fifteenDaysBefore.setDate(fifteenDaysBefore.getDate() - 15);

        if (today > validUntil) alerts.push({ text: `Sanitarna knjižica istekla!`, type: 'error' });
        else if (today >= fifteenDaysBefore) alerts.push({ text: `Sanitarna knjižica ističe za manje od 15 dana (${validUntil.toLocaleDateString()})`, type: 'warning' });
      } else {
        alerts.push({ text: `Nije uneta sanitarna knjižica!`, type: 'error' });
      }
    }

    // 2. Ugovor (Svi zaposleni)
    if (!emp.contract_indeterminate && emp.contract_end) {
      const contractDate = new Date(emp.contract_end);
      const twoWeeksBefore = new Date(contractDate);
      twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 14);

      if (today > contractDate) alerts.push({ text: `Ugovor istekao!`, type: 'error' });
      else if (today >= twoWeeksBefore) alerts.push({ text: `Ugovor ističe (${contractDate.toLocaleDateString()})`, type: 'warning' });
    }
    return alerts.map(a => ({ ...a, name: emp.full_name || 'Radnik' }));
  }).flat();
  // --- KRAJ LOGIKE ZA DOKUMENTE ---

  const nowFilter = new Date();
  const filteredOrders = orders.filter(o => {
    const oDate = new Date(o.created_at);
    const diffDays = (nowFilter.getTime() - oDate.getTime()) / (1000 * 3600 * 24);
    if (spendingFilter === 'last_3_days') return diffDays <= 3;
    if (spendingFilter === 'last_7_days') return diffDays <= 7;
    if (spendingFilter === 'this_week') return diffDays <= 7;
    if (spendingFilter === 'this_month') return oDate.getMonth() === nowFilter.getMonth() && oDate.getFullYear() === nowFilter.getFullYear();
    if (spendingFilter === 'last_month') return oDate.getMonth() === nowFilter.getMonth() - 1;
    if (spendingFilter === 'last_6_months') return diffDays <= 180;
    if (spendingFilter === 'last_year') return diffDays <= 365;
    return true;
  });

  const totalSpending = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const spendingByCategory: Record<string, number> = {};
  filteredOrders.forEach(o => {
    o.items?.forEach((item: any) => {
      const cat = 'Namirnice / Ostalo';
      spendingByCategory[cat] = (spendingByCategory[cat] || 0) + ((item.price || 0) * (item.qty || item.quantity || 1));
    });
  });

  const startOfWeek = new Date();
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0,0,0,0);

  const weeklyAttendance = attendanceRecords.filter(r => new Date(r.clock_in) >= startOfWeek);
  const staffWeeklyHoursMap: Record<string, number> = {};
  weeklyAttendance.forEach(r => {
    if (!r.clock_out) return;
    const hours = (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / (1000 * 3600);
    if (hours > 0) {
      staffWeeklyHoursMap[r.user_id] = (staffWeeklyHoursMap[r.user_id] || 0) + hours;
    }
  });

  const totalWeeklyHours = Object.values(staffWeeklyHoursMap).reduce((a, b) => a + b, 0);
  const isWeeklyHoursExceeded = totalWeeklyHours > maxWeeklyHoursLimit;

  function formatHoursAndMinutes(decimalHours: number) {
    const totalMinutes = Math.round(decimalHours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins}m`;
  }

  const staffListForHours = profilesList.filter(p => !((p.role || '').toLowerCase().includes('owner') || (p.role || '').toLowerCase().includes('res_owner')));

  const todayDateStr = new Date().toDateString();
  const todayDayOfWeekJs = new Date().getDay();
  const mapJsToKey: Record<number, string> = { 1: 'pon', 2: 'uto', 3: 'sre', 4: 'cet', 5: 'pet', 6: 'sub', 0: 'ned' };
  const todayKey = mapJsToKey[todayDayOfWeekJs];

  const todayStaffMap = new Map();
  profilesList.forEach(emp => {
    const r = (emp.role || '').toLowerCase();
    if (r.includes('owner') || r.includes('res_owner')) return;

    const sched = schedulesList.find(s => s.user_id === emp.id && s.day_of_week === todayKey);
    const activeRec = attendanceRecords.find(r => r.user_id === emp.id && r.status === 'active');
    const todayRecs = attendanceRecords.filter(r => {
      if (r.user_id !== emp.id || !r.clock_in) return false;
      return new Date(r.clock_in).toDateString() === todayDateStr;
    });
    const completedRec = todayRecs.find(r => r.status === 'completed');

    const isScheduled = !!sched;
    const shiftName = sched ? sched.shift_name : 'Slobodan dan / Nije na rasporedu';

    let state: 'not_present' | 'present' | 'checked_out' = 'not_present';
    let recordId = null;
    if (activeRec) {
      state = 'present';
      recordId = activeRec.id;
    } else if (completedRec) {
      state = 'checked_out';
      recordId = completedRec.id;
    }

    if (isScheduled || activeRec || todayRecs.length > 0) {
      todayStaffMap.set(emp.id, { emp, shiftName, isScheduled, state, recordId });
    }
  });

  const staffStatusList = Array.from(todayStaffMap.values());
  const activeStaffCount = staffStatusList.filter(s => s.state === 'present').length;

  async function handleProxyClockIn(targetUserId: string) {
    const nowISO = new Date().toISOString();
    const { error } = await supabase.from('staff_attendance').insert({
      user_id: targetUserId,
      employee_email: '',
      clock_in: nowISO,
      status: 'active'
    });
    if (error) alert('Greška: ' + error.message);
    else window.location.reload();
  }

  async function handleProxyClockOut(recordId: string) {
    const nowISO = new Date().toISOString();
    const { error } = await supabase.from('staff_attendance').update({
      clock_out: nowISO,
      status: 'completed'
    }).eq('id', recordId);
    if (error) alert('Greška: ' + error.message);
    else window.location.reload();
  }

  const recipesExceedingFoodCost = recipes.filter(recipe => {
    const totalCost = recipe.recipe_items?.reduce((s: number, ri: any) => s + ((ri.products?.price || 0) * ri.quantity), 0) || 0;
    const selling = recipe.selling_price || 0;
    if (selling === 0) return false;
    const fc = (totalCost / selling) * 100;
    const customLimit = recipe.target_food_cost ?? 33;
    return fc > customLimit;
  });

  return (
    <main className="flex-1 p-6 space-y-6 bg-slate-50/50">
      <div className="border-b pb-4">
        <h1 className="text-lg font-bold text-slate-900">Dashboard upravljanja restoranom</h1>
        <p className="text-xs text-slate-500 mt-0.5">Pregled finansija, radnih sati, smena i kuhinjskih alerta.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">Troškovi nabavke</h2>
            </div>
            <select
              value={spendingFilter}
              onChange={(e) => setSpendingFilter(e.target.value as any)}
              className="rounded border border-slate-300 px-2 py-1 text-xs bg-white text-slate-900 font-medium focus:outline-none"
            >
              <option value="last_3_days">Poslednja 3 dana</option>
              <option value="last_7_days">Poslednjih 7 dana</option>
              <option value="this_week">Ova nedelja</option>
              <option value="this_month">Ovaj mesec</option>
              <option value="last_month">Prošli mesec</option>
              <option value="last_6_months">Poslednjih 6 meseci</option>
              <option value="last_year">Prošla godina</option>
            </select>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{totalSpending.toLocaleString('sr-RS')} RSD</p>
            <p className="text-xs text-slate-500 mt-0.5">Ukupno potrošeno za izabrani period</p>
          </div>
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <p className="text-xs font-semibold text-slate-700">Po kategorijama:</p>
            {Object.entries(spendingByCategory).length === 0 ? (
              <p className="text-xs text-slate-400">Nema podataka o nabavci.</p>
            ) : (
              Object.entries(spendingByCategory).map(([cat, amt]) => (
                <div key={cat} className="flex justify-between text-xs">
                  <span className="text-slate-600">{cat}:</span>
                  <span className="font-bold text-slate-800">{amt.toLocaleString('sr-RS')} RSD</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">Radni sati (Ova nedelja)</h2>
            </div>
            {isOwner && (
              <button
                onClick={() => setEditingMaxHours(!editingMaxHours)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                title="Podesi max limit sati"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>
          {editingMaxHours && isOwner && (
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border text-xs">
              <span className="text-slate-600">Max limit (h):</span>
              <input
                type="number"
                value={tempMaxHours}
                onChange={e => setTempMaxHours(e.target.value)}
                className="w-16 rounded border px-2 py-1 bg-white text-slate-900 text-center font-bold"
              />
              <button
                onClick={() => {
                  setMaxWeeklyHoursLimit(parseFloat(tempMaxHours) || 160);
                  setEditingMaxHours(false);
                }}
                className="rounded bg-emerald-600 px-2.5 py-1 text-white font-semibold"
              >
                OK
              </button>
            </div>
          )}
          <div>
            <p className={`text-2xl font-bold ${isWeeklyHoursExceeded ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatHoursAndMinutes(totalWeeklyHours)} <span className="text-xs font-normal text-slate-400">/ max {maxWeeklyHoursLimit}h</span>
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 space-y-1.5 max-h-36 overflow-y-auto">
            <div className="grid grid-cols-3 text-[10px] font-semibold uppercase text-slate-400 tracking-wider pb-1 border-b">
              <span>Radnik</span>
              <span className="text-center">Ukupno sati</span>
              <span className="text-right">Prekovremeno</span>
            </div>
            {staffListForHours.map(emp => {
              const empHours = staffWeeklyHoursMap[emp.id] || 0;
              const workingDaysPerWeek = emp.working_days_per_week || emp.work_days || 5; 
              const agreedWeeklyHoursLimit = workingDaysPerWeek * 8;
              const overtimeHours = Math.max(0, empHours - agreedWeeklyHoursLimit);
              return (
                <div key={emp.id} className="grid grid-cols-3 items-center text-xs bg-slate-50 px-2 py-1.5 rounded border border-slate-100">
                  <span className="font-medium text-slate-800 truncate pr-1">{emp.full_name || emp.email}</span>
                  <span className="font-mono font-bold text-slate-900 text-center">{formatHoursAndMinutes(empHours)}</span>
                  <span className={`font-mono text-right font-semibold ${overtimeHours > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {overtimeHours > 0 ? `+${formatHoursAndMinutes(overtimeHours)}` : '0h 0m'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Danas u smeni ({activeStaffCount} aktivnih)</h2>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {staffStatusList.map(({ emp, shiftName, isScheduled, state, recordId }) => (
              <div key={emp.id} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-800">{emp.full_name || emp.email}</p>
                  <p className="text-[11px] text-slate-500">Smena: {shiftName}</p>
                </div>
                <div>
                  {state === 'present' ? (
                    <button onClick={() => handleProxyClockOut(recordId!)} className="flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-500">
                      <Square className="h-3 w-3" /> Odjavi
                    </button>
                  ) : (
                    <button onClick={() => handleProxyClockIn(emp.id)} className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500">
                      <Play className="h-3 w-3" /> Prijavi
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-900">Kuhinjski centar obaveštenja</h2>
          </div>

          <div className="space-y-3">
            {docAlerts.map((alert, idx) => (
              <div key={idx} className={`flex items-center gap-3 text-xs ${alert.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'} border p-3 rounded-lg`}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{alert.text}</p>
                  <p className="text-[11px] opacity-80">Zaposleni: {alert.name}</p>
                </div>
              </div>
            ))}
            {recipesExceedingFoodCost.map(recipe => {
              const totalCost = recipe.recipe_items?.reduce((s: number, ri: any) => s + ((ri.products?.price || 0) * ri.quantity), 0) || 0;
              const fc = recipe.selling_price ? (totalCost / recipe.selling_price) * 100 : 0;
              const customLimit = recipe.target_food_cost ?? 33;
              return (
                <div key={recipe.id} className="flex items-center gap-3 text-xs bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-900">
                  <Utensils className="h-4 w-4 text-rose-600 shrink-0" />
                  <div>
                    <p className="font-semibold">Food Cost prešao limit ({customLimit}%): {recipe.name}</p>
                    <p className="text-[11px] opacity-80">Trenutni Food Cost je <span className="font-bold text-rose-700">{fc.toFixed(1)}%</span></p>
                  </div>
                </div>
              );
            })}
            {docAlerts.length === 0 && recipesExceedingFoodCost.length === 0 && (
              <p className="text-xs text-slate-400">Nema aktivnih kuhinjskih upozorenja.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Praćenje kretanja cena</h2>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {products.slice(0, 5).map(prod => (
              <div key={prod.id} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <p className="font-medium text-slate-900">{prod.name}</p>
                <span className="font-bold text-slate-900 font-mono">{prod.price} RSD</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}