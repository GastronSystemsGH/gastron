'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Users, UserPlus, Trash2, Edit2, Check, X, Shield, Mail, Lock, Unlock, Clock, KeyRound, FileText } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
  role: string;
  email: string;
  phone?: string;
  is_suspended?: boolean;
  linking_code?: string;
  sanitary_expiry?: string;
  contract_start?: string;
  contract_end?: string;
  contract_indeterminate?: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  full_name: string;
}

export default function RestaurantTeam() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [restaurantOrgId, setRestaurantOrgId] = useState<string | null>(null);

  // Režim u modalu za dodavanje: 'email' ili 'code'
  const [addMode, setAddMode] = useState<'email' | 'code'>('email');

  // Modal za dodavanje
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('res_cook');

  // Dodavanje putem koda
  const [inputCode, setInputCode] = useState('');
  const [foundUserForCode, setFoundUserForCode] = useState<any | null>(null);

  // Izmena korisnika
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSanitaryExpiry, setEditSanitaryExpiry] = useState('');
  const [editContractStart, setEditContractStart] = useState('');
  const [editContractEnd, setEditContractEnd] = useState('');
  const [editContractIndeterminate, setEditContractIndeterminate] = useState(false);

  const isOwner = currentUserRole.toLowerCase().includes('owner') || currentUserRole.toLowerCase().includes('res_owner');
  const isChef = (currentUserRole.toLowerCase().includes('chef') || currentUserRole.toLowerCase().includes('res_chef')) && !isOwner;
  const isCook = !isOwner && !isChef;

  // Helper za lepo prikazivanje uloga
  const formatRole = (roleStr: string) => {
    const r = (roleStr || '').toLowerCase();
    if (r.includes('owner')) return 'Vlasnik';
    if (r.includes('chef')) return 'Chef';
    if (r.includes('cook')) return 'Kuvar';
    return roleStr || 'Kuvar';
  };

  const fetchData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (profile) {
      const roleStr = (profile.role || '').toLowerCase();
      setCurrentUserRole(roleStr);

      if (profile.organization_id) {
        setRestaurantOrgId(profile.organization_id);

        // 1. Aktivni članovi tima - Svi vide sve
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .eq('organization_id', profile.organization_id);

        if (profs) {
          setEmployees(profs);
        }

        // 2. Pozvani korisnici (pre registracije) - samo owner/chef vide pozivnice
        const isUserCook = !roleStr.includes('owner') && !roleStr.includes('chef');
        if (!isUserCook) {
          const { data: invites } = await supabase
            .from('organization_invites')
            .select('*')
            .eq('organization_id', profile.organization_id);

          if (invites) setPendingInvites(invites);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 1. Dodavanje pre registracije (preko mejla)
  async function handleAddByEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || !restaurantOrgId) return;

    if (newRole.toLowerCase().includes('owner') && !isOwner) {
      alert('Samo vlasnik može dodati novog Vlasnika.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from('organization_invites').upsert({
      organization_id: restaurantOrgId,
      email: newEmail.trim().toLowerCase(),
      role: newRole,
      full_name: newName.trim()
    }, { onConflict: 'organization_id,email' });

    if (error) {
      alert('Greška pri dodavanju pozivnice: ' + error.message);
    } else {
      alert('Pozivnica uspešno sačuvana!');
      setNewEmail('');
      setNewName('');
      setShowAddModal(false);
      fetchData();
    }
  }

  // 2. Pronalaženje korisnika po kodu sa proverom isteka od 10 minuta
  async function handleSearchByCode(e: React.FormEvent) {
    e.preventDefault();
    if (!inputCode.trim()) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('linking_code', inputCode.trim().toUpperCase())
      .single();

    if (error || !data) {
      alert('Korisnik sa unetim kodom nije pronađen.');
      setFoundUserForCode(null);
      return;
    }

    if (data.linking_code_expires_at) {
      const expiresAt = new Date(data.linking_code_expires_at);
      if (new Date() > expiresAt) {
        alert('Uneti kôd je istekao (važio je 10 minuta). Zamolite korisnika da se ponovo prijavi kako bi dobio novi kôd.');
        setFoundUserForCode(null);
        return;
      }
    }

    setFoundUserForCode(data);
    setEditName(data.full_name || '');
    setNewRole(data.role || 'res_cook');
  }

  // 3. Potvrda i dodavanje korisnika pronađenog putem koda
  async function handleConfirmAddByCode() {
    if (!foundUserForCode || !restaurantOrgId) return;

    if (newRole.toLowerCase().includes('owner') && !isOwner) {
      alert('Samo vlasnik može dodeliti rolu Vlasnika.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        organization_id: restaurantOrgId,
        role: newRole,
        full_name: editName,
        linking_code: null,
        linking_code_expires_at: null
      })
      .eq('id', foundUserForCode.id);

    if (error) {
      alert('Greška pri dodavanju korisnika: ' + error.message);
    } else {
      alert('Korisnik je uspešno dodat u Vaš tim!');
      setFoundUserForCode(null);
      setInputCode('');
      setShowAddModal(false);
      fetchData();
    }
  }

  async function handleDeleteInvite(inviteId: string) {
    if (!isOwner && !isChef) return;
    if (!confirm('Da li ste sigurni da želite da otkažete ovu pozivnicu?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('organization_invites').delete().eq('id', inviteId);
    if (error) {
      alert('Greška: ' + error.message);
    } else {
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    }
  }

  async function handleToggleSuspend(empId: string, currentStatus: boolean, targetRole: string) {
    const isTargetOwner = (targetRole || '').toLowerCase().includes('owner');
    const isTargetCook = (targetRole || '').toLowerCase().includes('cook');

    if (isOwner) {
      if (empId === currentUserId) {
        alert('Ne možete suspendovati sami sebe.');
        return;
      }
      if (isTargetOwner) {
        alert('Nije dozvoljeno suspendovati drugog vlasnika.');
        return;
      }
    } else if (isChef) {
      if (!isTargetCook) {
        alert('Chef može da suspenduje samo kuvare (cook).');
        return;
      }
    } else {
      alert('Nemate dozvolu za suspenziju.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ is_suspended: !currentStatus })
      .eq('id', empId);

    if (error) {
      alert('Greška: ' + error.message);
    } else {
      setEmployees(prev => prev.map(e => e.id === empId ? { ...e, is_suspended: !currentStatus } : e));
    }
  }

  async function handleDeleteEmployee(empId: string, targetRole: string) {
    if (!isOwner) {
      alert('Samo vlasnik može da uklanja članove tima.');
      return;
    }
    if (empId === currentUserId) {
      alert('Ne možete obrisati sami sebe.');
      return;
    }
    const isTargetOwner = (targetRole || '').toLowerCase().includes('owner');
    if (isTargetOwner) {
      alert('Nije dozvoljeno brisanje Vlasnika.');
      return;
    }

    if (!confirm('Da li ste sigurni da želite da uklonite ovog korisnika iz tima?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ organization_id: null, role: 'user' }).eq('id', empId);

    if (error) {
      alert('Greška pri uklanjanju: ' + error.message);
    } else {
      setEmployees(prev => prev.filter(e => e.id !== empId));
    }
  }

  async function handleSaveEdit(empId: string, targetRole: string) {
    if (isCook) {
      alert('Nemate dozvolu za izmene.');
      return;
    }

    if (empId === currentUserId) {
      alert('Nije dozvoljeno menjati sopstveni nalog preko ove tabele.');
      return;
    }

    const isTargetOwner = (targetRole || '').toLowerCase().includes('owner');
    if (isTargetOwner && !isOwner) {
      alert('Nemate dozvolu da menjate podatke Vlasnika.');
      return;
    }

    const isTryingToSetOwner = editRole.toLowerCase().includes('owner');
    if (isTryingToSetOwner && !isOwner) {
      alert('Samo vlasnik može dodeliti rolu Vlasnika.');
      return;
    }

    const supabase = createClient();
    const payload = {
      full_name: editName,
      role: isOwner ? editRole : targetRole,
      sanitary_expiry: editSanitaryExpiry || undefined,
      contract_start: editContractStart || undefined,
      contract_end: editContractIndeterminate ? undefined : (editContractEnd || undefined),
      contract_indeterminate: editContractIndeterminate
    };

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', empId);

    if (error) {
      alert('Greška: ' + error.message);
    } else {
      setEmployees(prev => prev.map(e => e.id === empId ? { ...e, ...payload } : e) as Employee[]);
      setEditingId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
        <h1 className="text-base font-semibold text-slate-900">Upravljanje timom i dokumentacijom</h1>
        {(isOwner || isChef) && (
          <button
            onClick={() => { setShowAddModal(true); setAddMode('email'); setFoundUserForCode(null); }}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Dodaj novog korisnika
          </button>
        )}
      </header>

      <main className="flex-1 p-6 space-y-6">
        {pendingInvites.length > 0 && !isCook && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-900">Pozvani korisnici pre registracije (čekaju prijavu)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {pendingInvites.map(invite => (
                <div key={invite.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-200 shadow-sm text-xs">
                  <div className="space-y-0.5 truncate pr-2">
                    <p className="font-semibold text-slate-900 truncate">{invite.full_name || 'Ime nije uneto'}</p>
                    <p className="text-slate-500 font-mono truncate">{invite.email}</p>
                    <span className="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded uppercase font-bold text-[10px] mt-1">{formatRole(invite.role)}</span>
                  </div>
                  <button onClick={() => handleDeleteInvite(invite.id)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Aktivni članovi tima i dokumentacija</h2>
            <p className="text-xs text-slate-500">Pregled zaposlenih, uloga, sanitarnih knjižica i ugovora o radu.</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Učitavanje...</div>
          ) : employees.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">Nema aktivnih članova tima.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-6">Ime i prezime</th>
                    <th className="py-3 px-4">Email / Telefon</th>
                    <th className="py-3 px-4">Rola</th>
                    <th className="py-3 px-4">Sanitarna knjižica ističe:</th>
                    <th className="py-3 px-4">Ugovor o radu</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-6 text-right">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {employees.map(emp => {
                    const isEditing = editingId === emp.id;
                    const isSuspended = emp.is_suspended;
                    const isTargetOwner = (emp.role || '').toLowerCase().includes('owner');
                    const isTargetCook = (emp.role || '').toLowerCase().includes('cook');
                    const isSelf = emp.id === currentUserId;

                    const canEditUser = !isCook && !isSelf;
                    const canSuspendUser = isOwner ? (!isSelf && !isTargetOwner) : (isChef && isTargetCook);
                    const canDeleteUser = isOwner && !isSelf && !isTargetOwner;

                    return (
                      <tr key={emp.id} className={`hover:bg-slate-50/50 ${isSuspended ? 'opacity-60 bg-slate-50' : ''}`}>
                        <td className="py-4 px-6 font-semibold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="rounded border px-2 py-1 text-xs bg-white text-slate-900 w-full"
                            />
                          ) : (
                            emp.full_name || 'Nema unetog imena'
                          )}
                        </td>
                        <td className="py-4 px-4 text-slate-600 font-mono">
                          <div>{emp.email}</div>
                          {emp.phone && <div className="text-[10px] text-slate-400">{emp.phone}</div>}
                        </td>
                        <td className="py-4 px-4 font-medium">
                          {isEditing && isOwner ? (
                            <select
                              value={editRole}
                              onChange={e => setEditRole(e.target.value)}
                              className="rounded border px-2 py-1 text-xs bg-white text-slate-900"
                            >
                              <option value="res_cook">Kuvar</option>
                              <option value="res_chef">Chef</option>
                              <option value="res_owner">Vlasnik</option>
                            </select>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded border">{formatRole(emp.role)}</span>
                          )}
                        </td>

                        {/* Sanitarna knjižica */}
                        <td className="py-4 px-4 font-mono">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editSanitaryExpiry}
                              onChange={e => setEditSanitaryExpiry(e.target.value)}
                              className="rounded border px-2 py-1 text-xs bg-white text-slate-900"
                            />
                          ) : (
                            <span>
                              {emp.sanitary_expiry || <span className="text-amber-600 italic font-sans">Nije uneto</span>}
                            </span>
                          )}
                        </td>

                        {/* Ugovor o radu */}
                        <td className="py-4 px-4">
                          {isEditing ? (
                            <div className="space-y-1.5 p-1 bg-slate-50 rounded border border-slate-200">
                              <div className="text-[10px] text-slate-500 flex items-center justify-between">
                                <span>Od:</span>
                                <input type="date" value={editContractStart} onChange={e => setEditContractStart(e.target.value)} className="rounded border px-1 py-0.5 bg-white text-slate-900" />
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center justify-between">
                                <span>Do:</span>
                                <input type="date" disabled={editContractIndeterminate} value={editContractEnd} onChange={e => setEditContractEnd(e.target.value)} className={`rounded border px-1 py-0.5 text-slate-900 ${editContractIndeterminate ? 'bg-slate-100 opacity-50' : 'bg-white'}`} />
                              </div>
                              <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-700 pt-0.5 cursor-pointer">
                                <input type="checkbox" checked={editContractIndeterminate} onChange={e => setEditContractIndeterminate(e.target.checked)} className="rounded border-slate-300 text-emerald-600 h-3 w-3" />
                                Na neodređeno
                              </label>
                            </div>
                          ) : (
                            <div className="text-[11px] space-y-0.5 font-mono">
                              <div>Od: {emp.contract_start || '-'}</div>
                              <div>
                                {emp.contract_indeterminate ? (
                                  <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-sans font-bold inline-block mt-0.5">Na neodređeno</span>
                                ) : (
                                  `Do: ${emp.contract_end || '-'}`
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center">
                          {isSuspended ? (
                            <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                              <Lock className="h-3 w-3" /> Suspendovan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                              <Unlock className="h-3 w-3" /> Aktivan
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          {isEditing ? (
                            <>
                              <button onClick={() => handleSaveEdit(emp.id, emp.role)} className="px-2.5 py-1 rounded bg-emerald-600 text-white font-semibold shadow-sm">Sačuvaj</button>
                              <button onClick={() => setEditingId(null)} className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 font-semibold">Otkaži</button>
                            </>
                          ) : (
                            <>
                              {canEditUser && (
                                <button
                                  onClick={() => {
                                    setEditingId(emp.id);
                                    setEditName(emp.full_name || '');
                                    setEditRole(emp.role || 'res_cook');
                                    setEditSanitaryExpiry(emp.sanitary_expiry || '');
                                    setEditContractStart(emp.contract_start || '');
                                    setEditContractEnd(emp.contract_end || '');
                                    setEditContractIndeterminate(emp.contract_indeterminate || false);
                                  }}
                                  className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                                >
                                  Izmeni
                                </button>
                              )}

                              {canSuspendUser && (
                                <button
                                  onClick={() => handleToggleSuspend(emp.id, !!isSuspended, emp.role)}
                                  className={`px-2.5 py-1 rounded font-semibold ${isSuspended ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                                >
                                  {isSuspended ? 'Aktiviraj' : 'Suspenduj'}
                                </button>
                              )}

                              {canDeleteUser && (
                                <button
                                  onClick={() => handleDeleteEmployee(emp.id, emp.role)}
                                  className="px-2.5 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200 font-semibold"
                                >
                                  Ukloni
                                </button>
                              )}

                              {!canEditUser && !canSuspendUser && !canDeleteUser && (
                                <span className="text-[11px] text-slate-400 italic">Samo pregled</span>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODAL ZA DODAVANJE KORISNIKA */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-900">Dodaj novog korisnika</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <button
                onClick={() => { setAddMode('email'); setFoundUserForCode(null); }}
                className={`flex-1 py-1.5 rounded-md transition-colors ${addMode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Pre registracije (Email)
              </button>
              <button
                onClick={() => setAddMode('code')}
                className={`flex-1 py-1.5 rounded-md transition-colors ${addMode === 'code' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
              >
                Posle registracije (Kôd)
              </button>
            </div>

            {addMode === 'email' ? (
              <form onSubmit={handleAddByEmail} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email adresa</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="korisnik@restoran.com"
                    className="w-full rounded-lg border px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ime i prezime (opciono)</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Petar Petrović"
                    className="w-full rounded-lg border px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pozicija / Rola</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="res_cook">Kuvar</option>
                    <option value="res_chef">Chef</option>
                    {isOwner && <option value="res_owner">Vlasnik</option>}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">Otkaži</button>
                  <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Pošalji poziv</button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 pt-2">
                {!foundUserForCode ? (
                  <form onSubmit={handleSearchByCode} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Unesite kôd radnika (8 karaktera)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputCode}
                          onChange={e => setInputCode(e.target.value)}
                          placeholder="npr. A9B2X7K1"
                          className="flex-1 rounded-lg border px-3 py-2 text-xs font-mono tracking-widest uppercase text-slate-900 focus:outline-none focus:border-emerald-600"
                          required
                        />
                        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">Pronađi</button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4 border p-4 rounded-xl bg-slate-50">
                    <div className="text-xs space-y-1 text-slate-800">
                      <p className="font-bold text-emerald-700 flex items-center gap-1"><Check className="h-4 w-4" /> Korisnik pronađen!</p>
                      <p><strong>Email:</strong> {foundUserForCode.email}</p>
                      <p><strong>Telefon:</strong> {foundUserForCode.phone || 'Nije unet'}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Potvrdite / Izmenite ime i prezime</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-xs bg-white text-slate-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Dodelite rolu</label>
                      <select
                        value={newRole}
                        onChange={e => setNewRole(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-xs bg-white text-slate-900"
                      >
                        <option value="res_cook">Kuvar</option>
                        <option value="res_chef">Chef</option>
                        {isOwner && <option value="res_owner">Vlasnik</option>}
                      </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setFoundUserForCode(null)} className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">Nazad</button>
                      <button type="button" onClick={handleConfirmAddByCode} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Dodaj u tim</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}