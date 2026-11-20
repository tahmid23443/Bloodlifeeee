import { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  MapPin,
  MessageCircle,
  Minus,
  Navigation,
  Plus,
} from 'lucide-react';
import {
  BLOOD_TYPES,
  formatRequestStatusLabel,
  haversineKm,
  interpolateCoord,
  isBloodCompatible,
} from '../shared/bloodLogic';
import type { BloodRequest, BloodType, UserProfile } from '../types';

interface RoleQueuePageProps {
  currentUser: UserProfile;
  requests: BloodRequest[];
  onBack: () => void;
  onSelectRequestAndMap: (requestId: string) => void;
  onOpenChat: (partnerId: string, requestId?: string | null) => void;
  onToggleAvailability: () => Promise<void>;
  onClaimRequest: (requestId: string, dispatchRider?: boolean) => Promise<void>;
  onRequestRider: (requestId: string) => Promise<void>;
  onAcceptRide: (requestId: string) => Promise<void>;
  onPickupBlood: (requestId: string) => Promise<void>;
  onDeliverBlood: (requestId: string) => Promise<void>;
  onUpdateRiderLocation: (requestId: string, lat: number, lng: number) => Promise<void>;
  onUpdateInventory: (bloodType: BloodType, units: number) => Promise<void>;
}

export function RoleQueuePage({
  currentUser,
  requests,
  onBack,
  onSelectRequestAndMap,
  onOpenChat,
  onToggleAvailability,
  onClaimRequest,
  onRequestRider,
  onAcceptRide,
  onPickupBlood,
  onDeliverBlood,
  onUpdateRiderLocation,
  onUpdateInventory,
}: RoleQueuePageProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function runAction(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  }

  const pageTitle =
    currentUser.role === 'hospital'
      ? 'Hospital Blood Bank'
      : currentUser.role === 'rider'
      ? 'Courier Pickup Jobs'
      : 'Donor Dispatch Radar';

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0 pb-8 space-y-4">
      {/* Native Screen Header */}
      <div className="flex items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to home"
            className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[#141417] hover:bg-neutral-50 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg text-[#141417] truncate">{pageTitle}</h1>
            <p className="text-xs text-neutral-500 truncate">
              {currentUser.role === 'donor'
                ? `Blood Group ${currentUser.blood_type} · ${currentUser.donations_count} donations`
                : currentUser.role === 'rider'
                ? `${currentUser.vehicle_type || 'Medical Courier'} · Live GPS`
                : currentUser.hospital_name || currentUser.name}
            </p>
          </div>
        </div>

        {(currentUser.role === 'donor' || currentUser.role === 'rider') && (
          <button
            type="button"
            onClick={onToggleAvailability}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[42px] ${
              currentUser.is_available
                ? 'bg-[#DC1423] text-white'
                : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            {currentUser.is_available ? 'Online · Ready' : 'Go Online'}
          </button>
        )}
      </div>

      {/* HOSPITAL INVENTORY PANEL */}
      {currentUser.role === 'hospital' && (
        <section className="bg-white rounded-3xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display font-bold text-base text-[#141417]">Live Blood Stock</h2>
              <p className="text-xs text-neutral-500">Auto-deducted on confirmation</p>
            </div>
            <Building2 className="w-5 h-5 text-[#DC1423]" />
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {BLOOD_TYPES.map((bt) => {
              const units = currentUser.inventory?.[bt] ?? 0;
              return (
                <div key={bt} className="p-2.5 rounded-2xl bg-[#F6F6F8] text-center">
                  <div className="font-display font-bold text-sm text-[#141417]">{bt}</div>
                  <div className="text-xs font-mono font-bold text-[#DC1423] my-1 tabular-nums">
                    {units}u
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      aria-label={`Decrease ${bt} stock`}
                      onClick={() => onUpdateInventory(bt, Math.max(0, units - 1))}
                      className="w-8 h-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center hover:border-[#DC1423]"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Increase ${bt} stock`}
                      onClick={() => onUpdateInventory(bt, units + 1)}
                      className="w-8 h-8 rounded-xl bg-white border border-neutral-200 flex items-center justify-center hover:border-[#DC1423]"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* DONOR QUEUE */}
      {currentUser.role === 'donor' && (
        <div className="space-y-3">
          {requests.filter((r) => r.status === 'SEARCHING' || r.provider_id === currentUser.id).length === 0 ? (
            <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center space-y-1.5">
              <div className="font-display font-bold text-base text-[#141417]">
                No nearby requests yet
              </div>
              <p className="text-xs text-neutral-500">
                Compatible {currentUser.blood_type} blood requests near {currentUser.address} will appear here automatically.
              </p>
            </div>
          ) : null}
          {requests
            .filter((r) => r.status === 'SEARCHING' || r.provider_id === currentUser.id)
            .map((r) => {
              const compatible = isBloodCompatible(currentUser.blood_type, r.blood_type);
              const dist = haversineKm(currentUser.lat, currentUser.lng, r.dropoff_lat, r.dropoff_lng);
              const isMine = r.provider_id === currentUser.id;
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display font-bold text-base text-[#141417]">
                        {r.blood_type} Needed · {r.units} unit(s)
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {r.dropoff_address} · {dist} km · {r.urgency.toUpperCase()}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#DC1423]">
                      {formatRequestStatusLabel(r.status)}
                    </span>
                  </div>

                  {r.notes && <p className="text-xs text-neutral-600">{r.notes}</p>}

                  <div className="flex flex-wrap gap-2">
                    {r.status === 'SEARCHING' && (
                      <>
                        <button
                          type="button"
                          disabled={!compatible || busyId === r.id}
                          onClick={() => runAction(r.id, () => onClaimRequest(r.id, true))}
                          className="px-4 py-2.5 rounded-xl bg-[#DC1423] hover:bg-[#B9101D] text-white text-xs font-bold disabled:opacity-40 min-h-[42px]"
                        >
                          {compatible
                            ? 'Accept & Dispatch Rider'
                            : `Incompatible (${currentUser.blood_type})`}
                        </button>
                        {compatible && (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => runAction(r.id, () => onClaimRequest(r.id, false))}
                            className="px-4 py-2.5 rounded-xl bg-[#F6F6F8] text-xs font-bold text-[#141417] min-h-[42px]"
                          >
                            Self-Deliver
                          </button>
                        )}
                      </>
                    )}

                    {isMine && r.status === 'DONOR_ACCEPTED' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => runAction(r.id, () => onRequestRider(r.id))}
                        className="px-4 py-2.5 rounded-xl bg-[#141417] text-white text-xs font-bold min-h-[42px]"
                      >
                        Request Rider Pickup
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectRequestAndMap(r.id)}
                      className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[42px]"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#DC1423]" />
                      <span>Map</span>
                    </button>

                    {isMine && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(r.needer_id, r.id)}
                        className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[42px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#DC1423]" />
                        <span>Chat Needer</span>
                      </button>
                    )}

                    {r.rider_id && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(r.rider_id!, r.id)}
                        className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[42px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#DC1423]" />
                        <span>Chat Rider</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* HOSPITAL REQUESTS QUEUE */}
      {currentUser.role === 'hospital' && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-base text-[#141417] px-1">
            Nearby Emergency Requests
          </h2>
          {requests.filter((r) => r.status === 'SEARCHING' || r.provider_id === currentUser.id).length === 0 && (
            <div className="bg-white rounded-3xl border border-neutral-200 p-7 text-center space-y-1.5">
              <div className="font-display font-bold text-sm text-[#141417]">
                No nearby emergency requests right now
              </div>
              <p className="text-xs text-neutral-500">
                New nearby requests matching your blood stock will alert your hospital in real time.
              </p>
            </div>
          )}
          {requests
            .filter((r) => r.status === 'SEARCHING' || r.provider_id === currentUser.id)
            .map((r) => {
              const inStock = currentUser.inventory?.[r.blood_type] ?? 0;
              const isMine = r.provider_id === currentUser.id;
              const dist = haversineKm(currentUser.lat, currentUser.lng, r.dropoff_lat, r.dropoff_lng);
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display font-bold text-base text-[#141417]">
                        {r.blood_type} · {r.units} unit(s) · {r.urgency.toUpperCase()}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {r.dropoff_address} · {dist} km · Stock: {inStock}u
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#DC1423]">
                      {formatRequestStatusLabel(r.status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {r.status === 'SEARCHING' && (
                      <button
                        type="button"
                        disabled={inStock < 1 || busyId === r.id}
                        onClick={() => runAction(r.id, () => onClaimRequest(r.id, true))}
                        className="px-4 py-2.5 rounded-xl bg-[#DC1423] hover:bg-[#B9101D] text-white text-xs font-bold disabled:opacity-40 min-h-[42px]"
                      >
                        {inStock >= 1
                          ? 'Confirm Stock & Dispatch Rider'
                          : `Out of ${r.blood_type} Stock`}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectRequestAndMap(r.id)}
                      className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 min-h-[42px]"
                    >
                      Map
                    </button>
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(r.needer_id, r.id)}
                        className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 min-h-[42px]"
                      >
                        Chat Needer
                      </button>
                    )}
                    {r.rider_id && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(r.rider_id!, r.id)}
                        className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 min-h-[42px]"
                      >
                        Chat Rider
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* RIDER JOBS QUEUE */}
      {currentUser.role === 'rider' && (
        <div className="space-y-3">
          {requests.filter((r) => r.status === 'AWAITING_RIDER' || r.rider_id === currentUser.id).length === 0 && (
            <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center space-y-1.5">
              <div className="font-display font-bold text-base text-[#141417]">
                No pickup jobs awaiting rider
              </div>
              <p className="text-xs text-neutral-500">
                When a donor or hospital confirms a blood unit nearby, your pickup alert will appear here.
              </p>
            </div>
          )}
          {requests
            .filter((r) => r.status === 'AWAITING_RIDER' || r.rider_id === currentUser.id)
            .map((r) => {
              const isMine = r.rider_id === currentUser.id;
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display font-bold text-base text-[#141417]">
                        {r.blood_type} · {r.units} unit(s) · {r.urgency.toUpperCase()}
                      </div>
                      <div className="text-xs text-neutral-600 mt-1">
                        Pickup: <strong>{r.provider_name || 'Verified Provider'}</strong> ({r.pickup_address})
                      </div>
                      <div className="text-xs text-neutral-600 mt-0.5">
                        Dropoff: <strong>{r.dropoff_address}</strong>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#DC1423]">
                      {formatRequestStatusLabel(r.status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {r.status === 'AWAITING_RIDER' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => runAction(r.id, () => onAcceptRide(r.id))}
                        className="px-4 py-2.5 rounded-xl bg-[#DC1423] hover:bg-[#B9101D] text-white text-xs font-bold min-h-[42px]"
                      >
                        Accept Pickup Job
                      </button>
                    )}

                    {isMine && r.status === 'RIDER_ASSIGNED' && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => runAction(r.id, () => onPickupBlood(r.id))}
                        className="px-4 py-2.5 rounded-xl bg-[#DC1423] hover:bg-[#B9101D] text-white text-xs font-bold min-h-[42px]"
                      >
                        Confirm Blood Picked Up
                      </button>
                    )}

                    {isMine && r.status === 'IN_TRANSIT' && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => {
                            const curLat = r.rider_lat ?? r.pickup_lat ?? currentUser.lat;
                            const curLng = r.rider_lng ?? r.pickup_lng ?? currentUser.lng;
                            const next = interpolateCoord(
                              curLat,
                              curLng,
                              r.dropoff_lat,
                              r.dropoff_lng,
                              0.4
                            );
                            runAction(r.id, () => onUpdateRiderLocation(r.id, next.lat, next.lng));
                          }}
                          className="px-4 py-2.5 rounded-xl bg-[#141417] text-white text-xs font-bold flex items-center gap-1.5 min-h-[42px]"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Update GPS Step</span>
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => runAction(r.id, () => onDeliverBlood(r.id))}
                          className="px-4 py-2.5 rounded-xl bg-[#DC1423] hover:bg-[#B9101D] text-white text-xs font-bold min-h-[42px]"
                        >
                          Mark Delivered
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectRequestAndMap(r.id)}
                      className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[42px]"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#DC1423]" />
                      <span>Map</span>
                    </button>

                    {isMine && r.provider_id && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(r.provider_id!, r.id)}
                        className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[42px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#DC1423]" />
                        <span>Chat {r.pickup_type === 'donor' ? 'Donor' : 'Hospital'}</span>
                      </button>
                    )}

                    {isMine && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(r.needer_id, r.id)}
                        className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[42px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#DC1423]" />
                        <span>Chat Needer</span>
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
