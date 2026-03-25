import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

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

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
