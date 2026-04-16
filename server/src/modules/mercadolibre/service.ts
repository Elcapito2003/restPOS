import axios from 'axios';
import { query } from '../../config/database';

import { env } from '../../config/env';

const ML_API = 'https://api.mercadolibre.com';
const ML_AUTH = 'https://auth.mercadolibre.com.mx';
const CLIENT_ID = env.mlClientId;
const CLIENT_SECRET = env.mlClientSecret;
const REDIRECT_URI = env.mlRedirectUri;

// ─── Token Management ───

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: number;
}

let tokenCache: TokenData | null = null;

async function loadToken(): Promise<TokenData | null> {
  if (tokenCache && tokenCache.expires_at > Date.now()) return tokenCache;

  const result = await query(
    "SELECT value FROM settings WHERE key = 'ml_token' LIMIT 1"
  );
  if (!result.rows[0]) return null;

  try {
    tokenCache = JSON.parse(result.rows[0].value);
    return tokenCache;
  } catch {
    return null;
  }
}

async function saveToken(data: TokenData) {
  tokenCache = data;
  const json = JSON.stringify(data);
  await query(
    `INSERT INTO settings (key, value) VALUES ('ml_token', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [json]
  );
}

async function getAccessToken(): Promise<string> {
  let token = await loadToken();
  if (!token) throw new Error('MercadoLibre no conectado. Autoriza primero.');

  // Refresh if expired or about to expire (5 min buffer)
  if (token.expires_at < Date.now() + 300000) {
    const res = await axios.post(`${ML_API}/oauth/token`, {
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: token.refresh_token,
    });
    const newToken: TokenData = {
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      expires_at: Date.now() + res.data.expires_in * 1000,
      user_id: res.data.user_id,
    };
    await saveToken(newToken);
    return newToken.access_token;
  }

  return token.access_token;
}

function mlClient() {
  return {
    async get(path: string, params?: any) {
      const token = await getAccessToken();
      return axios.get(`${ML_API}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
    },
    async post(path: string, data?: any) {
      const token = await getAccessToken();
      return axios.post(`${ML_API}${path}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  };
}

// ─── PKCE ───

import crypto from 'crypto';

let pkceVerifier: string | null = null;

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  pkceVerifier = verifier;
  return { verifier, challenge };
}

// ─── Auth ───

export function getAuthUrl(): string {
  const { challenge } = generatePKCE();
  return `${ML_AUTH}/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code_challenge=${challenge}&code_challenge_method=S256`;
}

export async function exchangeCode(code: string) {
  if (!pkceVerifier) throw new Error('No hay code_verifier. Genera una nueva URL de autorizacion primero.');

  const res = await axios.post(`${ML_API}/oauth/token`, {
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: pkceVerifier,
  });

  pkceVerifier = null; // Used, clear it

  const token: TokenData = {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_at: Date.now() + res.data.expires_in * 1000,
    user_id: res.data.user_id,
  };
  await saveToken(token);

  // Get user info
  const userRes = await axios.get(`${ML_API}/users/${token.user_id}`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  return { user_id: token.user_id, nickname: userRes.data.nickname };
}

export async function getStatus() {
  try {
    const token = await loadToken();
    if (!token) return { connected: false };

    const accessToken = await getAccessToken();
    const res = await axios.get(`${ML_API}/users/${token.user_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      connected: true,
      user_id: token.user_id,
      nickname: res.data.nickname,
    };
  } catch {
    return { connected: false };
  }
}

// ─── Search ───

export async function searchProducts(q: string, limit = 20, offset = 0) {
  const ml = mlClient();
  // Use catalog/products search (works for uncertified apps)
  const res = await ml.get('/products/search', {
    status: 'active',
    site_id: 'MLM',
    q,
    limit,
    offset,
  });

  const products = res.data.results || [];

  // Fetch product details in parallel to get pictures and pricing
  const results = await Promise.all(
    products.map(async (p: any) => {
      const pid = p.catalog_product_id || p.id;
      let picture = '';
      let price = 0;
      let permalink = `https://www.mercadolibre.com.mx/p/${pid}`;
      let shippingFree = false;

      try {
        const detail = await ml.get(`/products/${pid}`);
        picture = detail.data.pictures?.[0]?.url || '';
        if (detail.data.permalink) permalink = detail.data.permalink;
        // Try buy_box_winner for price
        if (detail.data.buy_box_winner) {
          price = detail.data.buy_box_winner.price || 0;
          shippingFree = detail.data.buy_box_winner.shipping?.free_shipping || false;
        }
      } catch {}

      const brand = p.attributes?.find((a: any) => a.id === 'BRAND')?.value_name || '';

      return {
        id: pid,
        title: p.name || '',
        price,
        currency: 'MXN',
        thumbnail: picture,
        permalink,
        condition: 'new',
        available_quantity: 0,
        sold_quantity: 0,
        shipping_free: shippingFree,
        brand,
        seller: { id: 0, nickname: '' },
      };
    })
  );

  return {
    total: res.data.paging?.total || 0,
    results,
    // Search URL for opening in browser with full prices
    searchUrl: `https://listado.mercadolibre.com.mx/${encodeURIComponent(q).replace(/%20/g, '-')}`,
  };
}

export async function getProduct(itemId: string) {
  const ml = mlClient();
  const [itemRes, descRes] = await Promise.all([
    ml.get(`/items/${itemId}`),
    ml.get(`/items/${itemId}/description`).catch(() => ({ data: { plain_text: '' } })),
  ]);

  const item = itemRes.data;
  return {
    id: item.id,
    title: item.title,
    price: item.price,
    currency: item.currency_id,
    thumbnail: item.thumbnail,
    pictures: item.pictures?.map((p: any) => p.url) || [],
    permalink: item.permalink,
    condition: item.condition,
    available_quantity: item.available_quantity,
    sold_quantity: item.sold_quantity,
    shipping_free: item.shipping?.free_shipping || false,
    description: descRes.data.plain_text || '',
    attributes: item.attributes?.map((a: any) => ({ name: a.name, value: a.value_name })) || [],
    seller: {
      id: item.seller_id,
    },
  };
}

// ─── Purchase ───

export async function createOrder(itemId: string, quantity: number) {
  const ml = mlClient();
  const res = await ml.post('/orders', {
    items: [{ item_id: itemId, quantity }],
  });
  return res.data;
}

// ─── Orders ───

export async function getMyOrders(limit = 20, offset = 0) {
  const ml = mlClient();
  const token = await loadToken();
  if (!token) throw new Error('No conectado');

  const res = await ml.get(`/orders/search`, {
    buyer: token.user_id,
    sort: 'date_desc',
    limit,
    offset,
  });

  return {
    total: res.data.paging.total,
    orders: res.data.results.map((o: any) => ({
      id: o.id,
      status: o.status,
      date: o.date_created,
      total: o.total_amount,
      currency: o.currency_id,
      items: o.order_items?.map((oi: any) => ({
        title: oi.item.title,
        quantity: oi.quantity,
        unit_price: oi.unit_price,
        item_id: oi.item.id,
      })) || [],
      shipping: o.shipping ? { id: o.shipping.id } : null,
      seller: { nickname: o.seller?.nickname },
    })),
  };
}

export async function getOrderDetail(orderId: number) {
  const ml = mlClient();
  const res = await ml.get(`/orders/${orderId}`);
  const o = res.data;

  let shipping = null;
  if (o.shipping?.id) {
    try {
      const shipRes = await ml.get(`/shipments/${o.shipping.id}`);
      shipping = {
        id: shipRes.data.id,
        status: shipRes.data.status,
        tracking_number: shipRes.data.tracking_number,
        date_delivered: shipRes.data.status_history?.date_delivered,
      };
    } catch {}
  }

  return {
    id: o.id,
    status: o.status,
    date: o.date_created,
    total: o.total_amount,
    currency: o.currency_id,
    items: o.order_items?.map((oi: any) => ({
      title: oi.item.title,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
      item_id: oi.item.id,
    })) || [],
    shipping,
    seller: { nickname: o.seller?.nickname },
  };
}
