import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import authRoutes from './routes/auth';
import recordRoutes from './routes/records';
import contactRoutes from './routes/contacts';
import homeRoutes from './routes/home';

const app = new Hono();

// Middleware
app.use('*', cors());

// JWT Authentication Middleware
// 对除了登录以外的所有 /api 路由进行 JWT 验证
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/auth/login' || c.req.path === '/api/auth/login/') {
    return next();
  }
  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET,
  });
  return jwtMiddleware(c, next);
});

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/records', recordRoutes);
app.route('/api/contacts', contactRoutes);
app.route('/api/home', homeRoutes);

// Health Check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date() }));
app.get('/', (c) => c.text('WhoxWho Backend is running.'));

export default app;
