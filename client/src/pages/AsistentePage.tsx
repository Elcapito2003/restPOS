import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { Send, Bot, User, Trash2, Loader2 } from 'lucide-react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export default function AsistentePage() {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['chatbot-history'],
    queryFn: () => api.get('/chatbot/history').then(r => r.data),
  });

  const sendMut = useMutation({
    mutationFn: async (message: string) => {
      const res = await api.post('/chatbot/message', { message });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chatbot-history'] });
      setInput('');
      inputRef.current?.focus();
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.error || 'Error al procesar mensaje');
    },
  });

  const clearMut = useMutation({
    mutationFn: () => api.delete('/chatbot/memory'),
    onSuccess: () => {
      toast.success('Memoria borrada');
    },
  });

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMut.isPending]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || sendMut.isPending) return;
    sendMut.mutate(msg);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="p-4 border-b bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Asistente restPOS</h2>
            <p className="text-xs text-gray-400">Escribe comandos en lenguaje natural</p>
          </div>
        </div>
        <button
          onClick={() => { if (confirm('Borrar la memoria del asistente?')) clearMut.mutate(); }}
          className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Borrar memoria"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {isLoading && (
          <div className="text-center text-gray-400 py-8">
            <Loader2 size={24} className="mx-auto animate-spin mb-2" />
            Cargando historial...
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="text-center py-12">
            <Bot size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">Asistente restPOS</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
              Puedo ayudarte a gestionar tu restaurante. Prueba con:
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {[
                'Como va el inventario?',
                'Cuales son las ventas de hoy?',
                'Hazme un pedido de 10kg de pollo a [proveedor]',
                'Que productos tienen stock bajo?',
                'Cambia el precio de los tacos a $55',
                'Que pedidos tenemos pendientes?',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-1">
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
            }`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
              <p className={`text-[10px] mt-1.5 ${m.role === 'user' ? 'text-blue-200' : 'text-gray-400'} text-right`}>
                {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center shrink-0 mt-1">
                <User size={16} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {sendMut.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEnd} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-white shrink-0">
        <div className="flex gap-3 max-w-3xl mx-auto">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Escribe un mensaje al asistente..."
            className="input flex-1 rounded-full px-5"
            disabled={sendMut.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMut.isPending}
            className="btn-primary rounded-full w-11 h-11 p-0 flex items-center justify-center shrink-0"
          >
            {sendMut.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
