import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Lock,
  MessageSquarePlus,
  Mic,
  Pause,
  Phone,
  Play,
  Send,
  Video,
  X,
} from 'lucide-react';
import type { ChatMessage, ChatThreadSummary, UserProfile } from '../types';
import { makeDirectRoomId } from '../shared/bloodLogic';
import { api } from '../utils/api';

interface ChatViewProps {
  currentUser: UserProfile;
  providers: UserProfile[];
  onlineUserIds: string[];
  initialPartnerId?: string | null;
  initialRequestId?: string | null;
  incomingMessages: ChatMessage[];
  onBack?: () => void;
}

const WAVE_BARS = [4, 10, 16, 12, 22, 28, 18, 26, 20, 14, 24, 16, 10, 18, 12, 8, 14, 9, 6];

export function ChatView({
  currentUser,
  providers,
  onlineUserIds,
  initialPartnerId,
  initialRequestId = null,
  incomingMessages,
  onBack,
}: ChatViewProps) {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [authorizedContacts, setAuthorizedContacts] = useState<UserProfile[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(initialPartnerId || null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId);
  const [mobileShowThread, setMobileShowThread] = useState(Boolean(initialPartnerId));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [callBanner, setCallBanner] = useState<{ mode: 'voice' | 'video'; partnerName: string; phone: string } | null>(null);
  const [showNewChatPicker, setShowNewChatPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialPartnerId) {
      setSelectedPartnerId(initialPartnerId);
      setSelectedRequestId(initialRequestId ?? null);
      setMobileShowThread(true);
    }
  }, [initialPartnerId, initialRequestId]);

  useEffect(() => {
    let active = true;
    Promise.all([api.getChatThreads(currentUser.id), api.getChatContacts(currentUser.id)])
      .then(([threadRes, contactRes]) => {
        if (!active) return;
        setThreads(threadRes.threads);
        setAuthorizedContacts(contactRes.contacts);
        if (!selectedPartnerId && threadRes.threads.length > 0) {
          setSelectedPartnerId(threadRes.threads[0].partner_id);
          setSelectedRequestId(threadRes.threads[0].request_id);
        } else if (!selectedPartnerId && contactRes.contacts.length > 0) {
          setSelectedPartnerId(contactRes.contacts[0].id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentUser.id, providers.length]);

  const activeRoomId = useMemo(() => {
    if (!selectedPartnerId) return null;
    return makeDirectRoomId(currentUser.id, selectedPartnerId, selectedRequestId);
  }, [currentUser.id, selectedPartnerId, selectedRequestId]);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }
    let active = true;
    const fetchRoom = () => {
      api
        .getRoomMessages(activeRoomId)
        .then((res) => {
          if (active) setMessages(res.messages);
        })
        .catch(() => {});
    };
    fetchRoom();
    const timer = window.setInterval(fetchRoom, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeRoomId]);

  useEffect(() => {
    if (!incomingMessages.length) return;
    const latest = incomingMessages[incomingMessages.length - 1];
    if (activeRoomId && latest.room_id === activeRoomId) {
      setMessages((prev) => (prev.some((m) => m.id === latest.id) ? prev : [...prev, latest]));
    }
    Promise.all([api.getChatThreads(currentUser.id), api.getChatContacts(currentUser.id)])
      .then(([tRes, cRes]) => {
        setThreads(tRes.threads);
        setAuthorizedContacts(cRes.contacts);
      })
      .catch(() => {});
  }, [incomingMessages, activeRoomId, currentUser.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const partner = useMemo(() => {
    if (!selectedPartnerId) return null;
    const fromContacts =
      authorizedContacts.find((p) => p.id === selectedPartnerId) ||
      providers.find((p) => p.id === selectedPartnerId);
    if (fromContacts) return fromContacts;
    const threadMatch = threads.find((t) => t.partner_id === selectedPartnerId);
    if (threadMatch) {
      return {
        id: threadMatch.partner_id,
        name: threadMatch.partner_name,
        email: '',
        role: threadMatch.partner_role,
        blood_type: threadMatch.partner_blood_type,
        phone: '',
        address: '',
        lat: 0,
        lng: 0,
        is_available: threadMatch.partner_online ? 1 : 0,
        donations_count: 0,
        requests_count: 0,
        vehicle_type: null,
        hospital_name: null,
        created_at: '',
      } as UserProfile;
    }
    return null;
  }, [authorizedContacts, providers, threads, selectedPartnerId]);

  const partnerOnline = partner
    ? onlineUserIds.includes(partner.id) || Boolean(partner.is_available)
    : false;

  async function handleSend(e?: FormEvent, overrideText?: string, msgType: 'text' | 'voice' = 'text') {
    if (e) e.preventDefault();
    const content = (overrideText ?? text).trim();
    if (!content || !selectedPartnerId || sending) return;

    setChatError('');
    setSending(true);
    try {
      const res = await api.sendMessage({
        sender_id: currentUser.id,
        receiver_id: selectedPartnerId,
        request_id: selectedRequestId,
        message: content,
        msg_type: msgType,
        duration_sec: msgType === 'voice' ? 18 : 0,
      });
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      if (!overrideText) setText('');
      const updatedThreads = await api.getChatThreads(currentUser.id);
      setThreads(updatedThreads.threads);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to send message');
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
    if (Number.isNaN(d.getTime())) return 'Now';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="w-full h-full bg-white md:rounded-3xl md:border md:border-neutral-200 overflow-hidden grid grid-cols-1 md:grid-cols-12">
      {/* Inbox List */}
      <aside
        className={`md:col-span-4 border-r border-neutral-200 flex flex-col bg-[#FAFAFB] h-full overflow-hidden ${
          mobileShowThread ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="p-4 border-b border-neutral-200 flex items-center justify-between gap-2 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to home"
                className="md:hidden w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-700"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="font-display font-bold text-base text-[#141417]">Direct Messages</h1>
              <p className="text-xs text-neutral-500">Matched request contacts only</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNewChatPicker((v) => !v)}
            aria-label="Start new direct chat"
            className="w-10 h-10 rounded-xl bg-red-50 text-[#DC1423] hover:bg-[#DC1423] hover:text-white flex items-center justify-center transition-colors shrink-0"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
        </div>

        {showNewChatPicker && (
          <div className="p-3 bg-white border-b border-neutral-200 max-h-60 overflow-y-auto shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-700">Matched Contacts</span>
              <button
                type="button"
                onClick={() => setShowNewChatPicker(false)}
                aria-label="Close contact picker"
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {authorizedContacts.length === 0 ? (
              <p className="text-xs text-neutral-500 py-2">
                No matched contacts yet. Chat unlocks once a donor, hospital, or rider accepts a request.
              </p>
            ) : (
              <div className="space-y-1">
                {authorizedContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedPartnerId(c.id);
                      setSelectedRequestId(null);
                      setShowNewChatPicker(false);
                      setMobileShowThread(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-[#141417] truncate">
                      {c.hospital_name || c.name}
                    </span>
                    <span className="text-neutral-500 shrink-0 ml-2">
                      {c.role} · {c.blood_type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
          {threads.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-red-50 text-[#DC1423] flex items-center justify-center mx-auto">
                <Lock className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-[#141417]">No matched conversations yet</p>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Direct chat unlocks automatically once a donor, hospital, or rider is matched with a blood request.
              </p>
            </div>
          ) : (
            threads.map((t) => {
              const active = t.partner_id === selectedPartnerId && t.request_id === selectedRequestId;
              return (
                <button
                  key={t.room_id}
                  type="button"
                  onClick={() => {
                    setSelectedPartnerId(t.partner_id);
                    setSelectedRequestId(t.request_id);
                    setMobileShowThread(true);
                  }}
                  className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors min-h-[64px] ${
                    active ? 'bg-red-50/70' : 'hover:bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#DC1423] text-white font-bold text-sm flex items-center justify-center shrink-0">
                    {t.partner_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[#141417] truncate">
                        {t.partner_name}
                      </span>
                      <span className="text-[11px] text-neutral-400 tabular-nums shrink-0">
                        {formatTime(t.last_time)}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {t.partner_role} · {t.partner_blood_type}
                    </div>
                    <p className="text-xs text-neutral-600 truncate mt-1">{t.last_message}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Active Chat Thread Screen */}
      <section
        className={`md:col-span-8 flex flex-col bg-white h-full overflow-hidden ${
          mobileShowThread ? 'flex' : 'hidden md:flex'
        }`}
      >
        {partner ? (
          <>
            <div className="px-4 sm:px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileShowThread(false)}
                  aria-label="Back to conversations"
                  className="md:hidden w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-700 shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-11 h-11 rounded-full bg-neutral-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {(partner.hospital_name || partner.name).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-base text-[#141417] truncate">
                    {partner.hospital_name || partner.name}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {partnerOnline ? 'Online' : 'Standby'} · {partner.role} · {partner.blood_type}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  aria-label="Start video briefing"
                  onClick={() =>
                    setCallBanner({
                      mode: 'video',
                      partnerName: partner.hospital_name || partner.name,
                      phone: partner.phone || 'Verified Partner',
                    })
                  }
                  className="w-10 h-10 rounded-full border border-neutral-200 hover:border-neutral-300 flex items-center justify-center text-neutral-700 transition-colors"
                >
                  <Video className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Call partner"
                  onClick={() =>
                    setCallBanner({
                      mode: 'voice',
                      partnerName: partner.hospital_name || partner.name,
                      phone: partner.phone || 'Verified Partner',
                    })
                  }
                  className="w-10 h-10 rounded-full border border-neutral-200 hover:border-neutral-300 flex items-center justify-center text-neutral-700 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </button>
              </div>
            </div>

            {callBanner && (
              <div className="px-5 py-2.5 bg-neutral-900 text-white text-xs flex items-center justify-between gap-3 shrink-0">
                <span>
                  {callBanner.mode === 'video' ? 'Video Dispatch' : 'Voice Call'} ready with{' '}
                  <strong>{callBanner.partnerName}</strong> ({callBanner.phone})
                </span>
                <button
                  type="button"
                  onClick={() => setCallBanner(null)}
                  className="px-2.5 py-1 rounded-lg bg-[#DC1423] text-white font-semibold"
                >
                  End
                </button>
              </div>
            )}

            {chatError && (
              <div role="alert" className="px-5 py-2 bg-red-50 text-[#DC1423] text-xs font-medium shrink-0">
                {chatError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-4 bg-white">
              <div className="text-center text-xs text-neutral-400 font-medium">Today</div>

              {messages.length === 0 ? (
                <div className="py-12 text-center text-sm text-neutral-500">
                  Start coordinating pickup or donation details with{' '}
                  <span className="font-semibold text-[#141417]">
                    {partner.hospital_name || partner.name}
                  </span>
                  .
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === currentUser.id;
                  const isPlaying = playingVoiceId === m.id;

                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      {!isMine && (
                        <div className="w-7 h-7 rounded-full bg-neutral-200 text-neutral-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                          {(m.sender_name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className={`max-w-[78%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                        {m.msg_type === 'voice' ? (
                          <div
                            className={`px-4 py-3 rounded-2xl flex items-center gap-3 ${
                              isMine ? 'bg-[#DC1423] text-white' : 'bg-[#F3F4F6] text-[#141417]'
                            }`}
                          >
                            <button
                              type="button"
                              aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
                              onClick={() => setPlayingVoiceId(isPlaying ? null : m.id)}
                              className="w-8 h-8 rounded-full bg-white text-[#DC1423] border border-red-200 flex items-center justify-center shrink-0"
                            >
                              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                            </button>
                            <div className="flex items-center gap-1 h-7">
                              {WAVE_BARS.map((h, idx) => (
                                <span
                                  key={idx}
                                  style={{ height: `${h}px` }}
                                  className={`w-1 rounded-full transition-colors ${
                                    isMine
                                      ? idx < 11 || isPlaying
                                        ? 'bg-white'
                                        : 'bg-white/45'
                                      : idx < 11 || isPlaying
                                      ? 'bg-[#DC1423]'
                                      : 'bg-neutral-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-mono tabular-nums ml-1">
                              0:{String(m.duration_sec || 18).padStart(2, '0')}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                              isMine
                                ? 'bg-[#DC1423] text-white rounded-br-sm'
                                : 'bg-[#F3F4F6] text-[#141417] rounded-bl-sm'
                            }`}
                          >
                            {m.message}
                          </div>
                        )}
                        <span className="text-[11px] text-neutral-400 mt-1 tabular-nums">
                          {formatTime(m.created_at)}
                        </span>
                      </div>

                      {isMine && (
                        <div className="w-7 h-7 rounded-full bg-[#DC1423] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 py-2 border-t border-neutral-100 flex items-center gap-2 overflow-x-auto bg-[#FAFAFB] shrink-0">
              {['On my way now', 'Blood unit ready for pickup', 'Arrived at emergency gate'].map(
                (quick) => (
                  <button
                    key={quick}
                    type="button"
                    onClick={() => handleSend(undefined, quick, 'text')}
                    className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 hover:border-[#DC1423] text-xs font-medium text-neutral-700 whitespace-nowrap shrink-0 transition-colors"
                  >
                    {quick}
                  </button>
                )
              )}
            </div>

            <form
              onSubmit={(e) => handleSend(e)}
              className="p-3.5 border-t border-neutral-100 bg-white flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                aria-label="Send voice dispatch note"
                onClick={() => handleSend(undefined, 'Voice dispatch update (0:18)', 'voice')}
                className="w-11 h-11 rounded-xl bg-neutral-100 hover:bg-red-50 text-neutral-700 hover:text-[#DC1423] flex items-center justify-center shrink-0 transition-colors"
              >
                <Mic className="w-4 h-4" />
              </button>
              <input
                type="text"
                aria-label="Message input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type Here..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none min-h-[44px]"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                aria-label="Send message"
                className="px-4 h-11 rounded-xl bg-[#DC1423] hover:bg-[#B9101D] text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-45 shrink-0 transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#DC1423] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="font-display font-bold text-base text-[#141417]">
              Private Matched Messaging
            </h2>
            <p className="text-xs text-neutral-500 max-w-xs">
              Chat unlocks only between you and the donor, hospital, or rider matched to an active blood request.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
