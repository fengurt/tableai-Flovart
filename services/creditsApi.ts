const API_BASE = import.meta.env.VITE_CREDITS_API_URL || '';

let cachedToken: (() => Promise<string>) | null = null;

export const setTokenProvider = (provider: () => Promise<string>) => {
  cachedToken = provider;
};

const authedFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  if (!cachedToken) throw new Error('Token provider not set');
  const token = await cachedToken();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
};

export type CreditBalance = {
  balance: number;
  costPerImage: number;
};

export type TopupTier = {
  id: string;
  priceCents: number;
  credits: number;
};

export const creditsApi = {
  async getBalance(): Promise<CreditBalance> {
    const res = await authedFetch('/api/credits/balance');
    if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`);
    return res.json();
  },

  async deduct(taskId: string): Promise<{ balance: number } | { error: string; balance: number; required: number }> {
    const res = await authedFetch('/api/credits/deduct', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
    const data = await res.json();
    if (res.status === 402) return { error: 'INSUFFICIENT_CREDITS', ...data };
    if (!res.ok) throw new Error(data.error || 'Deduct failed');
    return data;
  },

  async refund(taskId: string): Promise<{ balance: number }> {
    const res = await authedFetch('/api/credits/refund', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
    if (!res.ok && res.status !== 409) throw new Error('Refund failed');
    return res.json();
  },

  async getTiers(): Promise<TopupTier[]> {
    const res = await fetch(`${API_BASE}/api/topup/tiers`);
    if (!res.ok) throw new Error('Failed to fetch tiers');
    const data = await res.json();
    return data.tiers;
  },

  async createTopup(tier: string): Promise<{ orderId: string; amountCents: number; credits: number }> {
    const res = await authedFetch('/api/topup/create', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
    if (!res.ok) throw new Error('Failed to create topup order');
    return res.json();
  },
};
