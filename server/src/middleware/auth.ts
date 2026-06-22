import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';

type AuthEnv = { Variables: { userId: string } };

const jwks = createRemoteJWKSet(
  new URL(`${config.logtoEndpoint}/oidc/jwks`),
);

export const authGuard = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'UNAUTHORIZED' }, 401);
  }

  const token = header.slice(7);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${config.logtoEndpoint}/oidc`,
      audience: config.logtoAudience || undefined,
      clockTolerance: 30 * 24 * 60 * 60, // ID Token 有效期短，宽容 30 天（后续切 Access Token + API Resource）
    });
    const userId = payload.sub;
    if (!userId) return c.json({ error: 'INVALID_TOKEN' }, 401);
    c.set('userId', userId);
    await next();
  } catch {
    return c.json({ error: 'INVALID_TOKEN' }, 401);
  }
});
