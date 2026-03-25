import { env } from './env';

export interface PrinterConfig {
  kitchen: string;
  bar: string;
  cashier: string;
}

export function getPrinterConfig(): PrinterConfig {
  return {
    kitchen: env.printerKitchen,
    bar: env.printerBar,
    cashier: env.printerCashier,
  };
}
