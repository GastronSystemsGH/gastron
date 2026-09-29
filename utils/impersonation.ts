import Cookies from 'js-cookie';

export const IMPERSONATION_COOKIE = 'impersonated_user_id';

export function startImpersonation(userId: string, role?: string) {
  // path: '/' osigurava da cookie važi za celu aplikaciju
  Cookies.set(IMPERSONATION_COOKIE, userId, { expires: 1, path: '/' });
  
  const cleanRole = (role || '').toLowerCase();
  
  // Ruter na osnovu uloge korisnika kog preuzimaš
  if (cleanRole === 'admin' || cleanRole === 'superadmin') {
    window.location.href = '/admin';
  } else if (cleanRole === 'dis_driver' || cleanRole.includes('driver')) {
    window.location.href = '/driver';
  } else if (cleanRole.startsWith('dis_') || cleanRole.includes('distributor')) {
    window.location.href = '/distributor';
  } else {
    // Default putanja za restoran (Owner, Chef, Cook)
    window.location.href = '/restaurant/dashboard';
  }
}

export function stopImpersonation() {
  // Brisanje cookie-ja mora takođe da uključi path: '/'
  Cookies.remove(IMPERSONATION_COOKIE, { path: '/' });
  window.location.href = '/admin/team';
}

export function getImpersonatedUserId(): string | undefined {
  return Cookies.get(IMPERSONATION_COOKIE);
}