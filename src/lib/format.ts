export function formatKRW(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n) + '원';
}

export function formatKRWShort(n: number): string {
  if (n >= 10000) return new Intl.NumberFormat('ko-KR').format(n) + '원';
  return new Intl.NumberFormat('ko-KR').format(n) + '원';
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function calcDiscountRate(original: number, club: number): number {
  if (original <= 0) return 0;
  return Math.round((1 - club / original) * 100);
}

export function calcDiscountedPrice(original: number, discountRate: number): number {
  return Math.round(original * (1 - discountRate / 100));
}

export function getRemainingDays(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}
