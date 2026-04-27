import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';
import authRoutes from './routes/auth';
import recordRoutes from './routes/records';
import contactRoutes from './routes/contacts';
import homeRoutes from './routes/home';

const app = new Hono();

// Middleware
app.use('*', logger()); // 增加 Hono 标准日志
app.use('*', cors());
app.use('*', async (c, next) => {
  // 禁用 API 缓存，防止切换页面时读到旧的错误状态
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
  await next();
});

// JWT Authentication Middleware
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/auth/login' || c.req.path === '/api/auth/login/') {
    return next();
  }

  const secret = c.env.JWT_SECRET;
  if (!secret || secret === 'REPLACE_WITH_JWT_SECRET') {
    console.error('Missing JWT_SECRET');
    return c.json({ success: false, error: 'Config Error: JWT_SECRET missing' }, 500);
  }

  const jwtMiddleware = jwt({
    secret: secret,
    alg: 'HS256'
  });
  
  try {
    return await jwtMiddleware(c, next);
  } catch (err) {
    console.warn(`JWT Auth Failed for ${c.req.path}:`, err.message);
    return c.json({ success: false, error: 'Unauthorized', message: err.message }, 401);
  }
});

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/records', recordRoutes);
app.route('/api/contacts', contactRoutes);
app.route('/api/home', homeRoutes);

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Exception:', err);
  return c.json({ success: false, error: 'Internal Server Error', message: err.message }, 500);
});

// Health Check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date() }));
app.get('/', (c) => c.text('WhoxWho Backend is running.'));

export default app;
