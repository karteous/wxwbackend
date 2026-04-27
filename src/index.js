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

// JWT Authentication Middleware (Apply to protected routes)
app.use('/api/protected/*', async (c, next) => {
  const jwtMiddleware = jwt({
    secret: c.env.JWT_SECRET,
  });
  return jwtMiddleware(c, next);
});

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/protected/records', recordRoutes);
app.route('/api/protected/contacts', contactRoutes);
app.route('/api/protected/home', homeRoutes);

// Health Check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date() }));

export default app;
