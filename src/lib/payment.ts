import * as PortOne from '@portone/browser-sdk/v2';
import type { PaymentResponse, IssueBillingKeyResponse } from '@portone/browser-sdk/v2';

// PortOne client-side keys are public-safe (protected by PortOne's own auth).
// We embed fallback values so the build works even when .env is not present
// at build time, mirroring the supabase.ts fallback pattern.
const FALLBACK_STORE_ID = 'store-ipc8b';
const FALLBACK_CHANNEL_KEY = 'channel-key-6a54b6b2-756b-4cf6-a5af-8fc0e33baa19';

const STORE_ID = (import.meta.env.VITE_PORTONE_STORE_ID as string | undefined) || FALLBACK_STORE_ID;
const CHANNEL_KEY = (import.meta.env.VITE_PORTONE_CHANNEL_KEY as string | undefined) || FALLBACK_CHANNEL_KEY;

export function isPaymentConfigured(): boolean {
  return !!STORE_ID && !!CHANNEL_KEY;
}

export interface ProductPaymentInput {
  paymentId: string;
  orderName: string;
  totalAmount: number;
  customer: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
  };
  redirectUrl?: string;
}

export async function requestProductPayment(input: ProductPaymentInput): Promise<PaymentResponse | undefined> {
  if (!STORE_ID || !CHANNEL_KEY) throw new Error('결제 설정이 누락되었습니다.');
  return PortOne.requestPayment({
    storeId: STORE_ID,
    channelKey: CHANNEL_KEY,
    paymentId: input.paymentId,
    orderName: input.orderName,
    totalAmount: input.totalAmount,
    currency: PortOne.PaymentCurrency.KRW,
    payMethod: PortOne.PaymentPayMethod.CARD,
    customer: {
      fullName: input.customer.fullName,
      phoneNumber: input.customer.phoneNumber,
      email: input.customer.email,
    },
    redirectUrl: input.redirectUrl,
  });
}

export interface BillingKeyInput {
  issueId: string;
  issueName: string;
  customer: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
  };
  redirectUrl?: string;
}

export async function requestBillingKey(input: BillingKeyInput): Promise<IssueBillingKeyResponse | undefined> {
  if (!STORE_ID || !CHANNEL_KEY) throw new Error('결제 설정이 누락되었습니다.');
  return PortOne.requestIssueBillingKey({
    storeId: STORE_ID,
    channelKey: CHANNEL_KEY,
    issueId: input.issueId,
    issueName: input.issueName,
    billingKeyMethod: PortOne.PaymentPayMethod.CARD,
    customer: {
      fullName: input.customer.fullName,
      phoneNumber: input.customer.phoneNumber,
      email: input.customer.email,
    },
    redirectUrl: input.redirectUrl,
  });
}

export function generatePaymentId(prefix: string = 'payment'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
