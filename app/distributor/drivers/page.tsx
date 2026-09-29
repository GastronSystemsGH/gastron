'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Truck, Phone, Mail, UserCheck, Search, ShieldAlert } from 'lucide-react';

interface Driver {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  is_suspended?: boolean;
}

export default function DistributorDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const supabase = createClient();

  const fetchDrivers = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }

    // Povlačimo vozače iz iste organizacije ili sve sa vozačkom ulogom
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['driver', 'dis_driver']);

    if (!error && data) {
      setDrivers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const filteredDrivers = drivers.filter(driver => 
    (driver.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (driver.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (driver.phone || '').includes(searchTerm)
  );

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje vozača...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Truck className="h-6 w-6 text-emerald-600" /> Registrovani Vozači u Organizaciji
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Pregled i kontakt podaci svih terenskih vozača i dostavljača.</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pretraži po imenu, mejlu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 py-2 text-xs focus:border-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      {filteredDrivers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center bg-white space-y-3">
          <ShieldAlert className="mx-auto h-8 w-8 text-slate-400" />
          <p className="text-xs font-semibold text-slate-600">Nema pronađenih vozača.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map(driver => (
            <div key={driver.id} className="border border-slate-200 bg-white rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-800 text-sm">
                  {(driver.full_name || driver.email || 'V')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">{driver.full_name || 'Nema unetog imena'}</h3>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    {driver.role}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs border-t border-slate-100 pt-3 text-slate-600">
                <div className="flex items-center gap-2 font-mono">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{driver.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{driver.phone || 'Telefon nije unet'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}