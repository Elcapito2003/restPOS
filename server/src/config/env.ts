import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://restpos:restpos123@localhost:5432/restpos',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  printerKitchen: process.env.PRINTER_KITCHEN || '',
  printerBar: process.env.PRINTER_BAR || '',
  printerCashier: process.env.PRINTER_CASHIER || '',
  openclawUrl: process.env.OPENCLAW_URL || 'http://165.227.121.235:18789',
  openclawToken: process.env.OPENCLAW_TOKEN || '',
  banregioUser: process.env.BANREGIO_USER || '',
  banregioPass: process.env.BANREGIO_PASS || '',
  banregioUrl: process.env.BANREGIO_URL || 'https://empresarial.banregio.com',
  masterDatabaseUrl: process.env.MASTER_DATABASE_URL || 'postgresql://restpos:restpos2026secure@localhost:5432/restpos_master',
  superAdminJwtSecret: process.env.SUPER_ADMIN_JWT_SECRET || 'sa-dev-secret-change-in-production',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  mlClientId: process.env.ML_CLIENT_ID || '5394522073489421',
  mlClientSecret: process.env.ML_CLIENT_SECRET || 'unRiv0lS950eTawpkBIbDt5S3d2rsRR4',
  mlRedirectUri: process.env.ML_REDIRECT_URI || `http://165.227.121.235/ml-callback`,
  // Tenant default para clientes legacy (desktop tradicional sin X-Tenant-Id).
  // Sin esto, los JWT no incluyen tenantId y el socket queda sin tenant.
  defaultTenantId: process.env.DEFAULT_TENANT_ID || 'e60c023f-de03-43a0-b0d5-4665913c02a8',
};
