import http from 'http';
import app from './app';
import { env } from './config/env';
import { initSocket } from './config/socket';
import { startOpenClaw, onWhatsAppMessage } from './modules/purchasing/openclaw';
import { receiveMessage } from './modules/purchasing/service';

const server = http.createServer(app);
initSocket(server);

server.listen(env.port, '0.0.0.0', () => {
  console.log(`restPOS server running on http://0.0.0.0:${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);

  // Start OpenClaw WebSocket and listen for incoming WhatsApp messages
  // OpenClaw's AI agent handles WhatsApp responses automatically (via TOOLS.md + exec + psql)
  // We only save incoming messages to the purchasing DB for history
  onWhatsAppMessage((phone, message, waMessageId) => {
    console.log(`[openclaw] incoming from ${phone}: ${message.substring(0, 80)}`);
    receiveMessage(phone, message, waMessageId)
      .then((row) => console.log(`[openclaw] saved message id=${row?.id} supplier=${row?.supplier_id}`))
      .catch((err) => console.error('[openclaw] failed to save:', err.message));
  });
  startOpenClaw();
});
