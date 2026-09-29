'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Building2, Plus, Search, MapPin, Edit2, Trash2, X, UserPlus } from 'lucide-react';

const BELGRADE_MUNICIPALITIES = [
  'Stari Grad',
  'Vračar',
  'Novi Beograd',
  'Zemun',
  'Čukarica',
  'Rakovica',
  'Voždovac',
  'Zvezdara',
  'Palilula',
  'Savski Venac',
  'Barajevo',
  'Grocka',
  'Mladenovac',
  'Obrenovac',
  'Sopot',
  'Surčin'
];

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  
  const [name, setName] = useState('');
  const [type, setType] = useState('restaurant');
  const [company_pib, setPib] = useState('');
  const [city, setCity] = useState('Beograd');
  
  const [partOfCity, setPartOfCity] = useState('Stari Grad');
  const [customPartOfCity, setCustomPartOfCity] = useState('');
  const [isCustomMun, setIsCustomMun] = useState(false);

  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [targetPartnerForUser, setTargetPartnerForUser] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userRole, setUserRole] = useState('res_cook');

  const fetchPartners = async () => {
    const supabase = createClient();
    const { data } = await supabase.from('organizations').select('*').order('name', { ascending: true });
    if (data) setPartners(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  function openAddModal() {
    setEditingPartner(null);
    setName('');
    setType('restaurant');
    setPib('');
    setCity('Beograd');
    setPartOfCity('Stari Grad');
    setCustomPartOfCity('');
    setIsCustomMun(false);
    setAddress('');
    setNumber('');
    setShowModal(true);
  }

  function openEditModal(partner: any) {
    setEditingPartner(partner);
    setName(partner.name || '');
    setType(partner.type || partner.organization_type || 'restaurant');
    setPib(partner.pib || partner.company_pib || '');
    setCity(partner.city || 'Beograd');
    
    const dbMun = partner.part_of_city || '';
    if (BELGRADE_MUNICIPALITIES.includes(dbMun)) {
      setPartOfCity(dbMun);
      setIsCustomMun(false);
    } else if (dbMun) {
      setPartOfCity('__create_new__');
      setCustomPartOfCity(dbMun);
      setIsCustomMun(true);
    } else {
      setPartOfCity('Stari Grad');
      setIsCustomMun(false);
    }

    setAddress(partner.address || '');
    setNumber(partner.number || partner.street_number || '');
    setShowModal(true);
  }

  // STAVKA 7: Dinamičke role na osnovu tipa partnera (Restoran vs Distributer)
  function openAddUserModal(partner: any) {
    setTargetPartnerForUser(partner);
    setUserEmail('');
    setUserFullName('');
    
    const pType = (partner.type || partner.organization_type || '').toLowerCase();
    if (pType.includes('distrib')) {
      setUserRole('distributor_manager'); // Podrazumevana rola za distributere
    } else {
      setUserRole('res_cook'); // Podrazumevana rola za restorane
    }
    
    setShowUserModal(true);
  }

  async function handleSavePartner(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const finalPartOfCity = isCustomMun ? customPartOfCity : partOfCity;

    const payload = {
      name,
      type,
      company_pib: company_pib,
      city,
      part_of_city: finalPartOfCity,
      address,
      number
    };

    if (editingPartner) {
      const { error } = await supabase
        .from('organizations')
        .update(payload)
        .eq('id', editingPartner.id);

      if (error) {
        alert('Greška pri izmeni: ' + error.message);
      } else {
        await supabase.from('audit_logs').insert({
          user_id: user?.id,
          action: 'ADMIN_UPDATED_PARTNER',
          restaurant_id: editingPartner.id,
          details: `Admin ažurirao partnera "${name}" (PIB: ${company_pib})`,
          location: 'Admin Centrala / Srbija'
        });

        alert('Partner uspešno ažuriran!');
        setShowModal(false);
        fetchPartners();
      }
    } else {
      const { error, data: newOrg } = await supabase
        .from('organizations')
        .insert([payload])
        .select()
        .single();

      if (error) {
        alert('Greška pri kreiranju: ' + error.message);
      } else {
        await supabase.from('audit_logs').insert({
          user_id: user?.id,
          action: 'ADMIN_CREATED_PARTNER',
          restaurant_id: newOrg?.id || null,
          details: `Admin kreirao novog partnera "${name}" tipa ${type} (PIB: ${company_pib})`,
          location: 'Admin Centrala / Srbija'
        });

        alert('Novi partner uspešno dodat!');
        setShowModal(false);
        fetchPartners();
      }
    }
  }

  async function handleAssignUser(e: React.FormEvent) {
    e.preventDefault();
    if (!targetPartnerForUser) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (existingProfile) {
      const { error } = await supabase
        .from('profiles')
        .update({
          organization_id: targetPartnerForUser.id,
          role: userRole,
          full_name: userFullName || undefined
        })
        .eq('id', existingProfile.id);

      if (error) {
        alert('Greška pri dodeljivanju korisnika: ' + error.message);
      } else {
        await supabase.from('audit_logs').insert({
          user_id: user?.id,
          action: 'ADMIN_ASSIGNED_USER',
          restaurant_id: targetPartnerForUser.id,
          details: `Admin dodelio korisnika (${userEmail}) partneru ${targetPartnerForUser.name} sa rolom ${userRole}`,
          location: 'Admin Centrala / Srbija'
        });

        alert(`Korisnik ${userEmail} je uspešno pridodat!`);
        setShowUserModal(false);
      }
    } else {
      const { error } = await supabase
        .from('profiles')
        .insert([{
          email: userEmail,
          full_name: userFullName,
          role: userRole,
          organization_id: targetPartnerForUser.id
        }]);

      if (error) {
        alert('Greška pri kreiranju profila: ' + error.message);
      } else {
        await supabase.from('audit_logs').insert({
          user_id: user?.id,
          action: 'ADMIN_CREATED_AND_ASSIGNED_USER',
          restaurant_id: targetPartnerForUser.id,
          details: `Admin kreirao i dodelio novog korisnika (${userEmail}) partneru ${targetPartnerForUser.name} sa rolom ${userRole}`,
          location: 'Admin Centrala / Srbija'
        });

        alert(`Novi korisnik kreiran i pridodat!`);
        setShowUserModal(false);
      }
    }
  }

  async function handleDeletePartner(partnerObj: any) {
    if (!confirm(`Da li ste sigurni da želite da obrišete partnera "${partnerObj.name}"?`)) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('organizations').delete().eq('id', partnerObj.id);

    if (error) {
      alert('Greška pri brisanju: ' + error.message);
    } else {
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'ADMIN_DELETED_PARTNER',
        restaurant_id: partnerObj.id,
        details: `Admin obrisao partnera "${partnerObj.name}"`,
        location: 'Admin Centrala / Srbija'
      });

      fetchPartners();
    }
  }

  const filteredPartners = partners.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      (p.name || '').toLowerCase().includes(term) ||
      (p.city || '').toLowerCase().includes(term) ||
      (p.part_of_city || '').toLowerCase().includes(term) ||
      (p.pib || '').toLowerCase().includes(term) ||
      (p.company_pib || '').toLowerCase().includes(term);

    const pType = (p.type || p.organization_type || '').toLowerCase();
    const matchType = typeFilter === 'all' || pType.includes(typeFilter);

    return matchSearch && matchType;
  });

  const isTargetDistributor = targetPartnerForUser && ((targetPartnerForUser.type || targetPartnerForUser.organization_type || '').toLowerCase().includes('distrib'));

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje partnera...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" /> Upravljanje partnerima (Restorani i Distributeri)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Evidencija svih organizacija, lokacija i dodela odgovarajućih korisničkih rola.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
        >
          <Plus className="h-4 w-4" /> Dodaj novog partnera
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pretraga po nazivu, gradu, opštini ili PIB-u..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs bg-white focus:outline-none focus:border-emerald-600"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white font-semibold w-full sm:w-48"
        >
          <option value="all">Svi tipovi partnera</option>
          <option value="restaurant">Restorani</option>
          <option value="distributor">Distributeri</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-6">Naziv partnera</th>
                <th className="py-3 px-4">Tip</th>
                <th className="py-3 px-4">PIB</th>
                <th className="py-3 px-4">Grad i opština</th>
                <th className="py-3 px-4">Adresa i broj</th>
                <th className="py-3 px-6 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">Nema pronađenih partnera.</td>
                </tr>
              ) : (
                filteredPartners.map(partner => (
                  <tr key={partner.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 font-bold text-slate-900">{partner.name}</td>
                    <td className="py-4 px-4 font-medium">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                        (partner.type || '').includes('distrib') ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {partner.type || 'Restoran'}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-600 font-semibold">
                      {partner.pib || partner.company_pib || 'N/A'}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-800">
                      <div>{partner.city || 'Beograd'}</div>
                      <div className="text-[11px] text-slate-400">{partner.part_of_city || 'Opština nije uneta'}</div>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-600">
                      {partner.address ? `${partner.address} ${partner.number || ''}` : 'Adresa nije uneta'}
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button onClick={() => openAddUserModal(partner)} className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold inline-flex items-center gap-1">
                        <UserPlus className="h-3.5 w-3.5" /> Dodaj korisnika
                      </button>
                      <button onClick={() => openEditModal(partner)} className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold">Izmeni</button>
                      <button onClick={() => handleDeletePartner(partner)} className="px-2.5 py-1 rounded bg-rose-100 text-rose-700 font-semibold">Obriši</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingPartner ? 'Izmena partnera' : 'Dodavanje novog partnera'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSavePartner} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Naziv organizacije</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white" required placeholder="npr. Restoran Tri šešira" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tip partnera</label>
                  <select value={type} onChange={e => setType(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white font-semibold">
                    <option value="restaurant">Restoran</option>
                    <option value="distributor">Distributer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIB (Obavezno)</label>
                  <input type="text" value={company_pib} onChange={e => setPib(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white font-mono" placeholder="npr. 101234567" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Grad</label>
                  <select value={city} onChange={e => setCity(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white font-semibold">
                    <option value="Beograd">Beograd</option>
                    <option value="Novi Sad">Novi Sad</option>
                    <option value="Niš">Niš</option>
                    <option value="Kragujevac">Kragujevac</option>
                    <option value="Subotica">Subotica</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opština / Deo grada</label>
                  <select
                    value={partOfCity}
                    onChange={e => {
                      const val = e.target.value;
                      setPartOfCity(val);
                      if (val === '__create_new__') setIsCustomMun(true);
                      else setIsCustomMun(false);
                    }}
                    className="w-full rounded-lg border px-3 py-2 bg-white font-semibold"
                  >
                    {BELGRADE_MUNICIPALITIES.map(mun => (
                      <option key={mun} value={mun}>{mun}</option>
                    ))}
                    <option value="__create_new__">+ Kreiraj novi...</option>
                  </select>
                </div>
              </div>

              {isCustomMun && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Naziv nove opštine</label>
                  <input type="text" value={customPartOfCity} onChange={e => setCustomPartOfCity(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white" placeholder="npr. Batajnica" required />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Ulica / Adresa</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white" placeholder="npr. Skadarska" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Broj</label>
                  <input type="text" value={number} onChange={e => setNumber(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white" placeholder="npr. 28" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold">Otkaži</button>
                <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white">Sačuvaj partnera</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STAVKA 7: Dinamički dropdown rola (Restoran vs Distributer) */}
      {showUserModal && targetPartnerForUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dodavanje korisnika partneru</h3>
                <p className="text-[11px] text-emerald-700 font-semibold">{targetPartnerForUser.name} ({isTargetDistributor ? 'Distributer' : 'Restoran'})</p>
              </div>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleAssignUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ime i prezime korisnika</label>
                <input type="text" value={userFullName} onChange={e => setUserFullName(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white" placeholder="npr. Petar Petrović" />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mejl adresa</label>
                <input type="email" value={userEmail} onChange={e => setUserEmail(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white font-mono" placeholder="korisnik@partner.com" required />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rola / Dozvola</label>
                <select value={userRole} onChange={e => setUserRole(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white font-semibold">
                  {isTargetDistributor ? (
                    <>
                      <option value="distributor_manager">Distributer Menadžer</option>
                      <option value="distributor_commercial">Komercijalista</option>
                      <option value="distributor_warehouse">Magacioner</option>
                    </>
                  ) : (
                    <>
                      <option value="res_owner">Vlasnik</option>
                      <option value="res_chef">Chef / Šef kuhinje</option>
                      <option value="res_cook">Kuvar</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowUserModal(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold">Otkaži</button>
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Dodaj i poveži korisnika</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}