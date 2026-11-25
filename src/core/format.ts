const nf = new Intl.NumberFormat('fr-FR'); // thin-space thousands: "9 201"

export const num = (n: number) => nf.format(n).replace(/ | /g, ' ');

/** "5 shulker + 561", "19 stack + 46", or "" when below one stack. */
export function formatQty(n: number, stack = 64): string {
  const shulker = 27 * stack;
  if (n >= shulker) {
    const s = Math.floor(n / shulker), r = n - s * shulker;
    return r ? `${s} shulker + ${num(r)}` : `${s} shulker`;
  }
  if (stack > 1 && n >= stack) {
    const s = Math.floor(n / stack), r = n - s * stack;
    return r ? `${s} stack + ${r}` : `${s} stack`;
  }
  return '';
}

export const shulkers = (n: number, stack = 64) => Math.round((n / (27 * stack)) * 10) / 10;
