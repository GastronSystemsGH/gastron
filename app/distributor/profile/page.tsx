'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { UserCog, Key, Mail, User, Phone, Building2 } from 'lucide-react';

export default function DistributorProfilePage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Lični podaci
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Kancelarija');
  const [createdAt, setCreatedAt] = useState('');

  // Podaci distributivnog centra (Read-Only)
  const [orgName, setOrgName] = useState('');
  const [orgPib, setOrgPib] = useState('');
  const [orgCity, setOrgCity] = useState('');
  const [orgPartOfCity, setOrgPartOfCity] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [orgNumber, setOrgNumber] = useState('');

  // Stanja za lozinku
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const fetchProfileAndOrg = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        setEmail(user.email || '');
        setCreatedAt(user.created_at ? new Date(user.created_at).toLocaleDateString('sr-RS') : 'N/A');

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profile) {
          setFullName(profile.full_name || '');
          setPhone(profile.phone || profile.phone_number || '');
          
          // Formatiranje naziva uloge
          const rawRole = profile.role;
          if (rawRole === 'dis_office') setRole('Kancelarija / Komercijala');
          else if (rawRole === 'dis_warehouse') setRole('Magacin / Pakovanje');
          else if (rawRole === 'dis_driver') setRole('Vozač / Dostavljač');
          else setRole(rawRole || 'Distributer');

          if (profile.organization_id) {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', profile.organization_id)
              .single();

            if (orgData) {
              setOrgName(orgData.name || '');
              setOrgPib(orgData.pib || orgData.company_pib || '');
              setOrgCity(orgData.city || 'Beograd');
              setOrgPartOfCity(orgData.part_of_city || '');
              setOrgAddress(orgData.address || '');
              setOrgNumber(orgData.number || orgData.street_number || '');
            }
          }
        }
      }
      setLoading(false);
    };

    fetchProfileAndOrg();
  }, []);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSavingProfile(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone,
      })
      .eq('id', userId);

    if (error) {
      alert('Greška pri čuvanju profila: ' + error.message);
    } else {
      alert('Lični podaci su uspešno sačuvani!');
    }
    setSavingProfile(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Nova lozinka i potvrda se ne poklapaju.');
      return;
    }
    if (newPassword.length < 6) {
      alert('Nova lozinka mora imati najmanje 6 karaktera.');
      return;
    }

    setPassLoading(true);
    const supabase = createClient();

    // Verifikacija stare lozinke
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: oldPassword
    });

    if (signInError) {
      alert('Greška: Stara lozinka nije tačna.');
      setPassLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      alert('Greška pri promeni lozinke: ' + updateError.message);
    } else {
      alert('Lozinka je uspešno promenjena!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setPassLoading(false);
  }

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje profila...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-5xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <UserCog className="h-5 w-5 text-emerald-600" /> Moj profil i podaci distributivnog centra
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Pregled ličnih podataka, bezbednosti i zaključani podaci kompanije.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LIČNI PODACI */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-600" /> Lični podaci
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase">{role}</span>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ime i prezime</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 bg-white"
                  placeholder="Vaše puno ime"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mejl adresa (Prijavljeni nalog)</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 bg-slate-100 text-slate-500 cursor-not-allowed font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Broj telefona</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 bg-white font-mono"
                  placeholder="npr. +381 60 1234567"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Datum prve prijave</label>
              <input
                type="text"
                value={createdAt}
                disabled
                className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-100 text-slate-500 font-mono text-xs cursor-not-allowed"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-500 transition-colors shadow-sm disabled:opacity-50"
              >
                {savingProfile ? 'Čuvanje...' : 'Sačuvaj lične podatke'}
              </button>
            </div>
          </form>
        </div>

        {/* BEZBEDNOST I LOZINKA */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="h-4 w-4 text-emerald-600" /> Bezbednost i lozinka
            </h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Stara lozinka</label>
              <input
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                placeholder="Unesite trenutnu lozinku"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nova lozinka</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                placeholder="Minimalno 6 karaktera"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Potvrdite novu lozinku</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                placeholder="Ponovite novu lozinku"
                required
              />
            </div>

            <div className="pt-16">
              <button
                type="submit"
                disabled={passLoading}
                className="w-full rounded-lg bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
              >
                {passLoading ? 'Menjanje lozinke...' : 'Promeni lozinku'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* PODACI DISTRIBUTIVNOG CENTRA (READ-ONLY) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b pb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-600" /> Podaci distributivnog centra (Samo za pregled)
          </h2>
          <span className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2.5 py-0.5 rounded border">Read-Only</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2">
            <label className="block font-semibold text-slate-500 mb-1">Naziv distributivnog centra</label>
            <input type="text" value={orgName} disabled className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed" />
          </div>
          <div>
            <label className="block font-semibold text-slate-500 mb-1">PIB</label>
            <input type="text" value={orgPib} disabled className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-100 text-slate-700 font-mono cursor-not-allowed" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Grad</label>
            <input type="text" value={orgCity} disabled className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-100 text-slate-700 cursor-not-allowed" />
          </div>
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Opština / Deo grada</label>
            <input type="text" value={orgPartOfCity} disabled className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-100 text-slate-700 cursor-not-allowed" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-xs">
          <div className="col-span-2">
            <label className="block font-semibold text-slate-500 mb-1">Ulica / Adresa</label>
            <input type="text" value={orgAddress} disabled className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-100 text-slate-700 cursor-not-allowed" />
          </div>
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Broj</label>
            <input type="text" value={orgNumber} disabled className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-100 text-slate-700 cursor-not-allowed font-mono" />
          </div>
        </div>
      </div>
    </div>
  );
}