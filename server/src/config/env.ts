import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://restpos:restpos123@localhost:5432/restpos',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  printerKitchen: process.env.PRINTER_KITCHEN || '',
  printerBar: process.env.PRINTER_BAR || '',
  printerCashier: process.env.PRINTER_CASHIER || '',
};
