'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Store, Utensils, Clock, Users, LogOut, DollarSign, 
  PackageCheck, UserCog, ShieldCheck, Building2,
  BarChart3, ShoppingCart, Package, Calendar, Truck, User,
  Menu, X, LayoutDashboard
} from 'lucide-react';
import { getImpersonatedUserId } from '@/utils/impersonation';

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  const supabase = createClient();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function getUserProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Kljucna izmena za GHOST mode - Sidebar ucitava osobu koju impersoniras
      const effectiveUserId = getImpersonatedUserId() || user.id;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', effectiveUserId)
        .single();

      if (profile) {
        setRole(profile.role);
        
        if (profile.full_name && profile.full_name.trim() !== '') {
          const firstName = profile.full_name.trim().split(' ')[0];
          setUserName(firstName);
        } else if (profile.email) {
          const emailPrefix = profile.email.split('@')[0];
          setUserName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
        }
      }
      setLoading(false);
    }

    getUserProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  if (pathname === '/login' || pathname === '/register') {
    return null;
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  
  // Formatiranje datuma sa slovima
  const days = ['ned', 'pon', 'uto', 'sre', 'čet', 'pet', 'sub'];
  const dayName = days[now.getDay()];
  const formattedDate = `${dayName}, ${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}.`;
  const formattedTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const hours = now.getHours();
  const greetingWord = hours >= 19 || hours < 5 ? 'Dobro veče' : 'Dobar dan';

  const restaurantNav = [
    { label: 'Dashboard', href: '/restaurant/dashboard', icon: LayoutDashboard },
    { label: 'Nabavka i katalog', href: '/restaurant/catalog', icon: Store },
    { label: 'Recepti i Food Cost', href: '/restaurant/recipes', icon: Utensils },
    { label: 'Smene', href: '/restaurant/attendance', icon: Clock },
    { label: 'Moj tim', href: '/restaurant/team', icon: Users },
    { label: 'Porudžbine', href: '/restaurant/orders', icon: PackageCheck },
    { label: 'Plate', href: '/restaurant/salaries', icon: DollarSign },
    { label: 'Moj profil', href: '/restaurant/profile', icon: UserCog },
  ];

  const adminNav = [
    { label: 'Admin Dashboard', href: '/admin', icon: ShieldCheck },
    { label: 'Partneri', href: '/admin/partners', icon: Building2 },
    { label: 'Moj Tim', href: '/admin/team', icon: Users },
    { label: 'Moj profil', href: '/admin/profile', icon: User },
  ];

  const distributorNav = [
    { label: 'Dashboard', href: '/distributor', icon: BarChart3 },
    { label: 'Porudžbine', href: '/distributor/orders', icon: ShoppingCart },
    { label: 'Katalog', href: '/distributor/catalog', icon: Package },
    { label: 'Dostavni dani', href: '/distributor/delivery-schedule', icon: Calendar },
    { label: 'Moj tim', href: '/distributor/team', icon: Users },
    { label: 'Vozači', href: '/distributor/drivers', icon: Truck },
    { label: 'Moj profil', href: '/distributor/profile', icon: User },
  ];

  const driverNav = [
    { label: 'Dashboard', href: '/driver', icon: BarChart3 },
    { label: 'Porudžbine za dostavu', href: '/driver/orders', icon: Truck },
    { label: 'Moje Smene', href: '/driver/shifts', icon: Clock },
    { label: 'Moj profil', href: '/driver/profile', icon: User },
  ];

  const cleanRole = (role || '').toLowerCase();

  const isAdmin = cleanRole === 'admin' || cleanRole === 'superadmin' || pathname === '/admin' || pathname.startsWith('/admin/');
  const isDriver = cleanRole === 'dis_driver' || cleanRole === 'driver' || cleanRole.includes('driver') || pathname.startsWith('/driver');
  const isDistributor = !isDriver && (cleanRole.startsWith('dis_') || cleanRole.includes('distributor') || pathname.startsWith('/distributor'));

  const navItems = isAdmin 
    ? adminNav 
    : isDriver
      ? driverNav
      : isDistributor 
        ? distributorNav 
        : restaurantNav;

  if (loading) {
    return (
      <aside className="w-64 bg-slate-900 min-h-screen p-4 text-slate-400 text-xs flex items-center justify-center shrink-0">
        Učitavanje menija...
      </aside>
    );
  }

  return (
    <>
      <div className="lg:hidden flex items-center justify-between bg-slate-900 text-white px-3 py-2.5 border-b border-slate-800 w-full fixed top-0 z-40">
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Otvori meni"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs">
              {isAdmin ? 'A' : isDriver ? 'V' : isDistributor ? 'D' : 'R'}
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider leading-none">
                {greetingWord}
              </span>
              <span className="text-xs font-bold text-white tracking-tight truncate max-w-[100px] leading-tight mt-0.5">
                {userName || 'Korisnik'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end bg-slate-950/70 border border-slate-800/80 rounded-md px-2 py-1">
          <span className="text-[10px] font-bold font-mono tracking-wider text-emerald-400 tabular-nums leading-none">
            {formattedTime}
          </span>
          <span className="text-[8px] font-medium font-mono text-slate-400 leading-none mt-0.5 uppercase">
            {formattedDate}
          </span>
        </div>
      </div>

      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        />
      )}

      <aside className={`
        fixed lg:static top-0 left-0 bottom-0 z-50
        w-64 flex-col bg-slate-900 text-white flex min-h-screen border-r border-slate-800 shrink-0
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0 pt-14 lg:pt-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="hidden lg:flex h-20 items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0 pr-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-extrabold text-sm shrink-0 shadow-sm">
              {isAdmin ? 'A' : isDriver ? 'V' : isDistributor ? 'D' : 'R'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none">
                {greetingWord}
              </span>
              <span className="text-xs font-bold text-white tracking-tight truncate max-w-[105px] leading-tight mt-1" title={userName}>
                {userName || 'Korisnik'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end bg-slate-950/80 border border-slate-800/90 rounded-lg px-2.5 py-1.5 shrink-0 shadow-inner">
            <span className="text-[11px] font-bold font-mono tracking-widest text-emerald-400 tabular-nums leading-none">
              {formattedTime}
            </span>
            <span className="text-[9px] font-medium font-mono tracking-tight text-slate-400 mt-1 leading-none uppercase">
              {formattedDate}
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${
                  isActive 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-400 hover:bg-rose-950/40 hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Odjavi se
          </button>
        </div>
      </aside>
    </>
  );
}