export function isDocumentValid(sanitary_expiry: string, contract_end: string, contract_indeterminate: boolean) {
  const today = new Date();
  
  // 1. Sanitarna (važi 6 meseci od unetog datuma)
  if (sanitary_expiry) {
    const sanitaryDate = new Date(sanitary_expiry);
    const validUntil = new Date(sanitaryDate.setMonth(sanitaryDate.getMonth() + 6));
    if (today > validUntil) return { valid: false, reason: 'Istekla sanitarna knjižica' };
  } else {
    return { valid: false, reason: 'Nema sanitarne knjižice' };
  }

  // 2. Ugovor (ako nije na neodređeno)
  if (!contract_indeterminate && contract_end) {
    const contractDate = new Date(contract_end);
    if (today > contractDate) return { valid: false, reason: 'Istekao ugovor' };
  }

  return { valid: true };
}