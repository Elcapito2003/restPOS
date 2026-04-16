import { query } from '../../config/database';
import { chatWithAgent } from '../purchasing/openclaw';

// ─── Main Chat Processing ───

/**
 * Process a message through OpenClaw's AI agent.
 * For WhatsApp: OpenClaw handles it directly (agent processes incoming messages automatically).
 * For internal: We send the message via chat.send and wait for the agent's response.
 */
export async function processMessage(
  sessionId: string,
  channel: 'whatsapp' | 'internal',
  userMessage: string
): Promise<string> {
  // Save user message to local history
  await saveMessage(sessionId, channel, 'user', userMessage);

  // Build session key for OpenClaw
  // Internal chatbot uses a dedicated session per user
  const sessionKey = `agent:main:internal:${sessionId}`;

  try {
    // Send to OpenClaw agent and wait for response (up to 60s for AI processing)
    const response = await chatWithAgent(sessionKey, userMessage, 60000);

    // Save assistant response to local history
    await saveMessage(sessionId, channel, 'assistant', response);

    return response;
  } catch (err: any) {
    console.error('[chatbot] OpenClaw agent error:', err.message);

    // If OpenClaw fails, try to get the response from chat history
    try {
      const { default: { rpc } } = await import('../purchasing/openclaw') as any;
    } catch {}

    const fallback = 'Lo siento, no pude procesar tu mensaje en este momento. Intenta de nuevo.';
    await saveMessage(sessionId, channel, 'assistant', fallback);
    return fallback;
  }
}

// ─── Local History (for the UI) ───

async function saveMessage(sessionId: string, channel: string, role: string, content: string) {
  try {
    await query(
      `INSERT INTO chatbot_messages (session_id, channel, role, content) VALUES ($1, $2, $3, $4)`,
      [sessionId, channel, role, content]
    );
  } catch (err: any) {
    console.error('[chatbot] Failed to save message:', err.message);
  }
}

export async function getConversationHistory(sessionId: string, limit = 50) {
  const result = await query(
    `SELECT id, role, content, created_at FROM chatbot_messages
     WHERE session_id = $1 AND role IN ('user', 'assistant')
     ORDER BY created_at ASC LIMIT $2`,
    [sessionId, limit]
  );
  return result.rows;
}

export async function clearMemory(sessionId: string) {
  await query(`DELETE FROM chatbot_memory WHERE session_id = $1`, [sessionId]);
  return { message: 'Memoria borrada' };
}
