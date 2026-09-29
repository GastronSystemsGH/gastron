'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Utensils, Mail, Lock, User, Phone } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !fullName) {
      alert('Molimo popunite obavezna polja.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // 1. Registracija Auth korisnika
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim()
        }
      }
    });

    if (authError) {
      alert('Greška pri registraciji: ' + authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // 2. Kreiranje zapisa u profiles tabeli
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        phone: phone.trim()
      });

      if (profileError) {
        alert('Greška pri kreiranju profila: ' + profileError.message);
      } else {
        alert('Uspešno ste se registrujski. Molimo prijavite se sa vašim podacima.');
        router.push('/login');
      }
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Utensils className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Napravite nalog</h1>
          <p className="text-xs text-slate-500">Unesite podatke da biste pristupili sistemu</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ime i prezime</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Petar Petrović"
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
          </div>

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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Broj telefona</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+381 60 1234567"
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
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
            {loading ? 'Kreiranje naloga...' : 'Registruj se'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          Već imate nalog? <a href="/login" className="font-semibold text-emerald-600 hover:underline">Prijavite se</a>
        </div>
      </div>
    </div>
  );
}