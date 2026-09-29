'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Utensils, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) {
      alert('Greška pri prijavi: ' + error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      const role = (profile?.role || '').toLowerCase();

      // Provera po prefiksima i ključnim rečima
      if (role === 'admin' || role === 'superadmin') {
        window.location.href = '/admin';
      } else if (role === 'dis_driver' || role === 'driver' || role.includes('driver')) {
        window.location.href = '/driver';
      } else if (role.startsWith('dis_') || role.includes('distributor')) {
        window.location.href = '/distributor';
      } else {
        window.location.href = '/restaurant';
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Utensils className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Prijava na sistem</h1>
          <p className="text-xs text-slate-500">Unesite vaše pristupne podatke</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email adresa</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vas@email.com"
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Šifra</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Prijava u toku...' : 'Prijavi se'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 space-y-2 pt-2 border-t border-slate-100">
          <p>
            Nemate nalog?{' '}
            <a href="/register" className="font-semibold text-emerald-600 hover:underline">
              Registrujte se u par klikova
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}