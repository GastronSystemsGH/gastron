'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Calendar, Save, MapPin, Check } from 'lucide-react';

const CITIES_HIERARCHY = [
  {
    city: 'Beograd',
    zones: [
      { main: 'Zemun', subZones: ['Zemun Centar', 'Zemun Širi Centar', 'Zemun (Batajnica)', 'Zemun (Altina)'] },
      { main: 'Palilula', subZones: ['Palilula Centar', 'Palilula (Borča)', 'Palilula (Krnjača)'] },
      { main: 'Novi Beograd', subZones: ['Novi Beograd (Blokovi)', 'Novi Beograd (Bežanija)'] },
      { main: 'Stari Grad', subZones: ['Stari Grad Centar', 'Dorćol'] },
    ]
  },
  {
    city: 'Niš',
    zones: [
      { main: 'Palilula (Niš)', subZones: ['Palilula Niš Centar', 'Palilula Niš Širi'] },
      { main: 'Medijana', subZones: ['Medijana Centar'] },
    ]
  }
];

const DAYS = [
  { key: 'mon', label: 'Pon' },
  { key: 'tue', label: 'Uto' },
  { key: 'wed', label: 'Sre' },
  { key: 'thu', label: 'Čet' },
  { key: 'fri', label: 'Pet' },
  { key: 'sat', label: 'Sub' },
  { key: 'sun', label: 'Ned' },
];

export default function DeliverySchedulePage() {
  const [selectedCity, setSelectedCity] = useState<string>('Beograd');
  const [schedule, setSchedule] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const fetchSchedule = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) return;
      setOrgId(profile.organization_id);

      const { data } = await supabase
        .from('delivery_schedules')
        .select('*')
        .eq('organization_id', profile.organization_id);

      if (data) {
        const loadedSchedule: Record<string, string[]> = {};
        data.forEach(item => {
          const key = `${item.city}_${item.zone_key}`;
          loadedSchedule[key] = item.days || [];
        });
        setSchedule(loadedSchedule);
      }
      setLoading(false);
    };

    fetchSchedule();
  }, []);

  const toggleDay = (uniqueKey: string, dayKey: string) => {
    setSchedule(prev => {
      const currentDays = prev[uniqueKey] || [];
      const updatedDays = currentDays.includes(dayKey)
        ? currentDays.filter(d => d !== dayKey)
        : [...currentDays, dayKey];
      return { ...prev, [uniqueKey]: updatedDays };
    });
  };

  const toggleAllInZone = (subZones: string[], dayKey: string) => {
    const keys = subZones.map(s => `${selectedCity}_${s}`);
    const allChecked = keys.every(k => (schedule[k] || []).includes(dayKey));

    setSchedule(prev => {
      const copy = { ...prev };
      keys.forEach(k => {
        const cur = copy[k] || [];
        if (allChecked) copy[k] = cur.filter(d => d !== dayKey);
        else if (!cur.includes(dayKey)) copy[k] = [...cur, dayKey];
      });
      return copy;
    });
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);

    // Priprema podataka za upis u bazu
    const records = Object.entries(schedule).map(([key, days]) => {
      const parts = key.split('_');
      const city = parts[0];
      const zone_key = parts.slice(1).join('_');
      return {
        organization_id: orgId,
        city,
        zone_key,
        days
      };
    });

    for (const rec of records) {
      await supabase
        .from('delivery_schedules')
        .upsert(rec, { onConflict: 'organization_id,city,zone_key' });
    }

    setSaving(false);
    alert('Dostavni dani su uspešno sačuvani u bazi i sačuvaće se i nakon refresh-a!');
  };

  const activeCityData = CITIES_HIERARCHY.find(c => c.city === selectedCity);

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje dostavnih dana...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-emerald-600" /> Upravljanje dostavnim danima
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Definišite dane dostave po mikro-lokacijama.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          <Save className="h-4 w-4" /> {saving ? 'Čuvanje...' : 'Sačuvaj izmene'}
        </button>
      </div>

      <div className="bg-slate-50 border rounded-xl p-4 flex items-center gap-3">
        <MapPin className="h-5 w-5 text-emerald-600" />
        <label className="text-xs font-bold text-slate-700">Izaberi grad:</label>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-xs font-bold bg-white"
        >
          {CITIES_HIERARCHY.map(c => (
            <option key={c.city} value={c.city}>{c.city}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {activeCityData?.zones.map(zone => (
          <div key={zone.main} className="border border-slate-200 rounded-xl bg-white p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">{zone.main} (Opština)</h2>
              <div className="flex gap-1">
                {DAYS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => toggleAllInZone(zone.subZones, d.key)}
                    className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-100 rounded text-slate-600"
                  >
                    Sve {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {zone.subZones.map(sub => {
                const uniqueKey = `${selectedCity}_${sub}`;
                const activeDays = schedule[uniqueKey] || [];
                return (
                  <div key={sub} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">{sub}</span>
                    <div className="flex gap-1.5">
                      {DAYS.map(day => {
                        const isSelected = activeDays.includes(day.key);
                        return (
                          <button
                            key={day.key}
                            onClick={() => toggleDay(uniqueKey, day.key)}
                            className={`px-3 py-1 text-xs rounded-lg font-bold transition-all flex items-center gap-1 ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {day.label} {isSelected && <Check className="h-3 w-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}