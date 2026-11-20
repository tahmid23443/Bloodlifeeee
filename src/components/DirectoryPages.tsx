import { useState } from 'react';
import { ArrowLeft, MapPin, MessageCircle, PackageCheck, Search } from 'lucide-react';
import { BLOOD_TYPES, formatRequestStatusLabel } from '../shared/bloodLogic';
import type { BloodRequest, BloodType, UserProfile } from '../types';

interface DirectoryPageProps {
  currentUser: UserProfile;
  requests: BloodRequest[];
  onBack: () => void;
  onOpenChat: (partnerId: string, requestId?: string | null) => void;
  onSelectRequestAndMap: (requestId: string) => void;
}

export function DirectoryPage({
  currentUser,
  requests,
  onBack,
  onOpenChat,
  onSelectRequestAndMap,
}: DirectoryPageProps) {
  const [query, setQuery] = useState('');
  const [bloodFilter, setBloodFilter] = useState<BloodType | 'ALL'>('ALL');

  const q = query.trim().toLowerCase();

  const filteredOrders = requests.filter((r) => {
    const matchQ =
      !q ||
      r.dropoff_address.toLowerCase().includes(q) ||
      r.blood_type.toLowerCase().includes(q);
    const matchB = bloodFilter === 'ALL' || r.blood_type === bloodFilter;
    return matchQ && matchB;
  });

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0 pb-8 space-y-4">
      {/* Native Top Bar */}
      <div className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[#141417] hover:bg-neutral-50 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display font-bold text-lg text-[#141417]">Blood Orders</h1>
          <p className="text-xs text-neutral-500">Your active and matched dispatch requests</p>
        </div>
      </div>

      {/* Native Search + Blood Filter */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-3 space-y-3">
        <div className="flex items-center gap-2.5 bg-[#F6F6F8] rounded-xl px-3.5 h-11">
          <Search className="w-4 h-4 text-[#DC1423] shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your orders by address or blood group..."
            className="w-full bg-transparent text-sm focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setBloodFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 ${
              bloodFilter === 'ALL'
                ? 'bg-[#DC1423] text-white'
                : 'bg-[#F6F6F8] text-neutral-700'
            }`}
          >
            All
          </button>
          {BLOOD_TYPES.map((bt) => (
            <button
              key={bt}
              type="button"
              onClick={() => setBloodFilter(bt)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 ${
                bloodFilter === bt
                  ? 'bg-[#DC1423] text-white'
                  : 'bg-[#F6F6F8] text-neutral-700'
              }`}
            >
              {bt}
            </button>
          ))}
        </div>
      </div>

      {/* Scoped Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#DC1423] flex items-center justify-center mx-auto">
            <PackageCheck className="w-6 h-6" />
          </div>
          <h2 className="font-display font-bold text-base text-[#141417]">No blood orders yet</h2>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto">
            Requests you submit or accept will appear here with live map tracking and matched chat.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((r) => {
            const isMatchedParticipant =
              r.provider_id === currentUser.id || r.rider_id === currentUser.id;
            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-bold text-sm text-[#141417]">
                      {r.blood_type} · {r.units} unit(s) · {r.urgency.toUpperCase()}
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">{r.dropoff_address}</div>
                  </div>
                  <span className="text-xs font-bold text-[#DC1423]">
                    {formatRequestStatusLabel(r.status)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectRequestAndMap(r.id)}
                    className="px-3.5 py-2 rounded-xl bg-[#141417] text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Track on Map</span>
                  </button>

                  {isMatchedParticipant && r.needer_id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(r.needer_id, r.id)}
                      className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[40px]"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[#DC1423]" />
                      <span>Chat Needer</span>
                    </button>
                  )}

                  {r.rider_id && r.rider_id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(r.rider_id!, r.id)}
                      className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[40px]"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[#DC1423]" />
                      <span>Chat Rider</span>
                    </button>
                  )}

                  {r.provider_id && r.provider_id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(r.provider_id!, r.id)}
                      className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[40px]"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[#DC1423]" />
                      <span>Chat {r.pickup_type === 'donor' ? 'Donor' : 'Hospital'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
