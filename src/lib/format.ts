export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

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

export function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'Invalid credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'Email not confirmed': '이메일 인증이 완료되지 않았습니다. 이메일함을 확인해 주세요.',
    'User already registered': '이미 가입된 이메일입니다.',
    'Password should be at least 6 characters': '비밀번호는 최소 6자 이상이어야 합니다.',
    'Unable to validate email address': '올바르지 않은 이메일 형식입니다.',
  };
  for (const [en, ko] of Object.entries(map)) {
    if (message.includes(en)) return ko;
  }
  return message;
}
