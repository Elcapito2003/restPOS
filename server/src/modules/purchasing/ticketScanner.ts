import OpenAI from 'openai';
import { env } from '../../config/env';

const SYSTEM_PROMPT = `Eres un asistente que extrae datos de tickets de compra de proveedores
en restaurantes/cafeterías mexicanas. Analiza la imagen del ticket y devuelve
ÚNICAMENTE un JSON con esta estructura exacta (sin texto antes o después,
sin markdown):

{
  "supplier_name": string | null,
  "supplier_rfc": string | null,
  "ticket_number": string | null,
  "date": "YYYY-MM-DD" | null,
  "items": [
    {
      "description": string,
      "quantity": number,
      "unit": string | null,
      "unit_price": number,
      "total": number
    }
  ],
  "subtotal": number | null,
  "tax": number | null,
  "total": number,
  "payment_method": "cash" | "card" | "transfer" | "credit" | null,
  "notes": string | null
}

Reglas:
- supplier_name = nombre comercial (no razón social legal a menos que sea lo único legible).
- date en formato ISO YYYY-MM-DD. Si solo dice "12/05/26" asume DD/MM/YY.
- Para items: si no se distinguen claramente, agrúpalos como "Productos varios".
- Todos los montos en pesos mexicanos sin símbolo, como número.
- Si un campo no es legible, usa null.
- "unit" como "kg", "L", "pz", "caja", "bolsa", etc.
- "payment_method": "cash" si dice efectivo, "card" si dice tarjeta/débito/crédito,
  "transfer" si dice transferencia/SPEI, "credit" si dice crédito a pagar.`;

export interface ScannedTicket {
  supplier_name: string | null;
  supplier_rfc: string | null;
  ticket_number: string | null;
  date: string | null;
  items: Array<{
    description: string;
    quantity: number;
    unit: string | null;
    unit_price: number;
    total: number;
  }>;
  subtotal: number | null;
  tax: number | null;
  total: number;
  payment_method: 'cash' | 'card' | 'transfer' | 'credit' | null;
  notes: string | null;
}

export async function scanTicketImage(imageBase64: string): Promise<ScannedTicket> {
  if (!env.openaiApiKey) {
    throw new Error('OPENAI_API_KEY no configurada en el server. Pídele al admin que la ponga en /opt/restpos/.env y reinicie el server.');
  }

  const openai = new OpenAI({ apiKey: env.openaiApiKey });

  // Limpiamos el prefijo "data:image/..." si viene incluido
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // ~$0.01-0.02 por imagen vs gpt-4o ~$0.05-0.10
    response_format: { type: 'json_object' },
    max_tokens: 1500,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extrae los datos del ticket en JSON según el formato indicado.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } },
        ],
      },
    ],
  });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI no devolvió contenido');

  let parsed: ScannedTicket;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error('OpenAI devolvió JSON inválido: ' + content.slice(0, 200));
  }

  // Sanity: items debe ser array
  if (!Array.isArray(parsed.items)) parsed.items = [];

  return parsed;
}
