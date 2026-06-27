import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { authGuard } from './middleware/auth.js';
import { creditsRouter } from './routes/credits.js';
import { topupRouter, topupPublicRouter, paymentWebhook } from './routes/topup.js';
import { generateRouter } from './routes/generate.js';

const app = new Hono();

app.use('*', cors({ origin: config.corsOrigin, credentials: true }));

app.get('/health', (c) => c.json({ ok: true }));

// 公开接口（无需认证）
app.route('/api/topup', topupPublicRouter);

// 支付回调：不走 JWT 认证，走签名验证
app.route('/webhook', paymentWebhook);

const api = new Hono();
api.use('*', authGuard);
api.route('/credits', creditsRouter);
api.route('/topup', topupRouter);
api.route('/generate', generateRouter);

app.route('/api', api);

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`Credits server running on :${config.port}`);
});
