'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { DollarSign, Users, Calculator, Check, FileText, Calendar, ToggleLeft, ToggleRight } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
  role: string;
  email: string;
}

interface SalaryRecord {
  id?: string;
  user_id: string;
  agreed_salary: number;
  agreed_days_per_week: number;
  hourly_rate: number;
  overtime_coefficient: number;
  holiday_coefficient: number;
}

function getOrthodoxEaster(year: number) {
  const r1 = year % 4;
  const r2 = year % 7;
  const r3 = year % 19;
  const r4 = (19 * r3 + 15) % 30;
  const r5 = (2 * r1 + 4 * r2 + 6 * r4 + 6) % 7;
  const daysAfterMarch23 = r4 + r5;
  const totalDaysFromMarch1 = 22 + daysAfterMarch23 + 13;
  return new Date(year, 2, totalDaysFromMarch1);
}

function isDefaultSerbianHoliday(dateStr: string) {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const day = parseInt(dayStr);

  if ((month === 1 && (day === 1 || day === 2)) ||
      (month === 2 && (day === 15 || day === 16)) ||
      (month === 5 && (day === 1 || day === 2)) ||
      (month === 11 && (day === 11))) {
    return true;
  }

  const easter = getOrthodoxEaster(year);
  const easterTime = easter.getTime();
  const targetTime = new Date(year, month - 1, day).getTime();
  const diffDays = (targetTime - easterTime) / (1000 * 3600 * 24);

  if (diffDays >= -2 && diffDays <= 1) {
    return true;
  }

  return false;
}

export default function RestaurantSalaries() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<Record<string, SalaryRecord>>({});
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [restaurantOrgId, setRestaurantOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [globalOvertime, setGlobalOvertime] = useState<number>(1.26);
  const [globalHoliday, setGlobalHoliday] = useState<number>(2.0);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [holidayOverrides, setHolidayOverrides] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profile?.organization_id) {
      setRestaurantOrgId(profile.organization_id);

      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (profs) {
        const staff = profs.filter(p => !((p.role || '').toLowerCase().includes('owner') || (p.role || '').toLowerCase().includes('res_owner')));
        setEmployees(staff);
      }

      const { data: salData } = await supabase
        .from('employee_salaries')
        .select('*')
        .eq('restaurant_id', profile.organization_id);

      if (salData) {
        const map: Record<string, SalaryRecord> = {};
        salData.forEach(s => {
          map[s.user_id] = s;
          if (s.overtime_coefficient) setGlobalOvertime(s.overtime_coefficient);
          if (s.holiday_coefficient) setGlobalHoliday(s.holiday_coefficient);
        });
        setSalaries(map);
      }

      const { data: attData } = await supabase.from('staff_attendance').select('*');
      if (attData) setAttendanceRecords(attData);

      const { data: holData } = await supabase
        .from('holiday_overrides')
        .select('*')
        .eq('restaurant_id', profile.organization_id);

      if (holData) {
        const hMap: Record<string, boolean> = {};
        holData.forEach(h => {
          hMap[h.date] = h.is_holiday;
        });
        setHolidayOverrides(hMap);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function handleToggleHoliday(dateStr: string) {
    if (!restaurantOrgId) return;
    const currentStatus = isDayHoliday(dateStr);
    const newStatus = !currentStatus;

    const supabase = createClient();
    await supabase.from('holiday_overrides').upsert({
      restaurant_id: restaurantOrgId,
      date: dateStr,
      is_holiday: newStatus
    }, { onConflict: 'restaurant_id,date' });

    setHolidayOverrides(prev => ({ ...prev, [dateStr]: newStatus }));
  }

  function isDayHoliday(dateStr: string) {
    if (holidayOverrides[dateStr] !== undefined) {
      return holidayOverrides[dateStr];
    }
    return isDefaultSerbianHoliday(dateStr);
  }

  async function handleSaveSalary(userId: string, salary: number, days: number) {
    if (!restaurantOrgId) return;
    const monthlyHours = days * 4.33 * 8;
    const hourlyRate = monthlyHours > 0 ? salary / monthlyHours : 0;

    const supabase = createClient();
    const payload = {
      restaurant_id: restaurantOrgId,
      user_id: userId,
      agreed_salary: salary,
      agreed_days_per_week: days,
      hourly_rate: parseFloat(hourlyRate.toFixed(2)),
      overtime_coefficient: globalOvertime,
      holiday_coefficient: globalHoliday
    };

    const { data, error } = await supabase
      .from('employee_salaries')
      .upsert(payload, { onConflict: 'restaurant_id,user_id' })
      .select()
      .single();

    if (error) {
      alert('Greška pri čuvanju plate: ' + error.message);
    } else if (data) {
      setSalaries(prev => ({ ...prev, [userId]: data }));
      alert('Plata i radni sat uspešno sačuvani.');
    }
  }

  async function handleSaveCoefficients() {
    if (!restaurantOrgId) return;
    const supabase = createClient();
    
    for (const emp of employees) {
      const current = salaries[emp.id] || { agreed_salary: 0, agreed_days_per_week: 5, hourly_rate: 0 };
      await supabase.from('employee_salaries').upsert({
        restaurant_id: restaurantOrgId,
        user_id: emp.id,
        agreed_salary: current.agreed_salary,
        agreed_days_per_week: current.agreed_days_per_week,
        hourly_rate: current.hourly_rate,
        overtime_coefficient: globalOvertime,
        holiday_coefficient: globalHoliday
      }, { onConflict: 'restaurant_id,user_id' });
    }
    alert('Koeficijenti uspešno sačuvani.');
  }

  function formatHoursAndMinutes(decimalHours: number) {
    const totalMinutes = Math.round(decimalHours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs}h ${mins}m`;
  }

  const daysInMonthCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthDaysList = Array.from({ length: daysInMonthCount }, (_, i) => {
    const d = new Date(selectedYear, selectedMonth, i + 1);
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <h1 className="text-base font-semibold text-slate-900">Upravljanje platama, koeficijentima i platnim listićima</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border">
            <span>Prekovremeni:</span>
            <input
              type="number"
              step="0.01"
              value={globalOvertime}
              onChange={e => setGlobalOvertime(parseFloat(e.target.value) || 1.26)}
              className="w-16 rounded border bg-white px-1 py-0.5 text-center font-bold"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border">
            <span>Praznici:</span>
            <input
              type="number"
              step="0.1"
              value={globalHoliday}
              onChange={e => setGlobalHoliday(parseFloat(e.target.value) || 2.0)}
              className="w-16 rounded border bg-white px-1 py-0.5 text-center font-bold"
            />
          </div>
          <button onClick={handleSaveCoefficients} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
            Sačuvaj koeficijente
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-8">
        {/* 1. PLATNI LISTICI I OBRAČUN ZARADA (NA VRHU) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Platni listici i obračun zarada (Po mesecima)</h2>
              <p className="text-xs text-slate-500">Automatsko povlačenje sati iz Clock In/Out sistema (redovni, prekovremeni i praznični sati).</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white font-medium"
              >
                {['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'].map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white font-medium"
              >
                {[2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Zaposleni</th>
                  <th className="py-3 px-4 text-center">Redovni sati</th>
                  <th className="py-3 px-4 text-center">Prekovremeni sati</th>
                  <th className="py-3 px-4 text-center">Praznični sati</th>
                  <th className="py-3 px-4 text-center">Ukupno sati</th>
                  <th className="py-3 px-4 text-right">Radni sat</th>
                  <th className="py-3 px-4 text-right font-bold text-emerald-700">Ukupno za isplatu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {employees.map(emp => {
                  const sal = salaries[emp.id] || { hourly_rate: 0 };
                  const hourlyRate = sal.hourly_rate || 0;

                  const empAtt = attendanceRecords.filter(r => {
                    if (r.user_id !== emp.id || !r.clock_in) return false;
                    const d = new Date(r.clock_in);
                    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
                  });

                  const dailyHoursMap: Record<string, number> = {};
                  const dailyHolidayMap: Record<string, boolean> = {};

                  empAtt.forEach(r => {
                    if (!r.clock_out) return;
                    const dIn = new Date(r.clock_in);
                    const dateStr = dIn.toISOString().split('T')[0];
                    const duration = (new Date(r.clock_out).getTime() - dIn.getTime()) / 3600000;
                    if (duration > 0) {
                      dailyHoursMap[dateStr] = (dailyHoursMap[dateStr] || 0) + duration;
                      if (isDayHoliday(dateStr)) {
                        dailyHolidayMap[dateStr] = true;
                      }
                    }
                  });

                  let totalRegHours = 0;
                  let totalOvertimeHours = 0;
                  let totalHolidayHours = 0;

                  for (const [dateStr, totalHrs] of Object.entries(dailyHoursMap)) {
                    const isHol = dailyHolidayMap[dateStr];
                    if (isHol) {
                      totalHolidayHours += totalHrs;
                    } else {
                      const reg = Math.min(totalHrs, 8);
                      const ot = Math.max(0, totalHrs - 8);
                      totalRegHours += reg;
                      totalOvertimeHours += ot;
                    }
                  }

                  const regularPay = totalRegHours * hourlyRate;
                  const overtimePay = totalOvertimeHours * hourlyRate * globalOvertime;
                  const holidayPay = totalHolidayHours * hourlyRate * globalHoliday;
                  const totalPay = regularPay + overtimePay + holidayPay;

                  const grandTotalHours = totalRegHours + totalOvertimeHours + totalHolidayHours;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-4 font-semibold text-slate-900">{emp.full_name || emp.email}</td>
                      <td className="py-4 px-4 text-center font-mono">{formatHoursAndMinutes(totalRegHours)}</td>
                      <td className="py-4 px-4 text-center font-mono text-amber-600 font-bold">{formatHoursAndMinutes(totalOvertimeHours)}</td>
                      <td className="py-4 px-4 text-center font-mono text-violet-600 font-bold">{formatHoursAndMinutes(totalHolidayHours)}</td>
                      <td className="py-4 px-4 text-center font-mono font-bold">{formatHoursAndMinutes(grandTotalHours)}</td>
                      <td className="py-4 px-4 text-right font-mono">{hourlyRate} RSD/h</td>
                      <td className="py-4 px-4 text-right font-mono font-bold text-emerald-700 text-sm">{totalPay.toLocaleString('sr-RS', { maximumFractionDigits: 2 })} RSD</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. UGOVORENE PLATE I OBRAČUN RADNOG SATA */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Ugovorene plate i obračun radnog sata</h2>
            <p className="text-xs text-slate-500">Unesite ugovorenu platu i dane u nedelji za svakog zaposlenog.</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Učitavanje...</div>
          ) : employees.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">Nema evidentiranih zaposlenih u timu.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-6">Zaposleni</th>
                    <th className="py-3 px-4">Ugovorena plata (RSD)</th>
                    <th className="py-3 px-4 text-center">Radni dani / nedelji (1-7)</th>
                    <th className="py-3 px-4">Izračunati radni sat</th>
                    <th className="py-3 px-6 text-right">Akcija</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {employees.map(emp => (
                    <EmployeeSalaryRow
                      key={emp.id}
                      emp={emp}
                      initialSalary={salaries[emp.id]?.agreed_salary || 0}
                      initialDays={salaries[emp.id]?.agreed_days_per_week || 5}
                      hourlyRate={salaries[emp.id]?.hourly_rate || 0}
                      onSave={handleSaveSalary}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 3. PREGLED I PODEŠAVANJE PRAZNIKA PO DANIMA (NA DNU) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Pregled i podešavanje praznika po danima</h2>
              <p className="text-xs text-slate-500">Automatski su prepoznati državni praznici. Klikom na prekidač možete označiti bilo koji dan kao praznik ili redovan radni dan.</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider sticky top-0 bg-slate-50 z-10">
                  <th className="py-3 px-4">Datum</th>
                  <th className="py-3 px-4">Dan u nedelji</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Promeni status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {monthDaysList.map(dateStr => {
                  const isHol = isDayHoliday(dateStr);
                  const dateObj = new Date(dateStr);
                  const dayName = dateObj.toLocaleDateString('sr-RS', { weekday: 'long' });
                  const formattedDate = dateObj.toLocaleDateString('sr-RS', { day: 'numeric', month: 'numeric', year: 'numeric' });

                  return (
                    <tr key={dateStr} className={`hover:bg-slate-50/50 ${isHol ? 'bg-amber-50/60' : ''}`}>
                      <td className="py-3 px-4 font-semibold text-slate-900 font-mono">{formattedDate}</td>
                      <td className="py-3 px-4 capitalize text-slate-600">{dayName}</td>
                      <td className="py-3 px-4">
                        {isHol ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Praznični dan (2.0x)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border">
                            Redovan dan
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleHoliday(dateStr)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            isHol 
                              ? 'bg-amber-600 text-white hover:bg-amber-500' 
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                          }`}
                        >
                          {isHol ? 'Ukloni praznik' : 'Označi kao praznik'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function EmployeeSalaryRow({ emp, initialSalary, initialDays, hourlyRate, onSave }: {
  emp: Employee;
  initialSalary: number;
  initialDays: number;
  hourlyRate: number;
  onSave: (userId: string, salary: number, days: number) => void;
}) {
  const [salary, setSalary] = useState<string | number>(initialSalary || '');
  const [days, setDays] = useState<number>(initialDays || 5);

  useEffect(() => {
    setSalary(initialSalary || '');
    setDays(initialDays || 5);
  }, [initialSalary, initialDays]);

  return (
    <tr className="hover:bg-slate-50/50">
      <td className="py-4 px-6">
        <p className="font-semibold text-slate-900">{emp.full_name || emp.email}</p>
        <p className="text-[11px] text-slate-400 uppercase">{emp.role || 'Radnik'}</p>
      </td>
      <td className="py-4 px-4">
        <input
          type="number"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          placeholder="npr. 80000"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs w-36 bg-white focus:outline-none focus:border-emerald-600"
        />
      </td>
      <td className="py-4 px-4 text-center">
        <input
          type="number"
          min="1"
          max="7"
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value) || 5)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs w-16 text-center bg-white focus:outline-none focus:border-emerald-600"
        />
      </td>
      <td className="py-4 px-4 font-mono font-bold text-emerald-700">
        {hourlyRate ? `${hourlyRate} RSD/h` : 'Nije izračunato'}
      </td>
      <td className="py-4 px-6 text-right">
        <button
          onClick={() => onSave(emp.id, parseFloat(String(salary)) || 0, days)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 ml-auto"
        >
          <Check className="h-3.5 w-3.5" /> Sačuvaj
        </button>
      </td>
    </tr>
  );
}