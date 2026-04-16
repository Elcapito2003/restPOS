import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

const STORAGE_PATH = path.resolve(__dirname, '../../../.ml-session');
const USER_DATA_DIR = path.resolve(__dirname, '../../../.ml-browser');

let browser: Browser | null = null;
let context: BrowserContext | null = null;

// Ensure dirs exist
if (!fs.existsSync(STORAGE_PATH)) fs.mkdirSync(STORAGE_PATH, { recursive: true });

async function getContext(): Promise<BrowserContext> {
  if (context && context.pages().length >= 0) {
    try {
      await context.pages();
      return context;
    } catch {
      context = null;
      browser = null;
    }
  }

  browser = await chromium.launch({
    headless: false, // Visible so user can see what's happening
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const storagePath = path.join(STORAGE_PATH, 'state.json');
  const hasState = fs.existsSync(storagePath);

  context = await browser.newContext({
    storageState: hasState ? storagePath : undefined,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  return context;
}

async function saveSession() {
  if (!context) return;
  const storagePath = path.join(STORAGE_PATH, 'state.json');
  await context.storageState({ path: storagePath });
}

async function getPage(): Promise<Page> {
  const ctx = await getContext();
  const pages = ctx.pages();
  return pages.length > 0 ? pages[0] : await ctx.newPage();
}

// ─── Check if logged in ───

export async function isLoggedIn(): Promise<boolean> {
  try {
    const page = await getPage();
    await page.goto('https://www.mercadolibre.com.mx', { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Check if logged in by looking for user menu
    const loggedIn = await page.locator('[class*="nav-header-user"]').count() > 0
      || await page.locator('a[href*="myml"]').count() > 0;
    return loggedIn;
  } catch {
    return false;
  }
}

// ─── Login — opens ML login page for user to login manually ───

export async function openLogin(): Promise<{ status: string }> {
  const page = await getPage();
  await page.goto('https://www.mercadolibre.com.mx/jms/mlm/lgz/login?platform_id=ML&go=https://www.mercadolibre.com.mx', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  return { status: 'login_page_opened' };
}

// ─── Search products ───

export interface MLSearchResult {
  title: string;
  price: string;
  link: string;
  image: string;
  shipping: string;
  seller: string;
  itemId: string;
}

export async function searchProducts(query: string): Promise<MLSearchResult[]> {
  const page = await getPage();
  const url = `https://listado.mercadolibre.com.mx/${encodeURIComponent(query).replace(/%20/g, '-')}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

  // Wait for results
  await page.waitForSelector('.ui-search-results', { timeout: 10000 }).catch(() => {});

  const results: MLSearchResult[] = await page.evaluate(`
    (() => {
      const items = document.querySelectorAll('.ui-search-layout__item');
      return Array.from(items).slice(0, 20).map(item => {
        const titleEl = item.querySelector('.ui-search-item__title, .poly-component__title a, a.poly-component__title');
        const priceEl = item.querySelector('.andes-money-amount__fraction, .poly-price__current .andes-money-amount__fraction');
        const centEl = item.querySelector('.andes-money-amount__cents');
        const linkEl = item.querySelector('a.ui-search-link, a.poly-component__title, a[href*="MLM"]');
        const imgEl = item.querySelector('img.ui-search-result-image__element, img.poly-component__picture');
        const shippingEl = item.querySelector('.ui-search-item__shipping, .poly-component__shipping');
        const sellerEl = item.querySelector('.ui-search-official-store-label, .poly-component__seller');

        const href = linkEl ? linkEl.getAttribute('href') : '';
        const itemIdMatch = href ? href.match(/MLM-?\\d+/) : null;

        return {
          title: titleEl ? titleEl.textContent.trim() : '',
          price: priceEl ? '$' + priceEl.textContent + (centEl ? '.' + centEl.textContent : '') : '',
          link: href || '',
          image: imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '',
          shipping: shippingEl ? shippingEl.textContent.trim() : '',
          seller: sellerEl ? sellerEl.textContent.trim() : '',
          itemId: itemIdMatch ? itemIdMatch[0].replace('-', '') : '',
        };
      }).filter(r => r.title && r.link);
    })()
  `);

  await saveSession();
  return results;
}

// ─── Add to cart ───

export async function addToCart(productUrl: string, quantity: number = 1): Promise<{ status: string; message: string }> {
  const page = await getPage();

  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Set quantity if > 1
  if (quantity > 1) {
    const qtyInput = page.locator('input[class*="quantity"], input[aria-label*="antidad"]');
    if (await qtyInput.count() > 0) {
      await qtyInput.fill(String(quantity));
      await page.waitForTimeout(500);
    }
  }

  // Click "Agregar al carrito"
  const cartBtn = page.locator('button:has-text("Agregar al carrito"), a:has-text("Agregar al carrito")').first();
  if (await cartBtn.count() > 0) {
    await cartBtn.click();
    await page.waitForTimeout(2000);
    await saveSession();
    return { status: 'added', message: 'Producto agregado al carrito' };
  }

  // Some products don't have "add to cart", only "buy now"
  return { status: 'no_cart', message: 'Este producto solo tiene opcion de compra directa. Usa "Comprar ahora".' };
}

// ─── Buy product (immediate) ───

export async function buyProduct(productUrl: string, quantity: number = 1): Promise<{ status: string; message: string }> {
  const page = await getPage();

  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Set quantity if > 1
  if (quantity > 1) {
    const qtyInput = page.locator('input[class*="quantity"], input[aria-label*="antidad"]');
    if (await qtyInput.count() > 0) {
      await qtyInput.fill(String(quantity));
      await page.waitForTimeout(500);
    }
  }

  // Click "Comprar ahora"
  const buyButton = page.locator('button:has-text("Comprar ahora"), a:has-text("Comprar ahora")').first();
  if (await buyButton.count() === 0) {
    return { status: 'error', message: 'No se encontro el boton de comprar' };
  }

  await buyButton.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  if (page.url().includes('login')) {
    return { status: 'needs_login', message: 'Necesitas iniciar sesion. Dale clic a "Iniciar sesion en navegador".' };
  }

  // Navigate through checkout steps
  const result = await completeCheckout(page);
  await saveSession();
  return result;
}

async function completeCheckout(page: Page): Promise<{ status: string; message: string }> {
  // Try up to 5 steps of clicking continue/confirm buttons
  for (let step = 0; step < 5; step++) {
    await page.waitForTimeout(2000);

    // Check if purchase is complete
    const url = page.url();
    console.log(`[ml-browser] step ${step}, url: ${url.substring(0, 100)}`);

    // Check page content for success indicators
    const pageText = await page.textContent('body').catch(() => '');
    const isComplete = url.includes('congrats') || url.includes('success') || url.includes('confirmation')
      || pageText?.includes('Listo, compraste') || pageText?.includes('¡Listo');

    if (isComplete) {
      console.log('[ml-browser] purchase complete!');
      const orderInfo = await extractOrderInfo(page);
      return { status: 'purchased', message: 'Compra realizada!', ...orderInfo };
    }

    // Look for action buttons in order of priority
    const buttons = [
      'button:has-text("Confirmar compra")',
      'button:has-text("Pagar")',
      'button:has-text("Confirmar")',
      'button:has-text("Continuar")',
      'a:has-text("Continuar")',
      'button[data-testid*="action"]',
    ];

    let clicked = false;
    for (const selector of buttons) {
      const btn = page.locator(selector).first();
      if (await btn.count() > 0 && await btn.isVisible()) {
        console.log(`[ml-browser] clicking: ${selector}`);
        await btn.click();
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(2000);
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      // No more buttons to click
      break;
    }

    // Check for login redirect
    if (page.url().includes('login')) {
      return { status: 'needs_login', message: 'Necesitas iniciar sesion.' };
    }
  }

  // Final check — look at page content
  const finalText = await page.textContent('body').catch(() => '');
  if (finalText?.includes('Listo, compraste') || finalText?.includes('¡Listo') || page.url().includes('congrats')) {
    console.log('[ml-browser] purchase complete (final check)');
    const orderInfo = await extractOrderInfo(page);
    return { status: 'purchased', message: 'Compra realizada!', ...orderInfo };
  }

  console.log('[ml-browser] ended at:', page.url().substring(0, 100));
  return { status: 'checkout', message: 'Revisa el navegador para completar la compra.' };
}

async function extractOrderInfo(page: Page): Promise<{ ml_order_id?: string; product_title?: string; total?: string }> {
  try {
    const info = await page.evaluate(`
      (() => {
        const title = document.querySelector('[class*="title"], h1, h2')?.textContent?.trim() || '';
        const orderId = window.location.href.match(/(\\d{10,})/)?.[1] || '';
        const total = document.querySelector('[class*="total"] [class*="fraction"], [class*="price"] [class*="fraction"]')?.textContent?.trim() || '';
        return { ml_order_id: orderId, product_title: title, total };
      })()
    `);
    return info as any;
  } catch {
    return {};
  }
}

// ─── Checkout cart ───

export async function checkoutCart(): Promise<{ status: string; message: string }> {
  const page = await getPage();

  await page.goto('https://www.mercadolibre.com.mx/cart', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Click "Continuar compra" or "Comprar" in cart
  const buyBtn = page.locator('button:has-text("Continuar compra"), button:has-text("Comprar"), a:has-text("Continuar compra")').first();
  if (await buyBtn.count() > 0) {
    await buyBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Complete the checkout flow
    const result = await completeCheckout(page);
    await saveSession();
    return result;
  }

  await saveSession();
  return { status: 'cart_open', message: 'Carrito abierto en el navegador.' };
}

// ─── Get cart info ───

export async function getCart(): Promise<{ items: { title: string; price: string; quantity: string }[] }> {
  const page = await getPage();

  await page.goto('https://www.mercadolibre.com.mx/cart', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  const items = await page.evaluate(`
    (() => {
      const cards = document.querySelectorAll('[class*="cart-item"], [class*="item-card"], .shops__item');
      return Array.from(cards).map(card => {
        const title = card.querySelector('[class*="title"], h3, .item-title')?.textContent?.trim() || '';
        const price = card.querySelector('[class*="price"] .andes-money-amount__fraction, .item-price')?.textContent?.trim() || '';
        const qty = card.querySelector('input[class*="quantity"], select[class*="quantity"]')?.value || '1';
        return { title, price: price ? '$' + price : '', quantity: qty };
      }).filter(i => i.title);
    })()
  `);

  return { items: items as any[] };
}

// ─── Close browser ───

export async function closeBrowser() {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
    context = null;
  }
}
