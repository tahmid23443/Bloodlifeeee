import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Droplet,
  HeartPulse,
  Home,
  LogOut,
  Map,
  MessageCircle,
  PackageCheck,
  Syringe,
  User,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { AiAssistantModal } from './components/AiAssistantModal';
import { ChatView } from './components/ChatView';
import { DirectoryPage } from './components/DirectoryPages';
import { DonorProfileView } from './components/DonorProfileView';
import { HomePage, type AppRoute } from './components/HomePage';
import { LiveMapPage } from './components/LiveMapPage';
import { NotificationsPage } from './components/NotificationsPage';
import { RequestBloodPage } from './components/RequestBloodPage';
import { RoleQueuePage } from './components/RoleQueuePage';
import { TikaCarePage } from './components/TikaCarePage';
import type {
  AppNotification,
  BloodRequest,
  BloodType,
  ChatMessage,
  TikaCampaign,
  TikaCampaignStatus,
  TikaRegistration,
  TikaRegistrationStatus,
  UrgencyLevel,
  UserProfile,
} from './types';
import { api, triggerBrowserPush, type NearbyCounts } from './utils/api';
import { useLiveLocation } from './utils/useLiveLocation';

const STORAGE_KEY = 'bloodlife_user_id';
const PRIMARY_TABS: AppRoute[] = ['home', 'tika', 'map', 'profile'];

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [route, setRoute] = useState<AppRoute>('home');
  const [providers, setProviders] = useState<UserProfile[]>([]);
  const [nearbyCounts, setNearbyCounts] = useState<NearbyCounts>({
    donors: 0,
    hospitals: 0,
    riders: 0,
  });
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [tikaCampaigns, setTikaCampaigns] = useState<TikaCampaign[]>([]);
  const [tikaRegistrations, setTikaRegistrations] = useState<TikaRegistration[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [chatTarget, setChatTarget] = useState<{ partnerId: string; requestId?: string | null } | null>(null);
  const [incomingMessages, setIncomingMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickLocationMode, setPickLocationMode] = useState(false);
  const [pickLocationTarget, setPickLocationTarget] = useState<'request' | 'tika'>('request');
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number }>({
    lat: 23.7465,
    lng: 90.376,
  });
  const [toastAlert, setToastAlert] = useState<{ title: string; body: string } | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const { liveCoords, locationStatus, locationError, requestLocation } = useLiveLocation(
    Boolean(currentUser)
  );

  const wsRef = useRef<WebSocket | null>(null);
  const requestsRef = useRef<BloodRequest[]>([]);
  requestsRef.current = requests;

  const refreshScopedData = useCallback(async (userId: string) => {
    const [provRes, reqRes, notifRes, campRes, regRes] = await Promise.all([
      api.getProviders(userId),
      api.getRequests(userId),
      api.getNotifications(userId),
      api.getTikaCampaigns(userId),
      api.getTikaRegistrations(userId),
    ]);
    setProviders(provRes.providers);
    setNearbyCounts(provRes.nearbyCounts);
    setRequests(reqRes.requests);
    setNotifications(notifRes.notifications);
    setTikaCampaigns(campRes.campaigns);
    setTikaRegistrations(regRes.registrations);
    setSelectedRequestId((prev) => {
      if (prev && reqRes.requests.some((r) => r.id === prev)) return prev;
      return reqRes.requests[0]?.id || null;
    });
  }, []);

  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);

    async function bootstrap() {
      try {
        if (savedId) {
          const { user } = await api.getUser(savedId);
          setCurrentUser(user);
          setPickedCoords({ lat: user.lat, lng: user.lng });
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setBootLoading(false);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    refreshScopedData(currentUser.id).catch(() => {});
  }, [currentUser?.id, refreshScopedData]);

  // Sync browser Live GPS updates to backend user coordinates & active rider dispatch
  useEffect(() => {
    if (!currentUser || !liveCoords) return;

    setPickedCoords((prev) =>
      pickLocationMode ? prev : { lat: liveCoords.lat, lng: liveCoords.lng }
    );

    api
      .updateUser(currentUser.id, { lat: liveCoords.lat, lng: liveCoords.lng })
      .then(({ user }) => setCurrentUser(user))
      .catch(() => {});

    if (currentUser.role === 'rider') {
      const activeTrip = requestsRef.current.find(
        (r) =>
          r.rider_id === currentUser.id &&
          (r.status === 'RIDER_ASSIGNED' || r.status === 'IN_TRANSIT')
      );
      if (activeTrip) {
        api
          .updateLocation(activeTrip.id, liveCoords.lat, liveCoords.lng, currentUser.id)
          .catch(() => {});
      }
    }
  }, [liveCoords?.lat, liveCoords?.lng, currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?userId=${encodeURIComponent(currentUser.id)}`;
    let closedByCleanup = false;
    let wsOpened = false;
    let wsFailures = 0;
    let pollTimer: number | null = null;
    let reconnectTimer: number | null = null;

    function startPollingFallback() {
      if (pollTimer !== null || closedByCleanup) return;
      pollTimer = window.setInterval(() => {
        if (currentUser?.id) {
          refreshScopedData(currentUser.id).catch(() => {});
        }
      }, 4500);
    }

    function connect() {
      if (closedByCleanup) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        wsOpened = true;
        wsFailures = 0;
        if (pollTimer !== null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
        ws.send(JSON.stringify({ type: 'auth', userId: currentUser!.id }));
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          switch (msg.event) {
            case 'presence:update':
              setOnlineUserIds(msg.payload?.onlineUserIds || []);
              break;

            case 'provider:updated': {
              const updatedUser = msg.payload as UserProfile;
              setProviders((prev) => {
                const exists = prev.some((p) => p.id === updatedUser.id);
                return exists
                  ? prev.map((p) => (p.id === updatedUser.id ? updatedUser : p))
                  : [...prev, updatedUser];
              });
              if (updatedUser.id === currentUser!.id) {
                setCurrentUser(updatedUser);
              }
              break;
            }

            case 'request:created': {
              const created = msg.payload.request as BloodRequest;
              setRequests((prev) =>
                prev.some((r) => r.id === created.id) ? prev : [created, ...prev]
              );
              break;
            }

            case 'request:updated': {
              const updated = msg.payload as BloodRequest;
              setRequests((prev) => {
                const exists = prev.some((r) => r.id === updated.id);
                return exists
                  ? prev.map((r) => (r.id === updated.id ? updated : r))
                  : [updated, ...prev];
              });
              api
                .getProviders(currentUser!.id)
                .then((pRes) => {
                  setProviders(pRes.providers);
                  setNearbyCounts(pRes.nearbyCounts);
                })
                .catch(() => {});
              break;
            }

            case 'request:closed': {
              const { requestId, providerId, riderId, neederId } = msg.payload as {
                requestId: string;
                providerId?: string | null;
                riderId?: string | null;
                neederId?: string | null;
              };
              const isParticipant =
                currentUser!.id === neederId ||
                currentUser!.id === providerId ||
                currentUser!.id === riderId;
              if (!isParticipant) {
                setRequests((prev) => prev.filter((r) => r.id !== requestId));
              }
              break;
            }

            case 'location:updated': {
              const updated = msg.payload.request as BloodRequest;
              if (updated) {
                setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
              }
              break;
            }

            case 'chat:message': {
              const chatMsg = msg.payload as ChatMessage;
              setIncomingMessages((prev) =>
                prev.some((m) => m.id === chatMsg.id) ? prev : [...prev, chatMsg]
              );
              break;
            }

            case 'tika:campaign_created': {
              const created = msg.payload as TikaCampaign;
              setTikaCampaigns((prev) =>
                prev.some((c) => c.id === created.id) ? prev : [created, ...prev]
              );
              break;
            }

            case 'tika:campaign_updated': {
              const updated = msg.payload as TikaCampaign;
              setTikaCampaigns((prev) => {
                const exists = prev.some((c) => c.id === updated.id);
                return exists
                  ? prev.map((c) => (c.id === updated.id ? updated : c))
                  : [updated, ...prev];
              });
              break;
            }

            case 'tika:registration_created': {
              const created = msg.payload as TikaRegistration;
              setTikaRegistrations((prev) =>
                prev.some((r) => r.id === created.id) ? prev : [created, ...prev]
              );
              break;
            }

            case 'tika:registration_updated': {
              const updated = msg.payload as TikaRegistration;
              setTikaRegistrations((prev) =>
                prev.some((r) => r.id === updated.id)
                  ? prev.map((r) => (r.id === updated.id ? updated : r))
                  : [updated, ...prev]
              );
              break;
            }

            case 'notification:new': {
              const notif = msg.payload as AppNotification;
              setNotifications((prev) =>
                prev.some((n) => n.id === notif.id) ? prev : [notif, ...prev]
              );
              setToastAlert({ title: notif.title, body: notif.body });
              triggerBrowserPush(notif.title, notif.body);
              setTimeout(() => {
                setToastAlert((cur) => (cur?.title === notif.title ? null : cur));
              }, 4500);
              break;
            }
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        wsFailures += 1;
        if (!wsOpened && wsFailures >= 2) {
          // Serverless host (e.g., Vercel) without WebSocket upgrades: switch to HTTP polling
          startPollingFallback();
          return;
        }
        reconnectTimer = window.setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      closedByCleanup = true;
      if (pollTimer !== null) window.clearInterval(pollTimer);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [currentUser?.id, refreshScopedData]);

  function handleAuthenticated(user: UserProfile) {
    localStorage.setItem(STORAGE_KEY, user.id);
    setCurrentUser(user);
    setPickedCoords({ lat: user.lat, lng: user.lng });
    setRoute('home');
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
    setProviders([]);
    setRequests([]);
    setTikaCampaigns([]);
    setTikaRegistrations([]);
    setSelectedRequestId(null);
    setChatTarget(null);
    setNotifications([]);
    setRoute('home');
  }

  async function handleRequestPushPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setPushPermission(perm);
  }

  async function handleMarkNotificationsRead() {
    if (!currentUser) return;
    await api.markNotificationsRead(currentUser.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
  }

  async function handleToggleAvailability() {
    if (!currentUser) return;
    const nextVal = currentUser.is_available ? 0 : 1;
    const { user } = await api.updateUser(currentUser.id, { is_available: nextVal });
    setCurrentUser(user);
  }

  function handleUseLiveLocationForPick() {
    requestLocation();
    if (liveCoords) {
      setPickedCoords({ lat: liveCoords.lat, lng: liveCoords.lng });
    }
  }

  async function handleCreateRequest(payload: {
    blood_type: BloodType;
    units: number;
    urgency: UrgencyLevel;
    dropoff_address: string;
    dropoff_lat: number;
    dropoff_lng: number;
    notes: string;
  }) {
    if (!currentUser) return;
    const { request } = await api.createRequest({
      needer_id: currentUser.id,
      ...payload,
    });
    setRequests((prev) => (prev.some((r) => r.id === request.id) ? prev : [request, ...prev]));
    setSelectedRequestId(request.id);
    await refreshScopedData(currentUser.id);
    setRoute('map');
  }

  async function handleCancelRequest(requestId: string) {
    if (!currentUser) return;
    const { request } = await api.cancelRequest(requestId, currentUser.id);
    setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
    setRoute('home');
  }

  async function handleClaimRequest(requestId: string, dispatchRider = true) {
    if (!currentUser) return;
    const { request } = await api.claimRequest(requestId, currentUser.id, dispatchRider);
    setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
    setSelectedRequestId(request.id);
    await refreshScopedData(currentUser.id);
    if (currentUser.role === 'hospital') {
      const { user } = await api.getUser(currentUser.id);
      setCurrentUser(user);
    }
  }

  async function handleRequestRider(requestId: string) {
    const { request } = await api.requestRiderForDonor(requestId);
    setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
  }

  async function handleAcceptRide(requestId: string) {
    if (!currentUser) return;
    const { request } = await api.acceptRide(requestId, currentUser.id);
    setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
    setSelectedRequestId(request.id);
    await refreshScopedData(currentUser.id);
  }

  async function handlePickupBlood(requestId: string) {
    if (!currentUser) return;
    const { request } = await api.pickupBlood(requestId, currentUser.id);
    setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
  }

  async function handleDeliverBlood(requestId: string) {
    if (!currentUser) return;
    const { request } = await api.deliverBlood(requestId, currentUser.id);
    setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
  }

  async function handleUpdateRiderLocation(requestId: string, lat: number, lng: number) {
    if (!currentUser) return;
    const { request } = await api.updateLocation(requestId, lat, lng, currentUser.id);
    setRequests((prev) => prev.map((r) => (r.id === request.id ? request : r)));
  }

  async function handleUpdateInventory(bloodType: BloodType, units: number) {
    if (!currentUser) return;
    const { hospital } = await api.updateInventory(currentUser.id, bloodType, units);
    setCurrentUser(hospital);
  }

  // --- TIKA CARE HANDLERS ---

  async function handleCreateTikaCampaign(payload: {
    title: string;
    vaccine_name: string;
    target_group: string;
    dose_schedule: string;
    total_slots: number;
    venue_name: string;
    venue_address: string;
    lat: number;
    lng: number;
    start_date: string;
    end_date: string;
    description: string;
    home_visit_available: boolean;
  }) {
    if (!currentUser) return;
    const { campaign } = await api.createTikaCampaign({
      gov_user_id: currentUser.id,
      ...payload,
    });
    setTikaCampaigns((prev) => (prev.some((c) => c.id === campaign.id) ? prev : [campaign, ...prev]));
  }

  async function handleUpdateTikaCampaignStatus(campaignId: string, status: TikaCampaignStatus) {
    if (!currentUser) return;
    const { campaign } = await api.updateTikaCampaignStatus(campaignId, currentUser.id, status);
    setTikaCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? campaign : c)));
  }

  async function handleCreateTikaRegistration(payload: {
    campaign_id: string;
    beneficiary_name: string;
    beneficiary_age: number;
    nid_or_brn: string;
    phone: string;
    dose_number: number;
    delivery_mode: 'camp' | 'home_visit';
    address: string;
    lat: number;
    lng: number;
    preferred_date: string;
    preferred_slot: string;
  }) {
    if (!currentUser) return;
    const { registration, campaign } = await api.createTikaRegistration({
      user_id: currentUser.id,
      ...payload,
    });
    setTikaRegistrations((prev) =>
      prev.some((r) => r.id === registration.id) ? prev : [registration, ...prev]
    );
    setTikaCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? campaign : c)));
  }

  async function handleUpdateTikaRegistrationStatus(
    regId: string,
    status: TikaRegistrationStatus
  ) {
    if (!currentUser) return;
    const { registration, campaign } = await api.updateTikaRegistrationStatus(
      regId,
      currentUser.id,
      status
    );
    setTikaRegistrations((prev) =>
      prev.map((r) => (r.id === registration.id ? registration : r))
    );
    setTikaCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? campaign : c)));
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const showMobileBottomBar = PRIMARY_TABS.includes(route) && !pickLocationMode;

  if (bootLoading) {
    return (
      <div className="h-dvh bg-[#F6F6F8] flex items-center justify-center">
        <div className="text-sm font-semibold text-neutral-600">Loading Blood Life...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  const isGov = currentUser.role === 'government';
  const roleActionRoute: AppRoute =
    isGov ? 'tika' : currentUser.role === 'needer' ? 'request' : 'queue';
  const roleActionLabel = isGov
    ? 'Tika Console'
    : currentUser.role === 'needer'
    ? 'Request Blood'
    : currentUser.role === 'hospital'
    ? 'Blood Bank'
    : currentUser.role === 'rider'
    ? 'Pickup Jobs'
    : 'Donor Radar';

  const sidebarItems: { id: AppRoute; label: string; icon: typeof Home; badge?: number }[] = isGov
    ? [
        { id: 'home', label: 'Home', icon: Home },
        { id: 'tika', label: 'Govt Tika Care', icon: Syringe },
        { id: 'map', label: 'Live Map', icon: Map },
        { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadCount },
        { id: 'profile', label: 'Profile', icon: User },
      ]
    : [
        { id: 'home', label: 'Home', icon: Home },
        { id: roleActionRoute, label: roleActionLabel, icon: HeartPulse },
        { id: 'tika', label: 'Govt Tika Care', icon: Syringe },
        { id: 'map', label: 'Live Map', icon: Map },
        { id: 'orders', label: 'Blood Orders', icon: PackageCheck },
        { id: 'chat', label: 'Messages', icon: MessageCircle },
        { id: 'notifications', label: 'Alerts', icon: Bell, badge: unreadCount },
        { id: 'profile', label: 'Profile', icon: User },
      ];

  return (
    <div className="h-dvh w-full bg-[#F6F6F8] text-[#141417] flex overflow-hidden">
      {/* DESKTOP NATIVE APP SIDE RAIL */}
      <aside
        aria-label="App navigation rail"
        className="hidden md:flex w-60 bg-white border-r border-neutral-200 flex-col justify-between p-4 shrink-0"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2 pt-1">
            <div className="w-9 h-9 rounded-xl bg-[#DC1423] text-white flex items-center justify-center shrink-0">
              <Droplet className="w-5 h-5 fill-white" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-lg tracking-tight text-[#141417] leading-none">
                Blood Life
              </div>
              <div className="text-[11px] font-semibold text-neutral-500 mt-1 truncate">
                {isGov ? 'GOVT TIKA CARE' : `${currentUser.role.toUpperCase()} · ${currentUser.blood_type}`}
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPickLocationMode(false);
                    setRoute(item.id);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-2 text-sm font-semibold transition-colors min-h-[44px] ${
                    active
                      ? 'bg-[#DC1423] text-white'
                      : 'text-neutral-600 hover:bg-[#F6F6F8] hover:text-[#141417]'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                        active ? 'bg-white text-[#DC1423]' : 'bg-[#DC1423] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-3.5 py-2.5 rounded-2xl bg-[#141417] hover:bg-neutral-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </aside>

      {/* REAL-TIME PUSH NOTIFICATION TOAST */}
      {toastAlert && (
        <div
          role="status"
          className="fixed top-4 right-4 z-50 max-w-sm bg-[#141417] text-white rounded-2xl p-4 shadow-xl border border-neutral-800 flex items-start gap-3"
        >
          <Bell className="w-5 h-5 text-[#FF4D5A] shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-xs">{toastAlert.title}</p>
            <p className="text-xs text-neutral-300 mt-1 leading-snug">{toastAlert.body}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastAlert(null)}
            className="text-xs text-neutral-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MAIN NATIVE PAGE VIEWPORT */}
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        <main
          className={`flex-1 ${
            route === 'map' || route === 'chat'
              ? 'overflow-hidden md:p-5'
              : 'overflow-y-auto md:p-6'
          } ${showMobileBottomBar ? 'pb-20 md:pb-6' : ''}`}
        >
          {route === 'home' && (
            <HomePage
              currentUser={currentUser}
              nearbyCounts={nearbyCounts}
              requests={requests}
              tikaCampaigns={tikaCampaigns}
              tikaRegistrations={tikaRegistrations}
              liveCoords={liveCoords}
              locationStatus={locationStatus}
              unreadCount={unreadCount}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRequestLocation={requestLocation}
              onNavigate={(r) => setRoute(r)}
              onSelectRequestAndMap={(reqId) => {
                setSelectedRequestId(reqId);
                setRoute('map');
              }}
              onToggleAvailability={handleToggleAvailability}
              onOpenAi={() => setAiModalOpen(true)}
            />
          )}

          {route === 'request' && (
            <RequestBloodPage
              currentUser={currentUser}
              liveCoords={liveCoords}
              pickedCoords={pickedCoords}
              onUseLiveLocation={handleUseLiveLocationForPick}
              onRequestMapPick={() => {
                setPickLocationTarget('request');
                setPickLocationMode(true);
                setRoute('map');
              }}
              onSubmitRequest={handleCreateRequest}
              onBack={() => setRoute('home')}
            />
          )}

          {route === 'tika' && (
            <TikaCarePage
              currentUser={currentUser}
              campaigns={tikaCampaigns}
              registrations={tikaRegistrations}
              liveCoords={liveCoords}
              pickedCoords={pickedCoords}
              onUseLiveLocation={handleUseLiveLocationForPick}
              onRequestMapPick={() => {
                setPickLocationTarget('tika');
                setPickLocationMode(true);
                setRoute('map');
              }}
              onCreateCampaign={handleCreateTikaCampaign}
              onUpdateCampaignStatus={handleUpdateTikaCampaignStatus}
              onCreateRegistration={handleCreateTikaRegistration}
              onUpdateRegistrationStatus={handleUpdateTikaRegistrationStatus}
              onViewOnMap={() => setRoute('map')}
              onBack={() => setRoute('home')}
            />
          )}

          {route === 'queue' && (
            <RoleQueuePage
              currentUser={currentUser}
              requests={requests}
              onBack={() => setRoute('home')}
              onSelectRequestAndMap={(reqId) => {
                setSelectedRequestId(reqId);
                setRoute('map');
              }}
              onOpenChat={(partnerId, requestId) => {
                setChatTarget({ partnerId, requestId });
                setRoute('chat');
              }}
              onToggleAvailability={handleToggleAvailability}
              onClaimRequest={handleClaimRequest}
              onRequestRider={handleRequestRider}
              onAcceptRide={handleAcceptRide}
              onPickupBlood={handlePickupBlood}
              onDeliverBlood={handleDeliverBlood}
              onUpdateRiderLocation={handleUpdateRiderLocation}
              onUpdateInventory={handleUpdateInventory}
            />
          )}

          {route === 'orders' && (
            <DirectoryPage
              currentUser={currentUser}
              requests={requests}
              onBack={() => setRoute('home')}
              onOpenChat={(partnerId, requestId) => {
                setChatTarget({ partnerId, requestId });
                setRoute('chat');
              }}
              onSelectRequestAndMap={(reqId) => {
                setSelectedRequestId(reqId);
                setRoute('map');
              }}
            />
          )}

          {route === 'map' && (
            <div className="h-full w-full md:rounded-3xl md:overflow-hidden md:border md:border-red-100 bg-white">
              <LiveMapPage
                currentUser={currentUser}
                providers={providers}
                nearbyCounts={nearbyCounts}
                requests={requests}
                tikaCampaigns={tikaCampaigns}
                liveCoords={liveCoords}
                locationStatus={locationStatus}
                locationError={locationError}
                onRequestLocation={requestLocation}
                selectedRequestId={selectedRequestId}
                pickLocationMode={pickLocationMode}
                pickedCoords={pickedCoords}
                onSelectRequest={(id) => setSelectedRequestId(id)}
                onMapPick={(lat, lng) => setPickedCoords({ lat, lng })}
                onConfirmMapPick={() => {
                  setPickLocationMode(false);
                  setRoute(pickLocationTarget);
                }}
                onOpenChat={(partnerId, requestId) => {
                  setChatTarget({ partnerId, requestId });
                  setRoute('chat');
                }}
                onDeliverBlood={handleDeliverBlood}
                onCancelRequest={handleCancelRequest}
                onUpdateRiderLocation={handleUpdateRiderLocation}
                onBack={() => {
                  if (pickLocationMode) {
                    setPickLocationMode(false);
                    setRoute(pickLocationTarget);
                  } else {
                    setRoute('home');
                  }
                }}
              />
            </div>
          )}

          {route === 'chat' && (
            <ChatView
              currentUser={currentUser}
              providers={providers}
              onlineUserIds={onlineUserIds}
              initialPartnerId={chatTarget?.partnerId}
              initialRequestId={chatTarget?.requestId}
              incomingMessages={incomingMessages}
              onBack={() => setRoute('home')}
            />
          )}

          {route === 'notifications' && (
            <NotificationsPage
              notifications={notifications}
              pushPermission={pushPermission}
              onRequestPushPermission={handleRequestPushPermission}
              onMarkAllRead={handleMarkNotificationsRead}
              onBack={() => setRoute('home')}
            />
          )}

          {route === 'profile' && (
            <div className="py-2 px-4 sm:px-0">
              <DonorProfileView
                user={currentUser}
                onToggleAvailability={handleToggleAvailability}
                onBack={() => setRoute('home')}
                onLogout={handleLogout}
              />
            </div>
          )}
        </main>

        {/* MOBILE FLOATING BOTTOM TAB BAR */}
        {showMobileBottomBar && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-3 h-16 flex items-center justify-around"
          >
            <button
              type="button"
              onClick={() => setRoute('home')}
              aria-label="Home"
              className={`h-11 px-4 rounded-full flex items-center gap-2 text-xs font-bold transition-colors ${
                route === 'home' ? 'bg-[#DC1423] text-white' : 'text-neutral-500'
              }`}
            >
              <Home className="w-4 h-4" />
              {route === 'home' && <span>Home</span>}
            </button>

            <button
              type="button"
              onClick={() => setRoute('tika')}
              aria-label="Tika Care"
              className={`h-11 px-4 rounded-full flex items-center gap-2 text-xs font-bold transition-colors ${
                route === 'tika' ? 'bg-[#DC1423] text-white' : 'text-neutral-500'
              }`}
            >
              <Syringe className="w-4 h-4" />
              {route === 'tika' && <span>Tika</span>}
            </button>

            <button
              type="button"
              onClick={() => setRoute('map')}
              aria-label="Map"
              className={`h-11 px-4 rounded-full flex items-center gap-2 text-xs font-bold transition-colors ${
                route === 'map' ? 'bg-[#DC1423] text-white' : 'text-neutral-500'
              }`}
            >
              <Map className="w-4 h-4" />
              {route === 'map' && <span>Map</span>}
            </button>

            <button
              type="button"
              onClick={() => setRoute('profile')}
              aria-label="Profile"
              className={`h-11 px-4 rounded-full flex items-center gap-2 text-xs font-bold transition-colors ${
                route === 'profile' ? 'bg-[#DC1423] text-white' : 'text-neutral-500'
              }`}
            >
              <User className="w-4 h-4" />
              {route === 'profile' && <span>Profile</span>}
            </button>
          </nav>
        )}

        <AiAssistantModal
          currentUser={currentUser}
          isOpen={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
        />
      </div>
    </div>
  );
}
