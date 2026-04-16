import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';

const SESSION_DIR = path.resolve(__dirname, '../../../.banregio-session');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let browser: Browser | null = null;
let context: BrowserContext | null = null;

async function getContext(): Promise<BrowserContext> {
  if (context) {
    try { await context.pages(); return context; } catch { context = null; browser = null; }
  }

  browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const storagePath = path.join(SESSION_DIR, 'state.json');
  context = await browser.newContext({
    storageState: fs.existsSync(storagePath) ? storagePath : undefined,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    geolocation: { latitude: 25.6866, longitude: -100.3161 },
    permissions: ['geolocation'],
  });

  return context;
}

async function saveSession() {
  if (!context) return;
  await context.storageState({ path: path.join(SESSION_DIR, 'state.json') }).catch(() => {});
}

async function getPage(): Promise<Page> {
  const ctx = await getContext();
  const pages = ctx.pages();
  return pages.length > 0 ? pages[0] : await ctx.newPage();
}

// Helper: type in a mat-autocomplete search field and pick first result
async function searchAndSelect(page: Page, inputIndex: number, searchText: string): Promise<boolean> {
  const inputs = await page.locator('input[role="combobox"], mat-form-field input, input[matinput]').all();
  if (inputIndex >= inputs.length) return false;

  const input = inputs[inputIndex];
  await input.click();
  await input.fill('');
  // Type at least 3 chars to trigger search
  const query = searchText.length >= 3 ? searchText : searchText + '   ';
  await input.type(query.substring(0, Math.max(3, query.length)), { delay: 100 });
  await page.waitForTimeout(2000);

  // Pick first option
  const option = page.locator('mat-option').first();
  if (await option.count() > 0) {
    await option.click();
    console.log(`[banregio] selected option for "${searchText}"`);
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

// ─── Login ───

export async function login(token: string): Promise<{ status: string; message: string }> {
  const page = await getPage();

  await page.goto(`${env.banregioUrl}/#/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Step 1: Username
  console.log('[banregio] step 1: username');
  const userInput = page.locator('input:visible').first();
  await userInput.click({ clickCount: 3 });
  await userInput.fill(env.banregioUser);
  await page.waitForTimeout(500);

  await page.locator('button:has-text("Continuar")').click();
  await page.waitForTimeout(4000);

  // Step 2: Password + Token
  console.log('[banregio] step 2: password + token');
  await page.waitForSelector('#password', { timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.locator('#password').click();
  await page.waitForTimeout(300);
  await page.locator('#password').fill(env.banregioPass);
  console.log('[banregio] password filled');

  await page.waitForTimeout(500);
  await page.locator('input[placeholder="Ingresa tu token"]').click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Ingresa tu token"]').fill(token);
  console.log('[banregio] token filled');

  await page.waitForTimeout(500);
  await page.locator('button:has-text("Continuar")').click();
  await page.waitForTimeout(8000);

  const pageText = await page.textContent('body').catch(() => '');
  const url = page.url();

  if (pageText?.includes('incorrecto') || pageText?.includes('invalido') || pageText?.includes('bloqueado')) {
    return { status: 'error', message: 'Login fallido. Verifica tus datos o token.' };
  }

  if (!url.includes('login')) {
    await saveSession();
    return { status: 'ok', message: 'Sesion iniciada en Banregio' };
  }

  return { status: 'pending', message: 'Revisa el navegador para completar el login.' };
}

// ─── Get beneficiaries ───

export async function getBeneficiaries(): Promise<{ status: string; beneficiaries: any[] }> {
  const page = await getPage();
  const menuLink = page.locator('a:has-text("Transferencias"), span:has-text("Transferencias")').first();
  if (await menuLink.count() > 0) await menuLink.click();
  await page.waitForTimeout(3000);
  return { status: 'ok', beneficiaries: [] };
}

// ─── Make transfer ───

export async function makeTransfer(data: {
  beneficiary: string;
  amount: number;
  concept: string;
  token: string;
}): Promise<{ status: string; message: string }> {
  const page = await getPage();

  // ── Navigate to Transferencias via menu ──
  console.log('[banregio] navigating to Transferencias...');
  const menuLink = page.locator('a:has-text("Transferencias"), span:has-text("Transferencias")').first();
  if (await menuLink.count() > 0) {
    await menuLink.click();
    await page.waitForTimeout(3000);
  }

  // ══ PAGE 1: Search dropdowns + monto ══

  // 1. Search beneficiary (first search input) — type name to trigger autocomplete
  console.log('[banregio] searching beneficiary:', data.beneficiary);
  const selected1 = await searchAndSelect(page, 0, data.beneficiary);
  if (!selected1) {
    console.log('[banregio] beneficiary not found, trying partial...');
    await searchAndSelect(page, 0, data.beneficiary.substring(0, 5));
  }

  await page.waitForTimeout(1000);

  // 2. Search source account (second search input) — type "Naranja" or account number
  console.log('[banregio] searching source account...');
  const selected2 = await searchAndSelect(page, 1, 'Naranja');
  if (!selected2) {
    await searchAndSelect(page, 1, '183996');
  }

  await page.waitForTimeout(1000);

  // 3. Fill monto
  console.log('[banregio] filling amount:', data.amount);
  // The monto field is an input with "$ 0.00" or similar
  const allInputs = await page.locator('input:visible').all();
  for (const inp of allInputs) {
    const val = await inp.inputValue().catch(() => '');
    if (val === '0.00' || val === '$ 0.00' || val === '0' || val === '') {
      await inp.click({ clickCount: 3 });
      await page.waitForTimeout(200);
      await inp.press('Backspace');
      await page.waitForTimeout(100);
      // Type digit by digit to trigger Angular validation
      await inp.type(Number(data.amount).toFixed(2), { delay: 50 });
      console.log('[banregio] amount typed');
      // Click outside to trigger blur validation
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(500);
      break;
    }
  }

  await page.waitForTimeout(1000);

  // 4. Scroll down and click Transferir or Continuar
  console.log('[banregio] scrolling down and submitting page 1...');
  await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
  await page.waitForTimeout(1000);

  const transferBtn = page.locator('button:has-text("Transferir")').first();
  const continuarBtn = page.locator('button:has-text("Continuar")').first();
  if (await transferBtn.count() > 0 && await transferBtn.isEnabled()) {
    await transferBtn.scrollIntoViewIfNeeded();
    await transferBtn.click();
  } else if (await continuarBtn.count() > 0) {
    await continuarBtn.scrollIntoViewIfNeeded();
    await continuarBtn.click();
  }
  await page.waitForTimeout(4000);

  // ══ PAGE 2 or TOKEN DIALOG ══
  // Banregio might show the token dialog immediately, or show page 2 first
  // Check which one we're on

  const hasDialogNow = await page.evaluate(`
    (() => {
      return document.querySelectorAll('mat-dialog-container, .cdk-overlay-pane').length > 0;
    })()
  `);

  if (!hasDialogNow) {
    // We're on page 2 — fill description and continue
    const descInput = page.locator('textarea:visible').first();
    if (await descInput.count() > 0) {
      console.log('[banregio] page 2: filling description...');
      await descInput.click({ clickCount: 3, force: true });
      await descInput.fill(data.concept.substring(0, 40));
      await page.waitForTimeout(500);
    }

    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(1000);
    const cont2 = page.locator('button:has-text("Continuar")').first();
    if (await cont2.count() > 0) {
      console.log('[banregio] page 2 -> Continuar');
      await cont2.scrollIntoViewIfNeeded();
      await cont2.click();
      await page.waitForTimeout(4000);
    }
  } else {
    console.log('[banregio] dialog already open, skipping page 2');
  }

  // ══ TOKEN DIALOG ══

  // Wait a bit for dialog to be ready
  await page.waitForTimeout(2000);

  const hasTokenField = await page.evaluate(`
    (() => {
      return document.querySelectorAll('mat-dialog-container input, .cdk-overlay-container input').length > 0;
    })()
  `);

  if (hasTokenField) {
    if (data.token) {
      console.log('[banregio] token dialog found, focusing then typing...');

      // Focus the input via script tag (main world)
      await page.addScriptTag({
        content: `(function(){ var el = document.querySelector('mat-dialog-container input'); if(!el) el=document.querySelector('.cdk-overlay-container input'); if(el){el.focus();el.click();} })();`,
      });
      await page.waitForTimeout(500);

      // Type each character via keyboard (like a real person — not paste)
      for (const char of data.token) {
        await page.keyboard.press(char);
        await page.waitForTimeout(150);
      }
      console.log('[banregio] token typed character by character');
      await page.waitForTimeout(1000);

      // Click Continuar via script tag
      await page.addScriptTag({
        content: `(function(){ var b=document.querySelectorAll('mat-dialog-container button,.cdk-overlay-container button'); for(var i=0;i<b.length;i++){if(b[i].textContent.indexOf('Continuar')>=0&&!b[i].disabled){b[i].click();break;}} })();`,
      });
      console.log('[banregio] Continuar clicked');
      await page.waitForTimeout(7000);

      // Check result
      const resultText = await page.textContent('body').catch(() => '');
      if (resultText?.includes('exitosa') || resultText?.includes('realizada') || resultText?.includes('Listo')) {
        await saveSession();
        return { status: 'completed', message: 'Transferencia realizada exitosamente' };
      }
      if (resultText?.includes('rechazada') || resultText?.includes('fallida') || resultText?.includes('incorrecto')) {
        return { status: 'error', message: 'Token incorrecto o expirado.' };
      }
      await saveSession();
      return { status: 'pending', message: 'Revisa el navegador.' };
    }
    return { status: 'needs_token', message: 'Pon tu token en la ventana de Banregio.' };
  }

  // No token input found — maybe transfer went through or different page
  const pageText = await page.textContent('body').catch(() => '');
  if (pageText?.includes('exitosa') || pageText?.includes('realizada') || pageText?.includes('Listo')) {
    await saveSession();
    return { status: 'completed', message: 'Transferencia realizada exitosamente' };
  }

  await saveSession();
  return { status: 'pending', message: 'Revisa el navegador para completar la transferencia.' };
}

// ─── Confirm transfer with token (after needs_token) ───

export async function confirmTransfer(_token: string): Promise<{ status: string; message: string }> {
  const page = await getPage();

  // User already entered the token manually and clicked Continuar
  // Just wait and check the result
  await page.waitForTimeout(3000);

  const pageText = await page.textContent('body').catch(() => '');
  if (pageText?.includes('exitosa') || pageText?.includes('realizada') || pageText?.includes('Listo') || pageText?.includes('completada')) {
    await saveSession();
    return { status: 'completed', message: 'Transferencia realizada exitosamente' };
  }
  if (pageText?.includes('rechazada') || pageText?.includes('fallida') || pageText?.includes('incorrecto')) {
    return { status: 'error', message: 'Transferencia fallida. Token incorrecto o expirado.' };
  }
  await saveSession();
  return { status: 'pending', message: 'Revisa el navegador.' };
}

// ─── Checkout cart (for approved requests) ───

export async function checkoutCart(): Promise<{ status: string; message: string }> {
  return { status: 'ok', message: 'N/A' };
}

// ─── Get balance ───

export async function getBalance(): Promise<{ status: string; balance?: string }> {
  const page = await getPage();
  const resumen = page.locator('a:has-text("Resumen"), span:has-text("Resumen")').first();
  if (await resumen.count() > 0) await resumen.click();
  await page.waitForTimeout(3000);

  const balanceText = await page.evaluate(`
    (() => {
      const el = document.querySelector('[class*="saldo"], [class*="balance"], [class*="amount"], [class*="dinero"]');
      return el ? el.textContent.trim() : null;
    })()
  `).catch(() => null);

  return { status: balanceText ? 'ok' : 'unknown', balance: balanceText as string || 'No disponible' };
}

export async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
    context = null;
  }
}
