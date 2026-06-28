import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { authGuard } from './middleware/auth.js';
import { creditsRouter } from './routes/credits.js';
import { topupRouter, topupPublicRouter, paymentWebhook } from './routes/topup.js';
import { generateRouter, generatePublicRouter } from './routes/generate.js';
import { imagesRouter, imagesPublicRouter } from './routes/images.js';
import { historyRouter } from './routes/history.js';

const app = new Hono();

app.use('*', cors({ origin: config.corsOrigin, credentials: true }));

app.get('/health', (c) => c.json({ ok: true }));

// 公开接口（无需认证）
app.route('/api/topup', topupPublicRouter);
app.route('/api/generate', generatePublicRouter);
app.route('/api/images', imagesPublicRouter);

// 支付回调：不走 JWT 认证，走签名验证
app.route('/webhook', paymentWebhook);

const api = new Hono();
api.use('*', authGuard);
api.route('/credits', creditsRouter);
api.route('/topup', topupRouter);
api.route('/generate', generateRouter);
api.route('/images', imagesRouter);
api.route('/history', historyRouter);

app.route('/api', api);

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`Credits server running on :${config.port}`);
});
