import Cookies from 'js-cookie';

export const IMPERSONATION_COOKIE = 'impersonated_user_id';

export function startImpersonation(userId: string) {
  Cookies.set(IMPERSONATION_COOKIE, userId, { expires: 1 }); // Traje 1 dan
  // Preusmeravanje na dashboard šefa kuhinje ili vlasnika
  window.location.href = '/chef'; 
}

export function stopImpersonation() {
  Cookies.remove(IMPERSONATION_COOKIE);
  window.location.href = '/admin/team';
}

export function getImpersonatedUserId(): string | undefined {
  return Cookies.get(IMPERSONATION_COOKIE);
}