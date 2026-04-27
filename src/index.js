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
app.use('/api/*', async (c, next) => {
  // 排除登录接口
  if (c.req.path === '/api/auth/login' || c.req.path === '/api/auth/login/') {
    return next();
  }

  // 检查 JWT_SECRET 是否配置
  const secret = c.env.JWT_SECRET;
  if (!secret || secret === 'REPLACE_WITH_JWT_SECRET') {
    return c.json({ 
      success: false, 
      error: '服务器配置错误：缺少 JWT_SECRET。请在 GitHub Secrets 中配置该变量。' 
    }, 500);
  }

  const jwtMiddleware = jwt({
    secret: secret,
    alg: 'HS256' // 显式指定算法
  });
  
  try {
    return await jwtMiddleware(c, next);
  } catch (err) {
    return c.json({ success: false, error: '无效的或已过期的令牌 (Invalid or expired token)' }, 401);
  }
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
