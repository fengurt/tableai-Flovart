const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
};

export const config = {
  port: Number(process.env.PORT || 3100),
  databaseUrl: required('DATABASE_URL'),
  logtoEndpoint: required('LOGTO_ENDPOINT'),
  logtoAudience: process.env.LOGTO_AUDIENCE || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:11451',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
};

export const CREDIT_COST_PER_IMAGE = 50;
export const SIGNUP_BONUS = 80;

export const TOPUP_TIERS = {
  tier_10:  { amountCents: 1000,  credits: 1000  },
  tier_50:  { amountCents: 5000,  credits: 5500  },
  tier_100: { amountCents: 10000, credits: 12000 },
} as const;

export type TopupTier = keyof typeof TOPUP_TIERS;
