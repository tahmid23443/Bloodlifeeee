import type {
  AppNotification,
  BloodRequest,
  BloodType,
  ChatMessage,
  ChatThreadSummary,
  TikaCampaign,
  TikaCampaignStatus,
  TikaRegistration,
  TikaRegistrationStatus,
  UrgencyLevel,
  UserProfile,
  UserRole,
} from '../types';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const rawText = await res.text();
  let data: Record<string, unknown> = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new Error(
        res.ok
          ? 'Invalid server response format.'
          : `API error (${res.status}): ${rawText.slice(0, 120)}`
      );
    }
  }
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' && data.error
        ? data.error
        : `Request failed (${res.status})`
    );
  }
  return data as T;
}

export interface NearbyCounts {
  donors: number;
  hospitals: number;
  riders: number;
}

export const api = {
  seedDemo: () => requestJson<{ ok: boolean }>('/api/demo/seed', { method: 'POST' }),
  consultAi: (prompt: string, context?: unknown) =>
    requestJson<{ answer: string }>('/api/ai/consult', {
      method: 'POST',
      body: JSON.stringify({ prompt, context }),
    }),
  signup: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    blood_type: BloodType;
    phone: string;
    address: string;
    lat?: number;
    lng?: number;
    vehicle_type?: string;
    hospital_name?: string;
  }) => requestJson<{ user: UserProfile }>('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),

  login: (email: string, password: string) =>
    requestJson<{ user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getUser: (id: string) => requestJson<{ user: UserProfile }>(`/api/users/${id}`),

  updateUser: (
    id: string,
    payload: Partial<Pick<UserProfile, 'is_available' | 'lat' | 'lng' | 'address' | 'blood_type'>>
  ) =>
    requestJson<{ user: UserProfile }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getProviders: (userId: string) =>
    requestJson<{ providers: UserProfile[]; nearbyCounts: NearbyCounts }>(
      `/api/providers?userId=${encodeURIComponent(userId)}`
    ),

  updateInventory: (hospitalId: string, blood_type: BloodType, units: number) =>
    requestJson<{ hospital: UserProfile }>(`/api/inventory/${hospitalId}`, {
      method: 'PUT',
      body: JSON.stringify({ blood_type, units }),
    }),

  getRequests: (userId: string) =>
    requestJson<{ requests: BloodRequest[] }>(`/api/requests?userId=${encodeURIComponent(userId)}`),

  createRequest: (payload: {
    needer_id: string;
    blood_type: BloodType;
    units: number;
    urgency: UrgencyLevel;
    dropoff_address: string;
    dropoff_lat: number;
    dropoff_lng: number;
    notes: string;
  }) =>
    requestJson<{ request: BloodRequest; matchedCount: number }>('/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  cancelRequest: (requestId: string, user_id: string) =>
    requestJson<{ request: BloodRequest }>(`/api/requests/${requestId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ user_id }),
    }),

  claimRequest: (requestId: string, provider_id: string, dispatch_rider = true) =>
    requestJson<{ request: BloodRequest }>(`/api/requests/${requestId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ provider_id, dispatch_rider }),
    }),

  requestRiderForDonor: (requestId: string) =>
    requestJson<{ request: BloodRequest }>(`/api/requests/${requestId}/request-rider`, {
      method: 'POST',
    }),

  acceptRide: (requestId: string, rider_id: string) =>
    requestJson<{ request: BloodRequest }>(`/api/requests/${requestId}/accept-ride`, {
      method: 'POST',
      body: JSON.stringify({ rider_id }),
    }),

  pickupBlood: (requestId: string, rider_id: string) =>
    requestJson<{ request: BloodRequest }>(`/api/requests/${requestId}/pickup`, {
      method: 'POST',
      body: JSON.stringify({ rider_id }),
    }),

  deliverBlood: (requestId: string, actor_id: string) =>
    requestJson<{ request: BloodRequest }>(`/api/requests/${requestId}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ actor_id }),
    }),

  updateLocation: (requestId: string, lat: number, lng: number, user_id?: string) =>
    requestJson<{ request: BloodRequest }>(`/api/requests/${requestId}/location`, {
      method: 'POST',
      body: JSON.stringify({ lat, lng, user_id }),
    }),

  getChatContacts: (userId: string) =>
    requestJson<{ contacts: UserProfile[] }>(`/api/chats/contacts/${userId}`),

  getChatThreads: (userId: string) =>
    requestJson<{ threads: ChatThreadSummary[] }>(`/api/chats/threads/${userId}`),

  getRoomMessages: (roomId: string) =>
    requestJson<{ messages: ChatMessage[] }>(`/api/chats/room/${roomId}`),

  sendMessage: (payload: {
    sender_id: string;
    receiver_id: string;
    request_id?: string | null;
    message: string;
    msg_type?: 'text' | 'voice' | 'location';
    duration_sec?: number;
  }) =>
    requestJson<{ message: ChatMessage; room_id: string }>('/api/chats/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getNotifications: (userId: string) =>
    requestJson<{ notifications: AppNotification[] }>(`/api/notifications/${userId}`),

  markNotificationsRead: (userId: string) =>
    requestJson<{ ok: boolean }>(`/api/notifications/${userId}/read`, { method: 'POST' }),

  // --- GOVERNMENT TIKA CARE ---

  getTikaCampaigns: (userId: string) =>
    requestJson<{ campaigns: TikaCampaign[] }>(
      `/api/tika/campaigns?userId=${encodeURIComponent(userId)}`
    ),

  createTikaCampaign: (payload: {
    gov_user_id: string;
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
  }) =>
    requestJson<{ campaign: TikaCampaign }>('/api/tika/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTikaCampaignStatus: (campaignId: string, gov_user_id: string, status: TikaCampaignStatus) =>
    requestJson<{ campaign: TikaCampaign }>(`/api/tika/campaigns/${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify({ gov_user_id, status }),
    }),

  getTikaRegistrations: (userId: string) =>
    requestJson<{ registrations: TikaRegistration[] }>(
      `/api/tika/registrations?userId=${encodeURIComponent(userId)}`
    ),

  createTikaRegistration: (payload: {
    campaign_id: string;
    user_id: string;
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
  }) =>
    requestJson<{ registration: TikaRegistration; campaign: TikaCampaign }>('/api/tika/registrations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTikaRegistrationStatus: (
    regId: string,
    actor_id: string,
    status: TikaRegistrationStatus
  ) =>
    requestJson<{ registration: TikaRegistration; campaign: TikaCampaign }>(
      `/api/tika/registrations/${regId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ actor_id, status }),
      }
    ),
};

export function triggerBrowserPush(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        tag: `bloodlife-${Date.now()}`,
      });
    } catch {
      // ignore in restricted environments
    }
  }
}
