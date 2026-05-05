import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimiter';
import { resolveTenant } from './middleware/tenantResolver';
import superAdminRoutes from './modules/superAdmin/routes';

import authRoutes from './modules/auth/routes';
import userRoutes from './modules/users/routes';
import categoryRoutes from './modules/categories/routes';
import productRoutes from './modules/products/routes';
import modifierRoutes from './modules/modifiers/routes';
import floorRoutes from './modules/floors/routes';
import orderRoutes from './modules/orders/routes';
import paymentRoutes from './modules/payments/routes';
import cashRegisterRoutes from './modules/cashRegister/routes';
import reportRoutes from './modules/reports/routes';
import printerRoutes from './modules/printer/routes';
import settingsRoutes from './modules/settings/routes';
import shiftRoutes from './modules/shifts/routes';
import clientRoutes from './modules/clients/routes';
import expenseRoutes from './modules/expenses/routes';
import discountRoutes from './modules/discounts/routes';
import supplierRoutes from './modules/suppliers/routes';
import inventoryRoutes from './modules/inventory/routes';
import purchasingRoutes from './modules/purchasing/routes';
import mercadolibreRoutes from './modules/mercadolibre/routes';
import bankingRoutes from './modules/banking/routes';
import chatbotRoutes from './modules/chatbot/routes';
import agentRoutes from './modules/agent/routes';
import productionRoutes from './modules/productions/routes';
import productRecipeRoutes from './modules/productRecipes/routes';
import attendanceRoutes from './modules/attendance/routes';

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

// CORS — only allow our known origins
const allowedOrigins = [
  env.clientUrl,
  'http://localhost:5173',
  'http://localhost:3001',
  'http://165.227.121.235',
  'https://165.227.121.235',
  'https://restpos.ai',
  'https://www.restpos.ai',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Electron, mobile apps, curl, same-origin)
    if (!origin) return callback(null, true);
    // Allow known origins and file:// (Electron)
    if (origin.startsWith('file://') || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      console.warn(`[cors] blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
}));

// Rate limiting
app.use(globalLimiter);

// Body parsing with size limit
app.use(express.json({ limit: '1mb' }));

// Trust proxy (behind nginx)
app.set('trust proxy', 1);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public menu API (no auth needed)
app.get('/api/public/menu', async (_req, res) => {
  try {
    const { query: dbQuery } = await import('./config/database');
    const result = await dbQuery(`
      SELECT p.name, p.price, c.name as category, pc.name as parent_category
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE p.is_available = true
      ORDER BY COALESCE(pc.name, c.name), c.name, p.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error loading menu' });
  }
});

// Super-admin API (no tenant context needed)
app.use('/api/super-admin', superAdminRoutes);

// Tenant resolver — attaches tenantDb to every authenticated request
// Backward compatible: falls back to legacy pool if no tenantId in JWT
app.use('/api', resolveTenant);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/modifier-groups', modifierRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cash-register', cashRegisterRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/printer', printerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/discounts', discountRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchasing', purchasingRoutes);
app.use('/api/mercadolibre', mercadolibreRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/productions', productionRoutes);
app.use('/api/product-recipes', productRecipeRoutes);
app.use('/api/attendance', attendanceRoutes);

app.use(errorHandler);

// Production: serve the built React client
if (env.nodeEnv === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
