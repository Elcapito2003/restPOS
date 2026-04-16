-- Chatbot conversation memory
CREATE TABLE IF NOT EXISTS chatbot_messages (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,  -- phone number (WhatsApp) or 'user:{userId}' (internal)
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'internal')),
  role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_call_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session ON chatbot_messages(session_id, created_at DESC);

-- Long-term memory facts extracted by the AI
CREATE TABLE IF NOT EXISTS chatbot_memory (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  fact TEXT NOT NULL,
  category VARCHAR(50),  -- preference, context, instruction, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_memory_session ON chatbot_memory(session_id);
