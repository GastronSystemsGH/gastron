'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Users, Search, Truck, ShieldAlert, X, Edit, UserMinus, ShieldCheck } from 'lucide-react';

export default function DistributorTeamPage() {
  const [teamList, setTeamList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('dis_driver');

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    // Dohvati profil trenutnog admina da nađemo organization_id
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (adminProfile?.organization_id) {
      setOrganizationId(adminProfile.organization_id);

      // Dohvati sve zaposlene u toj firmi
      const { data: team } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', adminProfile.organization_id);
      
      if (team) {
        setTeamList(team);
      }
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
        action: currentStatus ? 'DIST_ACTIVATED_USER' : 'DIST_SUSPENDED_USER',
        restaurant_id: organizationId,
        details: `Distributer admin ${currentStatus ? 'aktivirao' : 'suspendovao'} korisnika "${userName || userId}"`,
        location: 'Distributer Panel'
      });
      fetchData();
    }
  }

  async function handleDeleteUser(userObj: any) {
    if (userObj.id === currentUserId) {
      alert('Bezbednosna greška: Ne možete ukloniti sopstveni nalog!');
      return;
    }

    if (!confirm(`Da li ste sigurni da želite da uklonite korisnika "${userObj.full_name || userObj.email}" iz vaše firme?`)) return;
    
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ organization_id: null, role: 'orphan' }) // Uklanjamo ga iz firme
      .eq('id', userObj.id);

    if (error) {
      alert('Greška: ' + error.message);
    } else {
      await supabase.from('audit_logs').insert({
        user_id: currentUserId,
        action: 'DIST_REMOVED_USER',
        restaurant_id: organizationId,
        details: `Distributer admin uklonio korisnika "${userObj.full_name || userObj.email}" iz firme`,
        location: 'Distributer Panel'
      });
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
      })
      .eq('id', editingUser.id);

    if (error) {
      alert('Greška: ' + error.message);
    } else {
      await supabase.from('audit_logs').insert({
        user_id: currentUserId,
        action: 'DIST_UPDATED_USER',
        restaurant_id: organizationId,
        details: `Distributer admin izmenio podatke korisnika "${editName}" (Nova rola: ${editRole})`,
        location: 'Distributer Panel'
      });

      alert('Zaposleni uspešno ažuriran!');
      setShowModal(false);
      setEditingUser(null);
      fetchData();
    }
  }

  function openEditModal(user: any) {
    setEditingUser(user);
    setEditName(user.full_name || '');
    setEditRole(user.role || 'dis_driver');
    setShowModal(true);
  }

  const filteredTeam = teamList.filter(u => {
    const term = searchTerm.toLowerCase();
    const matchSearch = 
      (u.full_name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term);

    const matchRole = roleFilter === 'all' || u.role === roleFilter;

    return matchSearch && matchRole;
  });

  if (loading) return <div className="p-12 text-center text-xs text-slate-500">Učitavanje tima...</div>;

  return (
    <div className="flex flex-1 flex-col p-6 space-y-6 max-w-6xl mx-auto w-full">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-emerald-600" /> Moj Tim
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Upravljanje vozačima i osobljem unutar vaše distributerske organizacije.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Pretraga po imenu ili mejlu..."
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
          <option value="dis_admin">Administrator</option>
          <option value="dis_driver">Vozač</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-6">Zaposleni</th>
                <th className="py-3 px-4">Kontakt</th>
                <th className="py-3 px-4">Uloga u firmi</th>
                <th className="py-3 px-4 text-center">Status nalog</th>
                <th className="py-3 px-6 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTeam.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">Nema pronađenih radnika.</td>
                </tr>
              ) : (
                filteredTeam.map(user => {
                  const isSelf = user.id === currentUserId;
                  const isDriver = user.role === 'dis_driver' || user.role === 'driver';

                  return (
                    <tr key={user.id} className={`hover:bg-slate-50/50 ${user.is_suspended ? 'opacity-60 bg-slate-50' : ''}`}>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          {isDriver ? <Truck className="h-4 w-4 text-emerald-600" /> : <ShieldCheck className="h-4 w-4 text-amber-600" />}
                          {user.full_name || 'Nema imena'}
                          {isSelf && <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded ml-1">Vi</span>}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-mono text-slate-500">{user.email}</div>
                        {user.phone && <div className="font-mono text-slate-400 text-[10px]">{user.phone}</div>}
                      </td>
                      <td className="py-4 px-4 font-medium">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded border uppercase text-[10px] font-bold">
                          {user.role === 'dis_admin' ? 'Administrator' : user.role === 'dis_driver' || user.role === 'driver' ? 'Vozač' : user.role}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {user.is_suspended ? (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold text-[10px]">Suspendovan</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px]">Aktivan</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button 
                          onClick={() => openEditModal(user)} 
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5" /> Izmeni
                        </button>
                        
                        {!isSelf && (
                          <>
                            <button 
                              onClick={() => handleToggleSuspend(user.id, !!user.is_suspended, user.full_name || user.email)} 
                              className={`px-2.5 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1.5 transition-colors ${user.is_suspended ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                            >
                              <ShieldAlert className="h-3.5 w-3.5" /> {user.is_suspended ? 'Aktiviraj' : 'Suspenduj'}
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user)} 
                              className="px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 font-semibold inline-flex items-center gap-1.5 hover:bg-rose-200 transition-colors"
                            >
                              <UserMinus className="h-3.5 w-3.5" /> Ukloni
                            </button>
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
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit className="h-4 w-4 text-emerald-600" /> Izmena zaposlenog
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ime i prezime</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:border-emerald-600" 
                  required 
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Uloga (Radno mesto)</label>
                <select 
                  value={editRole} 
                  onChange={e => setEditRole(e.target.value)} 
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold focus:outline-none focus:border-emerald-600"
                >
                  <option value="dis_admin">Administrator</option>
                  <option value="dis_driver">Vozač</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Administratori imaju pristup kontrolnoj tabli, dok vozači vide samo rute i smene.</p>
              </div>
              
              <div className="flex justify-end gap-2 pt-3 border-t mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200">Otkaži</button>
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-emerald-500">Sačuvaj izmene</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}