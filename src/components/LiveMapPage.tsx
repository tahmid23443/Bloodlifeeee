import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Droplet, LocateFixed, MessageCircle, Navigation, X } from 'lucide-react';
import {
  estimateMinutes,
  formatRequestStatusLabel,
  haversineKm,
  interpolateCoord,
} from '../shared/bloodLogic';
import type { BloodRequest, TikaCampaign, UserProfile } from '../types';
import type { NearbyCounts } from '../utils/api';
import type { LocationPermissionState, LiveGeoCoords } from '../utils/useLiveLocation';
import { LeafletMap } from './LeafletMap';

interface LiveMapPageProps {
  currentUser: UserProfile;
  providers: UserProfile[];
  nearbyCounts: NearbyCounts;
  requests: BloodRequest[];
  tikaCampaigns: TikaCampaign[];
  liveCoords: LiveGeoCoords | null;
  locationStatus: LocationPermissionState;
  locationError: string;
  onRequestLocation: () => void;
  selectedRequestId: string | null;
  pickLocationMode: boolean;
  pickedCoords: { lat: number; lng: number };
  onSelectRequest: (id: string) => void;
  onMapPick: (lat: number, lng: number) => void;
  onConfirmMapPick: () => void;
  onOpenChat: (partnerId: string, requestId?: string | null) => void;
  onDeliverBlood: (requestId: string) => Promise<void>;
  onCancelRequest: (requestId: string) => Promise<void>;
  onUpdateRiderLocation: (requestId: string, lat: number, lng: number) => Promise<void>;
  onBack: () => void;
}

export function LiveMapPage({
  currentUser,
  providers,
  nearbyCounts,
  requests,
  tikaCampaigns,
  liveCoords,
  locationStatus,
  locationError,
  onRequestLocation,
  selectedRequestId,
  pickLocationMode,
  pickedCoords,
  onSelectRequest,
  onMapPick,
  onConfirmMapPick,
  onOpenChat,
  onDeliverBlood,
  onCancelRequest,
  onUpdateRiderLocation,
  onBack,
}: LiveMapPageProps) {
  const [cancelling, setCancelling] = useState(false);
  const [mapLayer, setMapLayer] = useState<'all' | 'blood' | 'tika'>('all');
  const [centerTrigger, setCenterTrigger] = useState(0);

  const activeRequest =
    requests.find((r) => r.id === selectedRequestId) ||
    requests.find(
      (r) =>
        r.status !== 'DELIVERED' &&
        r.status !== 'CANCELLED' &&
        (r.needer_id === currentUser.id ||
          r.provider_id === currentUser.id ||
          r.rider_id === currentUser.id)
    ) ||
    requests[0] ||
    null;

  const isSearchingRadar =
    Boolean(activeRequest) && activeRequest?.status === 'SEARCHING' && !pickLocationMode && mapLayer !== 'tika';

  const distanceKm = (() => {
    if (!activeRequest) return null;
    if (activeRequest.rider_lat && activeRequest.rider_lng) {
      return haversineKm(
        activeRequest.rider_lat,
        activeRequest.rider_lng,
        activeRequest.dropoff_lat,
        activeRequest.dropoff_lng
      );
    }
    if (activeRequest.pickup_lat && activeRequest.pickup_lng) {
      return haversineKm(
        activeRequest.pickup_lat,
        activeRequest.pickup_lng,
        activeRequest.dropoff_lat,
        activeRequest.dropoff_lng
      );
    }
    return null;
  })();

  function stepIndex(status: BloodRequest['status']) {
    if (status === 'HOSPITAL_CONFIRMED' || status === 'DONOR_ACCEPTED') return 1;
    const steps = ['SEARCHING', 'AWAITING_RIDER', 'RIDER_ASSIGNED', 'IN_TRANSIT', 'DELIVERED'];
    const idx = steps.indexOf(status);
    return idx === -1 ? 0 : idx;
  }

  async function handleCancel(reqId: string) {
    setCancelling(true);
    try {
      await onCancelRequest(reqId);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="relative w-full h-full min-h-[calc(100dvh-64px)] md:min-h-full flex flex-col">
      {/* Floating Native Top Map Controls (Red & White) */}
      <div className="absolute top-3 inset-x-3 z-[450] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="w-11 h-11 rounded-full bg-white shadow-md border border-red-100 flex items-center justify-center text-[#141417] hover:bg-red-50 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {!pickLocationMode && (
            <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-md border border-red-100 flex items-center gap-1">
              {(['all', 'blood', 'tika'] as const).map((layer) => (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setMapLayer(layer)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
                    mapLayer === layer
                      ? 'bg-[#DC1423] text-white'
                      : 'text-neutral-600 hover:bg-red-50'
                  }`}
                >
                  {layer === 'all' ? 'All' : layer === 'blood' ? 'Blood' : 'Tika Camps'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {activeRequest && !pickLocationMode && (
            <div className="hidden sm:flex bg-white/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-md border border-red-100 items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isSearchingRadar ? 'bg-[#DC1423] animate-pulse' : 'bg-[#DC1423]'
                }`}
              />
              <span className="text-xs font-bold text-[#141417] whitespace-nowrap">
                {isSearchingRadar
                  ? `Radar · ${activeRequest.blood_type}`
                  : formatRequestStatusLabel(activeRequest.status)}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onRequestLocation();
              setCenterTrigger((c) => c + 1);
            }}
            className={`h-11 px-3.5 rounded-2xl shadow-md border text-xs font-bold flex items-center gap-1.5 transition-colors ${
              liveCoords
                ? 'bg-white border-[#DC1423] text-[#DC1423] hover:bg-red-50'
                : 'bg-[#DC1423] border-[#DC1423] text-white hover:bg-[#B9101D]'
            }`}
          >
            <LocateFixed className="w-4 h-4" />
            <span>
              {locationStatus === 'requesting'
                ? 'Locating...'
                : liveCoords
                ? 'Live GPS'
                : 'Enable GPS'}
            </span>
          </button>
        </div>
      </div>

      {/* Geolocation Error Banner */}
      {locationError && (
        <div className="absolute top-16 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-sm z-[450] bg-white border border-[#DC1423] rounded-2xl px-3.5 py-2.5 shadow-lg flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[#DC1423]">{locationError}</span>
          <button
            type="button"
            onClick={onRequestLocation}
            className="px-2.5 py-1 rounded-lg bg-[#DC1423] text-white font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Full-Screen Red & White Leaflet Canvas + Uber Searching Radar Overlay */}
      <div className="relative flex-1 w-full h-full">
        <LeafletMap
          currentUser={currentUser}
          providers={providers}
          activeRequest={activeRequest}
          liveCoords={liveCoords}
          tikaCampaigns={tikaCampaigns}
          mapLayer={mapLayer}
          centerTrigger={centerTrigger}
          pickLocationMode={pickLocationMode}
          pickedCoords={pickLocationMode ? pickedCoords : null}
          onMapPick={onMapPick}
        />

        {/* Uber-Style Concentric Crimson Radar Animation Overlay when SEARCHING */}
        {isSearchingRadar && (
          <div
            aria-label="Searching nearby donors and hospitals"
            className="pointer-events-none absolute inset-0 z-[410] flex items-center justify-center overflow-hidden"
          >
            <div className="relative w-56 h-56 flex items-center justify-center">
              <span className="radar-ring-1 absolute inset-0 rounded-full border-2 border-[#DC1423]/55 bg-[#DC1423]/10" />
              <span className="radar-ring-2 absolute inset-0 rounded-full border-2 border-[#DC1423]/45 bg-[#DC1423]/8" />
              <span className="radar-ring-3 absolute inset-0 rounded-full border-2 border-[#DC1423]/35 bg-[#DC1423]/5" />
              <div className="relative w-14 h-14 rounded-full bg-[#DC1423] text-white border-4 border-white shadow-xl flex items-center justify-center">
                <Droplet className="w-6 h-6 fill-white" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Sheet: Pin Confirmation OR Uber Searching Sheet OR Live Dispatch Tracker */}
      {pickLocationMode ? (
        <div className="absolute bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] z-[450] bg-white rounded-3xl p-4 shadow-xl border border-neutral-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display font-bold text-sm text-[#141417]">Pin Delivery Location</div>
            <div className="text-xs text-neutral-500 tabular-nums truncate">
              {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
            </div>
          </div>
          <button
            type="button"
            onClick={onConfirmMapPick}
            className="px-4 py-2.5 rounded-xl bg-[#DC1423] text-white text-xs font-bold shrink-0"
          >
            Use Location
          </button>
        </div>
      ) : isSearchingRadar && activeRequest ? (
        <div
          data-testid="uber-searching-sheet"
          className="bg-white border-t border-neutral-200 px-5 py-5 sm:rounded-t-3xl shadow-xl z-[450]"
        >
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Uber-style sweeping search bar */}
            <div className="w-full h-1.5 rounded-full bg-red-100 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-[#DC1423] animate-pulse" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#DC1423] animate-ping" />
                  <span className="text-xs font-bold text-[#DC1423] uppercase tracking-wide">
                    Live Dispatch Radar
                  </span>
                </div>
                <h2 className="font-display font-bold text-lg text-[#141417] mt-1">
                  Searching nearby compatible donors & hospitals...
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                  {activeRequest.blood_type} · {activeRequest.units} unit(s) ·{' '}
                  {nearbyCounts.donors} donors & {nearbyCounts.hospitals} blood banks online nearby
                </p>
              </div>

              {activeRequest.needer_id === currentUser.id && (
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => handleCancel(activeRequest.id)}
                  className="px-4 py-2.5 rounded-2xl bg-[#F6F6F8] hover:bg-red-50 hover:text-[#DC1423] text-[#141417] text-xs font-bold flex items-center gap-1.5 min-h-[44px] transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  <span>{cancelling ? 'Cancelling...' : 'Cancel Request'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        activeRequest && (
          <div className="bg-white border-t border-neutral-200 px-5 py-4 sm:rounded-t-3xl shadow-lg z-[450]">
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#DC1423]">
                      {activeRequest.blood_type} · {activeRequest.units} unit(s)
                    </span>
                    {requests.length > 1 && (
                      <select
                        aria-label="Switch tracked dispatch"
                        value={activeRequest.id}
                        onChange={(e) => onSelectRequest(e.target.value)}
                        className="text-xs bg-[#F6F6F8] rounded-lg px-2 py-1 font-semibold text-neutral-700"
                      >
                        {requests.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.blood_type} — {r.dropoff_address.slice(0, 26)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <h2 className="font-display font-bold text-base text-[#141417] mt-0.5">
                    {formatRequestStatusLabel(activeRequest.status)}
                  </h2>
                  <p className="text-xs text-neutral-500 truncate">
                    To: {activeRequest.dropoff_address}
                    {activeRequest.provider_name ? ` · From: ${activeRequest.provider_name}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {distanceKm !== null && (
                    <div className="text-right tabular-nums mr-1">
                      <div className="font-display font-bold text-sm text-[#141417]">
                        {estimateMinutes(distanceKm)} min
                      </div>
                      <div className="text-[11px] text-neutral-500">{distanceKm} km</div>
                    </div>
                  )}

                  {activeRequest.provider_id && activeRequest.provider_id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(activeRequest.provider_id!, activeRequest.id)}
                      className="px-3.5 py-2.5 rounded-xl border border-neutral-200 text-[#141417] text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[#DC1423]" />
                      <span>Chat {activeRequest.pickup_type === 'donor' ? 'Donor' : 'Hospital'}</span>
                    </button>
                  )}

                  {activeRequest.rider_id && activeRequest.rider_id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(activeRequest.rider_id!, activeRequest.id)}
                      className="px-3.5 py-2.5 rounded-xl bg-[#DC1423] text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Chat Rider</span>
                    </button>
                  )}

                  {activeRequest.status === 'IN_TRANSIT' &&
                    currentUser.role === 'rider' &&
                    activeRequest.rider_id === currentUser.id && (
                      <button
                        type="button"
                        onClick={() => {
                          const curLat = activeRequest.rider_lat ?? activeRequest.pickup_lat ?? currentUser.lat;
                          const curLng = activeRequest.rider_lng ?? activeRequest.pickup_lng ?? currentUser.lng;
                          const next = interpolateCoord(
                            curLat,
                            curLng,
                            activeRequest.dropoff_lat,
                            activeRequest.dropoff_lng,
                            0.4
                          );
                          onUpdateRiderLocation(activeRequest.id, next.lat, next.lng);
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-[#141417] text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Step GPS</span>
                      </button>
                    )}

                  {activeRequest.status === 'IN_TRANSIT' &&
                    (currentUser.role === 'needer' || activeRequest.rider_id === currentUser.id) && (
                      <button
                        type="button"
                        onClick={() => onDeliverBlood(activeRequest.id)}
                        className="px-3.5 py-2.5 rounded-xl bg-[#141417] text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{currentUser.role === 'needer' ? 'Confirm Received' : 'Delivered'}</span>
                      </button>
                    )}
                </div>
              </div>

              {/* 5-Step Progress Strip */}
              <div className="grid grid-cols-5 gap-2">
                {['Searching', 'Matched', 'Assigned', 'In Transit', 'Delivered'].map((lbl, idx) => {
                  const active = idx <= stepIndex(activeRequest.status) && activeRequest.status !== 'CANCELLED';
                  return (
                    <div key={lbl} className="space-y-1">
                      <div className={`h-1.5 rounded-full ${active ? 'bg-[#DC1423]' : 'bg-neutral-200'}`} />
                      <div className={`text-[11px] font-medium truncate ${active ? 'text-[#141417]' : 'text-neutral-400'}`}>
                        {lbl}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
