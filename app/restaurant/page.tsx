'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Cookies from 'js-cookie';
import { ShoppingBag, Plus, Minus, Search, Star, ChevronDown, ChevronUp, Bell, Users, DollarSign, Clock, TrendingUp, AlertTriangle, Play, Square, Image as ImageIcon, Settings, Utensils, QrCode, CheckCircle, PackageCheck, Lock, BookOpen, Trash2 } from 'lucide-react';

export default function RestaurantDashboard() {
  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [restaurantOrgId, setRestaurantOrgId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'catalog' | 'orders' | 'recipes' | 'team' | 'schedules'>('dashboard');
  
  const [products, setProducts] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [schedulesList, setSchedulesList] = useState<any[]>([]);

  const [isOwner, setIsOwner] = useState(false);
  const [isChef, setIsChef] = useState(false);
  const [isCook, setIsCook] = useState(false);
  const [spendingFilter, setSpendingFilter] = useState<string>('this_month');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // --- FETCH DATA (SA GHOST MODE FIXOM) ---
  const fetchData = async () => {
    const supabase = createClient();
    
    // HIBRIDNI FIX: Uzima iz localStorage-a ako kolačić nije dostupan (zbog httpOnly)
    const impersonatedId = localStorage.getItem('impersonated_user_id') || Cookies.get('impersonated_user_id');
    const { data: { user } } = await supabase.auth.getUser();
    
    const effectiveUserId = impersonatedId || user?.id;
    if (!effectiveUserId) {
      window.location.href = '/login';
      return;
    }
    
    setCurrentUserId(effectiveUserId);
    setIsGhostMode(!!impersonatedId);

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', effectiveUserId)
      .single();

    if (!profile) {
      setLoading(false);
      return;
    }

    setRestaurantOrgId(profile.organization_id);
    setCurrentUserName(profile.full_name || 'Korisnik');
    const roleStr = (profile.role || '').toLowerCase();
    
    setIsOwner(roleStr.includes('owner') || roleStr.includes('res_owner'));
    setIsChef(roleStr.includes('chef') || roleStr.includes('res_chef'));
    setIsCook(!roleStr.includes('owner') && !roleStr.includes('chef'));

    // Učitaj podatke vezane ISKLJUČIVO za ovu organizaciju
    const [profs, scheds, recipesData, prods, ordersData] = await Promise.all([
      supabase.from('profiles').select('*').eq('organization_id', profile.organization_id),
      supabase.from('weekly_schedules').select('*').eq('organization_id', profile.organization_id),
      supabase.from('recipes').select('*, recipe_items(*, products(*))').eq('organization_id', profile.organization_id),
      supabase.from('products').select('*'),
      supabase.from('orders').select('*').eq('restaurant_id', profile.organization_id).order('created_at', { ascending: false })
    ]);

    setProfilesList(profs.data || []);
    setSchedulesList(scheds.data || []);
    setRecipes(recipesData.data || []);
    setProducts(prods.data || []);
    setOrders(ordersData.data || []);

    const empIds = (profs.data || []).map(p => p.id);
    if (empIds.length > 0) {
      const { data: att } = await supabase.from('staff_attendance').select('*').in('user_id', empIds);
      setAttendanceRecords(att || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- CART LOGIKA ---
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const handleCheckout = async () => {
    setLoading(true);
    const supabase = createClient();
    const impersonatedId = localStorage.getItem('impersonated_user_id') || Cookies.get('impersonated_user_id');
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('orders').insert({
      restaurant_id: restaurantOrgId,
      items: cart,
      total_amount: cartTotal,
      user_id: impersonatedId || user?.id,
      status: 'pending'
    });
    setCart([]);
    await fetchData();
    setLoading(false);
  };

  // --- RENDER ---
  if (loading) return <div className="p-12 text-center text-xs">Učitavanje podataka...</div>;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold">Dobrodošao, {currentUserName}</h1>
          {isGhostMode && (
             <span className="bg-rose-100 text-rose-800 px-3 py-1 rounded text-[10px] font-bold uppercase">
               Ghost Mode Aktivan
             </span>
          )}
        </div>
        
        <nav className="flex gap-2">
            <button onClick={() => setActiveTab('dashboard')} className="px-3 py-1 bg-slate-100 rounded text-xs">Dashboard</button>
            <button onClick={() => setActiveTab('catalog')} className="px-3 py-1 bg-slate-100 rounded text-xs">Katalog</button>
            <button onClick={() => setActiveTab('orders')} className="px-3 py-1 bg-slate-100 rounded text-xs">Porudžbine</button>
        </nav>
      </header>

      {/* Ovde ubacuješ ostatak svog originalnog JSX-a za dashboard, katalog, itd. */}
      {/* Koristi 'orders', 'recipes', 'profilesList' state-ove koje smo učitali u fetchData */}
      <main className="p-6">
         {activeTab === 'dashboard' && <div className="text-sm">Dashboard sadržaj...</div>}
         {activeTab === 'catalog' && (
            <div className="space-y-4">
                {products.map(p => (
                    <div key={p.id} className="flex justify-between border-b py-2">
                        <span>{p.name}</span>
                        <button onClick={() => setCart([...cart, { ...p, quantity: 1 }])} className="bg-emerald-600 text-white px-2 py-1 rounded text-xs">Dodaj</button>
                    </div>
                ))}
            </div>
         )}
         {activeTab === 'orders' && (
             <div className="space-y-4">
                 {orders.map(o => (
                     <div key={o.id} className="border p-2 rounded">Porudžbina: {o.total_amount} RSD</div>
                 ))}
             </div>
         )}
      </main>
    </div>
  );
}