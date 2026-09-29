'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Users, Search, Lock, Unlock, X, ShieldAlert, UserCheck } from 'lucide-react';
import { startImpersonation } from '@/utils/impersonation';

export default function AdminTeamPage() {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('res_cook');
  const [editOrgId, setEditOrgId] = useState('');

  const fetchData = async () => {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const { data: orgs } = await supabase.from('organizations').select('*');
    const orgsMap = new Map();
    if (orgs) {
      setOrganizations(orgs);
      orgs.forEach(o => orgsMap.set(o.id, o));
    }

    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) {
      const enriched = profiles.map(p => ({
        ...p,
        organizations: p.organization_id ? orgsMap.get(p.organization_id) || null : null
      }));
      setUsersList(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function handleToggleSuspend(userId: string, currentStatus: boolean, userName: string) {
    if (userId === currentUserId) {
      alert('Bezbednosna greška: Ne možete suspendovati sopstveni nalog!');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ is_suspended: !currentStatus })
      .eq('id', userId);

    if (error) {
      alert('Greška: ' + error.message);
    } else {
      await supabase.from('audit_logs').insert({
        user_id: currentUserId,
        action: currentStatus ? 'ADMIN_ACTIVATED_USER' : 'ADMIN_SUSPENDED_USER',
        restaurant_id: null,
        details: `Admin ${currentStatus ? 'aktivirao' : 'suspendovao'} korisnika "${userName || userId}"`,
        location: 'Admin Centrala / Srbija'
      });

      alert('Status korisnika je uspešno izmenjen.');
      fetchData();
    }
  }

  async function handleDeleteUser(userObj: any) {
    if (userObj.id === currentUserId) {
      alert('Bezbednosna greška: Ne možete ukloniti sopstveni nalog!');
      return;
    }

    if (!confirm(`Da li ste sigurni da želite da uklonite korisnika "${userObj.full_name || userObj.email}" iz sistema?`)) return;
    
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ organization_id: null, role: 'orphan' })
      .eq('id', userObj.id);

    if (error) {
      alert('Greška: ' + error.message);
    } else {
      await supabase.from('audit_logs').insert({
        user_id: currentUserId,
        action: 'ADMIN_REMOVED_USER_ACCESS',
        restaurant_id: userObj.organization_id || null,
        details: `Admin uklonio organizaciju i rolu korisniku "${userObj.full_name || userObj.email}"`,
        location: 'Admin Centrala / Srbija'
      });

      alert('Korisnik je uspešno uklonjen.');
      fetchData();
    }
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editName,
        role: editRole,
        organization_id: editOrgId || null
      })
      .eq('id', editingUser.id);

    if (error) {
      alert('Greška: ' + error.message);
    } else {
      await supabase.from('audit_logs').insert({
        user_id: currentUserId,
        action: 'ADMIN_UPDATED_USER',
        restaurant_id: editOrgId || null,
        details: `Admin izmenio podatke korisnika "${editName}" (Rola: ${editRole})`,
        location: 'Admin Centrala / Srbija'
      });

      alert('Korisnik uspešno ažuriran!');
      setShowModal(false);
      setEditingUser(null);
      fetchData();
    }
  }

  function openEditModal(user: any) {
    setEditingUser(user);
    setEditName(user.full_name || '');
    setEditRole(user.role || 'res_cook');
    setEditOrgId(user.organization_id || '');
    setShowModal(true);
  }

  const filteredUsers = usersList.filter(u => {
    const term = searchTerm.toLowerCase();
    const pibVal = (u.organizations?.company_pib || '').toLowerCase();
    const matchSearch = 
      (u.full_name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.role || '').toLowerCase().includes(term) ||
      pibVal.includes(term) ||
      (u.organizations?.name || '').toLowerCase().includes(term);

    const matchRole = roleFilter === 'all' || u.role === roleFilter;

    return matchSearch && matchRole;
  });

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje korisnika...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" /> Svi korisnici sistema
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Pregled, pretraga i kontrola svih korisnika iz svih restorana i firmi.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pretraga po PIB-u, mejlu, imenu restorana ili korisnika..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-xs bg-white focus:outline-none focus:border-emerald-600"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white font-semibold w-full sm:w-48"
        >
          <option value="all">Sve uloge</option>
          <option value="admin">Admin</option>
          <option value="res_owner">Vlasnik</option>
          <option value="res_chef">Chef</option>
          <option value="res_cook">Kuvar</option>
          <option value="dis_admin">Distributer</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-6">Korisnik / Mejl</th>
                <th className="py-3 px-4">Restoran / Firma</th>
                <th className="py-3 px-4">PIB & Lokacija</th>
                <th className="py-3 px-4">Uloga</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-6 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">Nema pronađenih korisnika.</td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isSelf = user.id === currentUserId;

                  return (
                    <tr key={user.id} className={`hover:bg-slate-50/50 ${user.is_suspended ? 'opacity-60 bg-slate-50' : ''}`}>
                      <td className="py-4 px-6 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          {user.full_name || 'Nema imena'}
                          {isSelf && <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded">Vaš nalog</span>}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">{user.email}</div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-800">
                        {user.organizations?.name || <span className="text-slate-400 italic">Nema firmu</span>}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-600 text-[11px]">
                        <div>PIB: <strong className="text-slate-900">{user.organizations?.company_pib || 'N/A'}</strong></div>
                        <div className="text-slate-400">{user.organizations?.address || user.organizations?.city || 'Lokacija nije uneta'}</div>
                      </td>
                      <td className="py-4 px-4 font-medium">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border uppercase text-[10px] font-bold">{user.role || 'user'}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {user.is_suspended ? (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold text-[10px]">Suspendovan</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px]">Aktivan</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                        {!isSelf && (
                          <button 
                            onClick={() => startImpersonation(user.id)} 
                            className="px-2.5 py-1 rounded bg-indigo-100 text-indigo-700 font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-200 transition-colors"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Preuzmi nalog
                          </button>
                        )}
                        
                        <button onClick={() => openEditModal(user)} className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold">Izmeni</button>
                        
                        {isSelf ? (
                          <span className="text-[10px] text-slate-400 italic ml-2">Zaštićeno</span>
                        ) : (
                          <>
                            <button onClick={() => handleToggleSuspend(user.id, !!user.is_suspended, user.full_name || user.email)} className={`px-2.5 py-1 rounded font-semibold ${user.is_suspended ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {user.is_suspended ? 'Aktiviraj' : 'Suspenduj'}
                            </button>
                            <button onClick={() => handleDeleteUser(user)} className="px-2.5 py-1 rounded bg-rose-100 text-rose-700 font-semibold">Ukloni</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">Izmena korisnika</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ime i prezime</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white" required />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rola</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white font-semibold">
                  <option value="admin">Admin</option>
                  <option value="res_owner">Vlasnik</option>
                  <option value="res_chef">Chef</option>
                  <option value="res_cook">Kuvar</option>
                  <option value="dis_admin">Distributer</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Restoran / Firma</label>
                <select value={editOrgId} onChange={e => setEditOrgId(e.target.value)} className="w-full rounded-lg border px-3 py-2 bg-white font-semibold">
                  <option value="">-- Bez organizacije --</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name} (PIB: {org.company_pib || 'N/A'})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-semibold">Otkaži</button>
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Sačuvaj</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}