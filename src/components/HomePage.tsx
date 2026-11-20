import {
  Bell,
  ChevronRight,
  Droplet,
  HeartPulse,
  LocateFixed,
  Map,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  Radio,
  Search,
  SlidersHorizontal,
  Sparkles,
  Syringe,
} from 'lucide-react';
import { formatRequestStatusLabel, haversineKm } from '../shared/bloodLogic';
import type { BloodRequest, TikaCampaign, TikaRegistration, UserProfile } from '../types';
import type { NearbyCounts } from '../utils/api';
import type { LocationPermissionState, LiveGeoCoords } from '../utils/useLiveLocation';

export type AppRoute =
  | 'home'
  | 'request'
  | 'queue'
  | 'orders'
  | 'tika'
  | 'map'
  | 'chat'
  | 'notifications'
  | 'profile';

interface HomePageProps {
  currentUser: UserProfile;
  nearbyCounts: NearbyCounts;
  requests: BloodRequest[];
  tikaCampaigns: TikaCampaign[];
  tikaRegistrations: TikaRegistration[];
  liveCoords: LiveGeoCoords | null;
  locationStatus: LocationPermissionState;
  unreadCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRequestLocation: () => void;
  onNavigate: (route: AppRoute) => void;
  onSelectRequestAndMap: (requestId: string) => void;
  onToggleAvailability: () => Promise<void>;
  onOpenAi: () => void;
}

export function HomePage({
  currentUser,
  nearbyCounts,
  requests,
  tikaCampaigns,
  tikaRegistrations,
  liveCoords,
  locationStatus,
  unreadCount,
  searchQuery,
  onSearchChange,
  onRequestLocation,
  onNavigate,
  onSelectRequestAndMap,
  onToggleAvailability,
  onOpenAi,
}: HomePageProps) {
  const isGov = currentUser.role === 'government';

  const activeOrder =
    requests.find(
      (r) =>
        r.status !== 'DELIVERED' &&
        r.status !== 'CANCELLED' &&
        (r.needer_id === currentUser.id ||
          r.provider_id === currentUser.id ||
          r.rider_id === currentUser.id)
    ) || null;

  const primaryActionRoute: AppRoute =
    isGov ? 'tika' : currentUser.role === 'needer' ? 'request' : 'queue';

  const primaryActionLabel = isGov
    ? 'Tika Console'
    : currentUser.role === 'needer'
    ? 'Request Blood'
    : currentUser.role === 'hospital'
    ? 'Blood Bank'
    : currentUser.role === 'rider'
    ? 'Pickup Jobs'
    : 'Donor Radar';

  const openRequestsCount = requests.filter((r) => r.status === 'SEARCHING').length;
  const awaitingRiderCount = requests.filter((r) => r.status === 'AWAITING_RIDER').length;
  const activeTikaCount = tikaCampaigns.filter((c) => c.status === 'ACTIVE').length;

  const q = searchQuery.trim().toLowerCase();
  const visibleRequests = requests.filter((r) => {
    if (!q) return true;
    return (
      r.blood_type.toLowerCase().includes(q) ||
      r.dropoff_address.toLowerCase().includes(q) ||
      r.urgency.toLowerCase().includes(q)
    );
  });

  const pendingIncoming =
    currentUser.role === 'rider'
      ? visibleRequests.filter((r) => r.status === 'AWAITING_RIDER')
      : currentUser.role === 'donor' || currentUser.role === 'hospital'
      ? visibleRequests.filter((r) => r.status === 'SEARCHING')
      : visibleRequests.filter((r) => r.needer_id === currentUser.id && r.status !== 'CANCELLED');

  const roleBadgeLabel =
    currentUser.role === 'government' ? 'GOVT TIKA CARE' : currentUser.role.toUpperCase();

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 pb-6">
      {/* Native Screen 1 Crimson Curved Top Section */}
      <section className="bg-[#DC1423] text-white rounded-b-[32px] sm:rounded-[32px] px-5 pt-5 pb-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              aria-label="Open profile"
              className="w-11 h-11 rounded-full bg-white text-[#DC1423] font-display font-extrabold text-base flex items-center justify-center shrink-0"
            >
              {(currentUser.hospital_name || currentUser.name).charAt(0).toUpperCase()}
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-base leading-tight truncate">
                Hi, {(currentUser.hospital_name || currentUser.name).split(' ')[0]}
              </h1>
              <button
                type="button"
                onClick={() => {
                  onRequestLocation();
                  onNavigate('map');
                }}
                className="max-w-full text-xs text-white/90 mt-0.5 inline-flex items-center gap-1 hover:underline"
              >
                <LocateFixed className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  {roleBadgeLabel} ·{' '}
                  {liveCoords
                    ? `Live GPS (${liveCoords.lat.toFixed(3)}, ${liveCoords.lng.toFixed(3)})`
                    : locationStatus === 'requesting'
                    ? 'Acquiring GPS...'
                    : currentUser.address}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label="Open AI Assistant"
              onClick={onOpenAi}
              className="w-11 h-11 rounded-full bg-white text-[#DC1423] flex items-center justify-center hover:bg-red-50 transition-colors shadow-sm"
              title="Blood Life AI Assistant"
            >
              <Sparkles className="w-5 h-5 fill-[#DC1423]" />
            </button>
            <button
              type="button"
              aria-label="Open notifications"
              onClick={() => onNavigate('notifications')}
              className="relative w-11 h-11 rounded-full bg-white text-[#141417] flex items-center justify-center hover:bg-neutral-100 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#141417] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Quick dispatch action"
              onClick={() => onNavigate(primaryActionRoute)}
              className="w-11 h-11 rounded-full bg-white text-[#141417] flex items-center justify-center hover:bg-neutral-100 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Embedded Crisp White Banner Card */}
        <div className="mt-4 bg-white rounded-2xl p-4 text-[#141417] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display font-bold text-lg leading-snug">
              {isGov ? (
                <>
                  <span className="block">Govt Tika Care</span>
                  <span className="block">Public Immunity</span>
                </>
              ) : (
                <>
                  <span className="block">Donate Blood</span>
                  <span className="block">Save Life</span>
                </>
              )}
            </p>
            {isGov ? (
              <button
                type="button"
                onClick={() => onNavigate('tika')}
                className="mt-2 text-xs font-bold text-[#DC1423] inline-flex items-center gap-1 hover:underline"
              >
                <span>Launch Tika Campaign</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : currentUser.role === 'needer' ? (
              <button
                type="button"
                onClick={() => onNavigate('request')}
                className="mt-2 text-xs font-bold text-[#DC1423] inline-flex items-center gap-1 hover:underline"
              >
                <span>Request urgent unit</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleAvailability}
                className="mt-2 text-xs font-bold text-[#DC1423] inline-flex items-center gap-1 hover:underline"
              >
                <span>{currentUser.is_available ? 'Online · Tap to pause' : 'Offline · Tap to go online'}</span>
              </button>
            )}
          </div>
          <img
            src="/src/assets/images/blood_donation_banner_1794741118202.jpg"
            alt={isGov ? 'Government Tika Care' : 'Donate Blood Save Life'}
            referrerPolicy="no-referrer"
            className="w-32 h-22 object-cover rounded-xl shrink-0 bg-neutral-100"
          />
        </div>

        {/* Rounded Search Bar */}
        <div className="mt-3.5 flex items-center gap-2">
          <div className="flex-1 bg-white rounded-2xl px-3.5 h-12 flex items-center gap-2.5 text-[#141417]">
            <MapPin className="w-4 h-4 text-[#DC1423] shrink-0" />
            <span className="text-neutral-300 select-none">|</span>
            <input
              type="search"
              aria-label="Search your active requests and dispatches"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={isGov ? 'Search Tika drives or camps' : 'Search your requests or area'}
              className="w-full text-sm bg-transparent focus:outline-none placeholder:text-neutral-400"
            />
            <Search className="w-4 h-4 text-[#DC1423] shrink-0" />
          </div>
          <button
            type="button"
            aria-label="Open live map view"
            onClick={() => onNavigate('map')}
            className="w-12 h-12 rounded-2xl bg-white text-[#141417] hover:bg-neutral-100 flex items-center justify-center shrink-0 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </section>

      <div className="px-4 sm:px-0 space-y-5">
        {/* Live Active Trip / Searching Shortcut Card */}
        {activeOrder && !isGov && (
          <button
            type="button"
            onClick={() => onSelectRequestAndMap(activeOrder.id)}
            className="w-full text-left bg-[#141417] text-white rounded-2xl p-4 flex items-center justify-between gap-3 hover:bg-neutral-900 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-[#FF4D5A] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                <span>
                  {activeOrder.status === 'SEARCHING'
                    ? 'Searching Nearby Donors & Hospitals'
                    : `Active Dispatch · ${activeOrder.blood_type} (${activeOrder.units}u)`}
                </span>
              </div>
              <div className="font-display font-bold text-sm mt-0.5 truncate">
                {formatRequestStatusLabel(activeOrder.status)}
              </div>
              <div className="text-xs text-neutral-300 truncate mt-0.5">
                {activeOrder.dropoff_address}
              </div>
            </div>
            <span className="px-3 py-2 rounded-xl bg-[#DC1423] text-white text-xs font-bold whitespace-nowrap shrink-0">
              {activeOrder.status === 'SEARCHING' ? 'View Radar' : 'Track Live'}
            </span>
          </button>
        )}

        {/* Government Tika Care Native Feature Banner (Accessible to All Citizens & Gov) */}
        <button
          type="button"
          onClick={() => onNavigate('tika')}
          className="w-full text-left bg-white rounded-2xl border-2 border-[#DC1423]/20 hover:border-[#DC1423] p-4 flex items-center justify-between gap-3 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-[#DC1423] text-white flex items-center justify-center shrink-0">
              <Syringe className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-[#141417]">
                {isGov ? 'Govt Tika Campaign Hub' : 'Govt Tika Care (EPI Sheba)'}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 tabular-nums truncate">
                {isGov
                  ? `${activeTikaCount} active drives · ${tikaRegistrations.length} registrations`
                  : `${activeTikaCount} active drives · ${tikaRegistrations.length} Tika card(s)`}
              </div>
            </div>
          </div>
          <span className="px-3 py-2 rounded-xl bg-red-50 text-[#DC1423] text-xs font-bold shrink-0">
            {isGov ? 'Manage' : 'Book Tika'}
          </span>
        </button>

        {/* 2x2 Role-Aware Privacy-Safe Native Action Tiles */}
        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onNavigate(primaryActionRoute)}
            className="p-3 rounded-2xl bg-white border border-neutral-200 hover:border-[#DC1423] text-left flex items-center gap-2.5 transition-colors min-h-[64px]"
          >
            <span className="w-9 h-9 rounded-full bg-red-50 text-[#DC1423] flex items-center justify-center shrink-0">
              {isGov ? <Syringe className="w-4 h-4" /> : <HeartPulse className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-[13px] leading-tight text-[#141417]">
                {primaryActionLabel}
              </div>
              <div className="text-[11px] text-neutral-500 tabular-nums mt-0.5">
                {isGov
                  ? `${activeTikaCount} campaigns`
                  : currentUser.role === 'rider'
                  ? `${awaitingRiderCount} pickups`
                  : currentUser.role === 'needer'
                  ? 'Dispatch unit'
                  : `${openRequestsCount} incoming`}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate(isGov ? 'notifications' : 'orders')}
            className="p-3 rounded-2xl bg-white border border-neutral-200 hover:border-[#DC1423] text-left flex items-center gap-2.5 transition-colors min-h-[64px]"
          >
            <span className="w-9 h-9 rounded-full bg-red-50 text-[#DC1423] flex items-center justify-center shrink-0">
              {isGov ? <Bell className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-[13px] leading-tight text-[#141417]">
                {isGov ? 'Govt Alerts' : 'Blood Orders'}
              </div>
              <div className="text-[11px] text-neutral-500 tabular-nums mt-0.5">
                {isGov ? `${unreadCount} unread` : `${requests.length} matched`}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onRequestLocation();
              onNavigate('map');
            }}
            className="p-3 rounded-2xl bg-white border border-neutral-200 hover:border-[#DC1423] text-left flex items-center gap-2.5 transition-colors min-h-[64px]"
          >
            <span className="w-9 h-9 rounded-full bg-red-50 text-[#DC1423] flex items-center justify-center shrink-0">
              <Map className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-[13px] leading-tight text-[#141417]">
                Live Map
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {liveCoords ? 'GPS Active' : 'Red & White'}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate(isGov ? 'profile' : 'chat')}
            className="p-3 rounded-2xl bg-white border border-neutral-200 hover:border-[#DC1423] text-left flex items-center gap-2.5 transition-colors min-h-[64px]"
          >
            <span className="w-9 h-9 rounded-full bg-red-50 text-[#DC1423] flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-[13px] leading-tight text-[#141417]">
                {isGov ? 'Center Profile' : 'Messages'}
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                {isGov ? 'EPI verified' : 'Matched chat'}
              </div>
            </div>
          </button>
        </section>

        {/* Privacy-Safe Network Readiness OR Gov Tika Summary */}
        {isGov ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display font-bold text-lg text-[#141417]">
                Active Tika Campaigns
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('tika')}
                className="text-xs font-semibold text-[#DC1423] hover:underline"
              >
                Open Console
              </button>
            </div>

            {tikaCampaigns.filter((c) => c.gov_user_id === currentUser.id).length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center space-y-2">
                <p className="font-display font-bold text-sm text-[#141417]">
                  No Govt Tika drives launched yet
                </p>
                <p className="text-xs text-neutral-500">
                  Open Tika Console to publish an official vaccination campaign and track citizen slots.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tikaCampaigns
                  .filter((c) => c.gov_user_id === currentUser.id)
                  .slice(0, 3)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onNavigate('tika')}
                      className="w-full text-left bg-white rounded-2xl border border-neutral-200 hover:border-[#DC1423] p-4 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm text-[#141417] truncate">
                          {c.title}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5 tabular-nums">
                          {c.vaccine_name} · {c.registered_count}/{c.total_slots} booked ·{' '}
                          {c.vaccinated_count} vaccinated
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#DC1423] shrink-0">{c.status}</span>
                    </button>
                  ))}
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display font-bold text-lg text-[#141417]">
                {currentUser.role === 'needer' ? 'Emergency Dispatch' : 'Incoming Dispatch'}
              </h2>
              <button
                type="button"
                onClick={() => onNavigate(currentUser.role === 'needer' ? 'orders' : 'queue')}
                className="text-xs font-semibold text-[#DC1423] hover:underline"
              >
                See All
              </button>
            </div>

            {/* Anonymous Live Network Readiness Card (Zero PII) */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-red-50 text-[#DC1423] flex items-center justify-center shrink-0">
                  <Droplet className="w-5 h-5 fill-[#DC1423]" />
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm text-[#141417]">
                    Nearby Live Readiness
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5 tabular-nums leading-snug">
                    {nearbyCounts.donors} donors · {nearbyCounts.hospitals} banks ·{' '}
                    {nearbyCounts.riders} riders
                  </p>
                </div>
              </div>
              {currentUser.role === 'needer' && (
                <button
                  type="button"
                  onClick={() => onNavigate('request')}
                  className="px-3.5 py-2.5 rounded-xl bg-[#DC1423] hover:bg-[#B9101D] text-white text-xs font-bold shrink-0 min-h-[40px]"
                >
                  Request
                </button>
              )}
            </div>

            {pendingIncoming.length === 0 ? (
              <div className="bg-white rounded-2xl border border-neutral-200 p-5 text-center space-y-2">
                <p className="font-display font-bold text-sm text-[#141417]">
                  {currentUser.role === 'needer'
                    ? 'No active blood requests'
                    : currentUser.role === 'rider'
                    ? 'No pickup jobs waiting right now'
                    : 'No nearby compatible requests right now'}
                </p>
                <p className="text-xs text-neutral-500">
                  {currentUser.role === 'needer'
                    ? 'Submit an urgent request to ping compatible nearby donors and hospitals.'
                    : 'Stay online — you will receive a real-time alert as soon as a nearby request matches you.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingIncoming.slice(0, 3).map((r) => {
                  const dist = haversineKm(
                    liveCoords?.lat ?? currentUser.lat,
                    liveCoords?.lng ?? currentUser.lng,
                    r.dropoff_lat,
                    r.dropoff_lng
                  );
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        currentUser.role === 'needer'
                          ? onSelectRequestAndMap(r.id)
                          : onNavigate('queue')
                      }
                      className="w-full text-left bg-white rounded-2xl border border-neutral-200 hover:border-[#DC1423] p-4 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm text-[#141417]">
                          {r.blood_type} · {r.units} unit(s) · {r.urgency.toUpperCase()}
                        </div>
                        <div className="text-xs text-neutral-500 truncate mt-0.5 tabular-nums">
                          {r.dropoff_address} · {dist} km away
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#DC1423] shrink-0">
                        {formatRequestStatusLabel(r.status)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
