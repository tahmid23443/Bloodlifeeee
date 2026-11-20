import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Bot, Sparkles, Send, X, User } from 'lucide-react';
import { api } from '../utils/api';
import type { UserProfile } from '../types';

interface AiAssistantModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export function AiAssistantModal({ currentUser, isOpen, onClose }: AiAssistantModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: `Hello ${currentUser.name}! I am your **Blood Life AI Health & Dispatch Assistant** powered by Gemini. Ask me about blood compatibility, finding emergency stock, or Government Tika Care vaccination schedules.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const promptText = input.trim();
    if (!promptText || loading) return;

    setInput('');
    const newMsgs: Message[] = [...messages, { role: 'user', text: promptText }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const res = await api.consultAi(promptText, {
        userId: currentUser.id,
        role: currentUser.role,
        bloodType: currentUser.blood_type,
        address: currentUser.address,
      });
      setMessages([...newMsgs, { role: 'assistant', text: res.answer }]);
    } catch (err) {
      setMessages([
        ...newMsgs,
        {
          role: 'assistant',
          text: `⚠️ Error: ${err instanceof Error ? err.message : 'AI connection failed.'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-[28px] shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-[#DC1423] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white text-[#DC1423] flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 fill-[#DC1423]" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base tracking-tight flex items-center gap-1.5">
                Blood Life AI
                <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-sans font-medium">Gemini 4</span>
              </h3>
              <p className="text-[11px] text-white/85">Instant Emergency & Tika Care Intelligence</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#FAFAFB]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  m.role === 'user' ? 'bg-[#DC1423] text-white' : 'bg-red-100 text-[#DC1423]'
                }`}
              >
                {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#DC1423] text-white rounded-tr-none'
                    : 'bg-white border border-neutral-200 text-neutral-800 rounded-tl-none shadow-xs'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-red-100 text-[#DC1423] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-white border border-neutral-200 text-neutral-500 px-4 py-3 rounded-2xl text-xs rounded-tl-none shadow-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#DC1423] animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-[#DC1423] animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-[#DC1423] animate-bounce [animation-delay:0.4s]"></span>
                <span className="ml-1 text-[11px] text-neutral-400">Gemini is analyzing...</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick Suggestions */}
        <div className="px-4 py-2 bg-white border-t border-neutral-100 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setInput('How does donor searching and hospital inventory matching work?')}
            className="text-[11px] px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#DC1423] rounded-full border border-red-200 font-medium whitespace-nowrap transition-colors"
          >
            🔍 Donor Searching & Stock
          </button>
          <button
            type="button"
            onClick={() => setInput('How does cold-box rider dispatch and live tracking work?')}
            className="text-[11px] px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#DC1423] rounded-full border border-red-200 font-medium whitespace-nowrap transition-colors"
          >
            🏍️ Rider Matching & GPS
          </button>
          <button
            type="button"
            onClick={() => setInput('How does Government Tika Care and digital QR card work?')}
            className="text-[11px] px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#DC1423] rounded-full border border-red-200 font-medium whitespace-nowrap transition-colors"
          >
            🛡️ Govt Tika Care QR
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-neutral-200 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Blood Life AI anything..."
            className="flex-1 px-4 py-2.5 bg-[#FAFAFB] border border-neutral-200 rounded-xl text-xs focus:outline-none focus:border-[#DC1423] focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-[#DC1423] hover:bg-[#b50f1b] disabled:opacity-50 text-white flex items-center justify-center shadow-sm transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
