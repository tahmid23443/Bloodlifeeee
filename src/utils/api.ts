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

const STORAGE_PREFIX = 'bloodlife_demo_';

const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'user_donor_1',
    name: 'Tanvir Ahmed',
    email: 'donor@bloodlife.demo',
    role: 'donor',
    blood_type: 'A+',
    phone: '+880 1712-345678',
    address: 'Dhanmondi 27, Dhaka',
    lat: 23.7465,
    lng: 90.3760,
    is_available: 1,
    donations_count: 5,
    requests_count: 0,
    vehicle_type: null,
    hospital_name: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'user_hospital_1',
    name: 'Dhaka Medical Emergency Bank',
    email: 'hospital@bloodlife.demo',
    role: 'hospital',
    blood_type: 'O+',
    phone: '+880 2 9661301',
    address: 'Secretariat Road, Dhaka',
    lat: 23.7250,
    lng: 90.3950,
    is_available: 1,
    donations_count: 120,
    requests_count: 4,
    vehicle_type: null,
    hospital_name: 'Dhaka Medical College Hospital',
    created_at: new Date().toISOString(),
    inventory: {
      'A+': 15,
      'A-': 4,
      'B+': 22,
      'B-': 3,
      'AB+': 8,
      'AB-': 2,
      'O+': 30,
      'O-': 5,
    },
  },
  {
    id: 'user_rider_1',
    name: 'Rahim Mia',
    email: 'rider@bloodlife.demo',
    role: 'rider',
    blood_type: 'B+',
    phone: '+880 1811-987654',
    address: 'Farmgate, Dhaka',
    lat: 23.7580,
    lng: 90.3890,
    is_available: 1,
    donations_count: 2,
    requests_count: 0,
    vehicle_type: 'Emergency Hero Motorcycle',
    hospital_name: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'user_gov_1',
    name: 'Directorate General of Health Services',
    email: 'gov@bloodlife.demo',
    role: 'government',
    blood_type: 'O+',
    phone: '+880 2 8811223',
    address: 'Mohakhali Health Directorate, Dhaka',
    lat: 23.7805,
    lng: 90.4030,
    is_available: 1,
    donations_count: 0,
    requests_count: 0,
    vehicle_type: null,
    hospital_name: 'Govt Tika Care Division',
    created_at: new Date().toISOString(),
  },
  {
    id: 'user_needer_1',
    name: 'Sadia Sultana',
    email: 'needer@bloodlife.demo',
    role: 'needer',
    blood_type: 'A-',
    phone: '+880 1919-555444',
    address: 'Gulshan 2, Dhaka',
    lat: 23.7925,
    lng: 90.4078,
    is_available: 1,
    donations_count: 0,
    requests_count: 2,
    vehicle_type: null,
    hospital_name: null,
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_REQUESTS: BloodRequest[] = [
  {
    id: 'req_101',
    needer_id: 'user_needer_1',
    needer_name: 'Sadia Sultana',
    needer_phone: '+880 1919-555444',
    blood_type: 'A-',
    units: 2,
    urgency: 'critical',
    status: 'SEARCHING',
    pickup_type: null,
    provider_id: null,
    provider_name: null,
    provider_phone: null,
    rider_id: null,
    rider_name: null,
    rider_phone: null,
    rider_vehicle: null,
    pickup_address: null,
    pickup_lat: null,
    pickup_lng: null,
    dropoff_address: 'United Hospital, Gulshan, Dhaka',
    dropoff_lat: 23.7930,
    dropoff_lng: 90.4150,
    rider_lat: null,
    rider_lng: null,
    notes: 'Urgent surgery required for accident trauma patient.',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: 'req_102',
    needer_id: 'user_needer_1',
    needer_name: 'Sadia Sultana',
    needer_phone: '+880 1919-555444',
    blood_type: 'O+',
    units: 1,
    urgency: 'urgent',
    status: 'HOSPITAL_CONFIRMED',
    pickup_type: 'hospital',
    provider_id: 'user_hospital_1',
    provider_name: 'Dhaka Medical Emergency Bank',
    provider_phone: '+880 2 9661301',
    rider_id: null,
    rider_name: null,
    rider_phone: null,
    rider_vehicle: null,
    pickup_address: 'Secretariat Road, Dhaka',
    pickup_lat: 23.7250,
    pickup_lng: 90.3950,
    dropoff_address: 'Square Hospital, Panthapath',
    dropoff_lat: 23.7530,
    dropoff_lng: 90.3830,
    rider_lat: null,
    rider_lng: null,
    notes: 'Post-operative care support.',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

const DEFAULT_CAMPAIGNS: TikaCampaign[] = [
  {
    id: 'tika_camp_1',
    gov_user_id: 'user_gov_1',
    gov_org_name: 'DGHS Bangladesh',
    title: 'National Emergency Hep-B & Booster Camp',
    vaccine_name: 'Recombinant Hepatitis-B / Booster',
    target_group: 'All Citizens & First Responders',
    dose_schedule: 'Single Dose / Booster',
    total_slots: 250,
    registered_count: 84,
    vaccinated_count: 42,
    venue_name: 'Bangabandhu National Stadium Booth',
    venue_address: 'Gulistan, Dhaka',
    lat: 23.7230,
    lng: 90.4120,
    start_date: '2026-11-25',
    end_date: '2026-11-30',
    description: 'Government free public health vaccination drive with optional home visit for senior citizens.',
    home_visit_available: 1,
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

const DEFAULT_REGISTRATIONS: TikaRegistration[] = [
  {
    id: 'reg_201',
    campaign_id: 'tika_camp_1',
    campaign_title: 'National Emergency Hep-B & Booster Camp',
    vaccine_name: 'Recombinant Hepatitis-B / Booster',
    venue_name: 'Bangabandhu National Stadium Booth',
    venue_address: 'Gulistan, Dhaka',
    user_id: 'user_needer_1',
    beneficiary_name: 'Sadia Sultana',
    beneficiary_age: 28,
    nid_or_brn: '199856789012345',
    phone: '+880 1919-555444',
    dose_number: 1,
    delivery_mode: 'camp',
    address: 'Gulshan 2, Dhaka',
    lat: 23.7925,
    lng: 90.4078,
    preferred_date: '2026-11-26',
    preferred_slot: '10:00 AM - 12:00 PM',
    tika_card_code: 'TK-8849-2026',
    status: 'CONFIRMED',
    administered_at: null,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_1',
    user_id: 'user_donor_1',
    title: 'Emergency Blood Radar Alert!',
    body: 'A critical A- blood request was posted near Dhanmondi. Your matching donor profile is active.',
    type: 'dispatch',
    request_id: 'req_101',
    is_read: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
];

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_1',
    request_id: 'req_101',
    room_id: 'room_needer_1_donor_1',
    sender_id: 'user_needer_1',
    sender_name: 'Sadia Sultana',
    sender_role: 'needer',
    receiver_id: 'user_donor_1',
    message: 'Hello Tanvir, can you check if you can donate 2 units urgently?',
    msg_type: 'text',
    duration_sec: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'msg_2',
    request_id: 'req_101',
    room_id: 'room_needer_1_donor_1',
    sender_id: 'user_donor_1',
    sender_name: 'Tanvir Ahmed',
    sender_role: 'donor',
    receiver_id: 'user_needer_1',
    message: 'Yes Sadia! I am available right now and ready to head to United Hospital.',
    msg_type: 'text',
    duration_sec: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
];

function loadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function getUsers(): UserProfile[] {
  return loadStorage('users', DEFAULT_USERS);
}
function setUsers(users: UserProfile[]) {
  saveStorage('users', users);
}

function getRequestsStorage(): BloodRequest[] {
  return loadStorage('requests', DEFAULT_REQUESTS);
}
function setRequestsStorage(requests: BloodRequest[]) {
  saveStorage('requests', requests);
}

function getCampaignsStorage(): TikaCampaign[] {
  return loadStorage('campaigns', DEFAULT_CAMPAIGNS);
}
function setCampaignsStorage(campaigns: TikaCampaign[]) {
  saveStorage('campaigns', campaigns);
}

function getRegistrationsStorage(): TikaRegistration[] {
  return loadStorage('registrations', DEFAULT_REGISTRATIONS);
}
function setRegistrationsStorage(registrations: TikaRegistration[]) {
  saveStorage('registrations', registrations);
}

function getNotificationsStorage(): AppNotification[] {
  return loadStorage('notifications', DEFAULT_NOTIFICATIONS);
}
function setNotificationsStorage(notifications: AppNotification[]) {
  saveStorage('notifications', notifications);
}

function getMessagesStorage(): ChatMessage[] {
  return loadStorage('messages', DEFAULT_MESSAGES);
}
function setMessagesStorage(messages: ChatMessage[]) {
  saveStorage('messages', messages);
}

async function simulateDelay(ms = 80) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface NearbyCounts {
  donors: number;
  hospitals: number;
  riders: number;
}

export const api = {
  seedDemo: async () => {
    await simulateDelay();
    saveStorage('users', DEFAULT_USERS);
    saveStorage('requests', DEFAULT_REQUESTS);
    saveStorage('campaigns', DEFAULT_CAMPAIGNS);
    saveStorage('registrations', DEFAULT_REGISTRATIONS);
    saveStorage('notifications', DEFAULT_NOTIFICATIONS);
    saveStorage('messages', DEFAULT_MESSAGES);
    return { ok: true };
  },

  consultAi: async (prompt: string, context?: unknown) => {
    await simulateDelay(250);
    const p = prompt.toLowerCase();
    let answer = `As your Blood Life AI Health & Tika Assistant, I am here to help. `;
    if (p.includes('o+') || p.includes('blood') || p.includes('stock') || p.includes('find')) {
      answer += `For blood type stock inquiries, Dhaka Medical Emergency Bank and Square Hospital currently have active inventories. You can check the Live Map or request emergency units directly through the Request Blood console.`;
    } else if (p.includes('tika') || p.includes('vaccin') || p.includes('boost')) {
      answer += `Government Tika Care is active! You can browse the National Hep-B & Booster campaign in the Tika Care console, select your nearest booth or request a home visit for elderly family members, and instantly receive your verified Tika pass.`;
    } else if (p.includes('safe') || p.includes('donor') || p.includes('guideline')) {
      answer += `Safe blood donation guidelines: Ensure you are well hydrated, rested, between 18-60 years old, weight above 50kg, and free from transmissible infections. Your donation saves up to 3 lives!`;
    } else {
      answer += `That is a great question. In Bangladesh, emergency blood dispatch and Tika Care coordinate in real-time across hospitals, donors, and government health workers. Let me know if you need help requesting blood or booking a vaccination slot!`;
    }
    return { answer, context };
  },

  signup: async (payload: {
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
    nid?: string;
  }) => {
    await simulateDelay();
    const users = getUsers();
    const existing = users.find((u) => u.email.toLowerCase() === payload.email.toLowerCase());
    if (existing) {
      throw new Error('An account with this email already exists.');
    }
    const newUser: UserProfile = {
      id: `user_${Date.now()}`,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      blood_type: payload.blood_type,
      phone: payload.phone,
      address: payload.address,
      lat: payload.lat ?? 23.7465,
      lng: payload.lng ?? 90.3760,
      is_available: 1,
      donations_count: 0,
      requests_count: 0,
      vehicle_type: payload.vehicle_type || null,
      hospital_name: payload.hospital_name || null,
      nid: payload.nid || null,
      created_at: new Date().toISOString(),
      ...(payload.role === 'hospital'
        ? {
            inventory: {
              'A+': 10,
              'A-': 2,
              'B+': 12,
              'B-': 1,
              'AB+': 5,
              'AB-': 1,
              'O+': 15,
              'O-': 3,
            },
          }
        : {}),
    };
    users.push(newUser);
    setUsers(users);
    return { user: newUser };
  },

  login: async (email: string, _password?: string) => {
    await simulateDelay();
    const users = getUsers();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      const fallbackUser: UserProfile = {
        id: `user_${Date.now()}`,
        name: email.split('@')[0] || 'Demo User',
        email,
        role: 'donor',
        blood_type: 'O+',
        phone: '+880 1700-000000',
        address: 'Dhaka, Bangladesh',
        lat: 23.7465,
        lng: 90.3760,
        is_available: 1,
        donations_count: 1,
        requests_count: 0,
        vehicle_type: null,
        hospital_name: null,
        created_at: new Date().toISOString(),
      };
      users.push(fallbackUser);
      setUsers(users);
      return { user: fallbackUser };
    }
    return { user };
  },

  getUser: async (id: string) => {
    await simulateDelay(30);
    const users = getUsers();
    const user = users.find((u) => u.id === id) || users[0];
    return { user };
  },

  updateUser: async (
    id: string,
    payload: Partial<Pick<UserProfile, 'is_available' | 'lat' | 'lng' | 'address' | 'blood_type'>>
  ) => {
    await simulateDelay();
    const users = getUsers();
    let updated: UserProfile | null = null;
    const nextUsers = users.map((u) => {
      if (u.id === id) {
        updated = { ...u, ...payload };
        return updated;
      }
      return u;
    });
    setUsers(nextUsers);
    return { user: updated || users[0] };
  },

  getProviders: async (userId: string) => {
    await simulateDelay(40);
    const users = getUsers();
    const providers = users.filter((u) => u.id !== userId);
    const nearbyCounts: NearbyCounts = {
      donors: providers.filter((p) => p.role === 'donor').length,
      hospitals: providers.filter((p) => p.role === 'hospital').length,
      riders: providers.filter((p) => p.role === 'rider').length,
    };
    return { providers, nearbyCounts };
  },

  updateInventory: async (hospitalId: string, blood_type: BloodType, units: number) => {
    await simulateDelay();
    const users = getUsers();
    let hospital: UserProfile | null = null;
    const nextUsers = users.map((u) => {
      if (u.id === hospitalId) {
        const inv = u.inventory || {
          'A+': 0,
          'A-': 0,
          'B+': 0,
          'B-': 0,
          'AB+': 0,
          'AB-': 0,
          'O+': 0,
          'O-': 0,
        };
        inv[blood_type] = Math.max(0, units);
        hospital = { ...u, inventory: inv };
        return hospital;
      }
      return u;
    });
    setUsers(nextUsers);
    return { hospital: hospital || users[0] };
  },

  getRequests: async (_userId?: string) => {
    await simulateDelay(40);
    const requests = getRequestsStorage();
    return { requests };
  },

  createRequest: async (payload: {
    needer_id: string;
    blood_type: BloodType;
    units: number;
    urgency: UrgencyLevel;
    dropoff_address: string;
    dropoff_lat: number;
    dropoff_lng: number;
    notes: string;
  }) => {
    await simulateDelay();
    const users = getUsers();
    const needer = users.find((u) => u.id === payload.needer_id);
    const requests = getRequestsStorage();
    const newReq: BloodRequest = {
      id: `req_${Date.now()}`,
      needer_id: payload.needer_id,
      needer_name: needer?.name || 'Needer',
      needer_phone: needer?.phone || '+880 1700-000000',
      blood_type: payload.blood_type,
      units: payload.units,
      urgency: payload.urgency,
      status: 'SEARCHING',
      pickup_type: null,
      provider_id: null,
      provider_name: null,
      provider_phone: null,
      rider_id: null,
      rider_name: null,
      rider_phone: null,
      rider_vehicle: null,
      pickup_address: null,
      pickup_lat: null,
      pickup_lng: null,
      dropoff_address: payload.dropoff_address,
      dropoff_lat: payload.dropoff_lat,
      dropoff_lng: payload.dropoff_lng,
      rider_lat: null,
      rider_lng: null,
      notes: payload.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    requests.unshift(newReq);
    setRequestsStorage(requests);

    const notifications = getNotificationsStorage();
    notifications.unshift({
      id: `notif_${Date.now()}`,
      user_id: payload.needer_id,
      title: 'Blood Request Broadcasted',
      body: `Your request for ${payload.units} unit(s) of ${payload.blood_type} blood has been broadcasted.`,
      type: 'dispatch',
      request_id: newReq.id,
      is_read: 0,
      created_at: new Date().toISOString(),
    });
    setNotificationsStorage(notifications);

    return { request: newReq, matchedCount: 3 };
  },

  cancelRequest: async (requestId: string, _user_id?: string) => {
    await simulateDelay();
    const requests = getRequestsStorage();
    let target: BloodRequest | null = null;
    const next = requests.map((r) => {
      if (r.id === requestId) {
        target = { ...r, status: 'CANCELLED', updated_at: new Date().toISOString() };
        return target;
      }
      return r;
    });
    setRequestsStorage(next);
    return { request: target || requests[0] };
  },

  claimRequest: async (requestId: string, provider_id: string, dispatch_rider = true) => {
    await simulateDelay();
    const users = getUsers();
    const provider = users.find((u) => u.id === provider_id);
    const requests = getRequestsStorage();
    let target: BloodRequest | null = null;
    const next = requests.map((r) => {
      if (r.id === requestId) {
        target = {
          ...r,
          status: dispatch_rider ? 'RIDER_ASSIGNED' : 'HOSPITAL_CONFIRMED',
          pickup_type: provider?.role === 'hospital' ? 'hospital' : 'donor',
          provider_id,
          provider_name: provider?.name || 'Provider',
          provider_phone: provider?.phone || '+880 1700-000000',
          pickup_address: provider?.address || 'Dhaka',
          pickup_lat: provider?.lat || 23.7465,
          pickup_lng: provider?.lng || 90.3760,
          updated_at: new Date().toISOString(),
        };
        return target;
      }
      return r;
    });
    setRequestsStorage(next);
    return { request: target || requests[0] };
  },

  requestRiderForDonor: async (requestId: string) => {
    await simulateDelay();
    const requests = getRequestsStorage();
    let target: BloodRequest | null = null;
    const next = requests.map((r) => {
      if (r.id === requestId) {
        target = { ...r, status: 'AWAITING_RIDER', updated_at: new Date().toISOString() };
        return target;
      }
      return r;
    });
    setRequestsStorage(next);
    return { request: target || requests[0] };
  },

  acceptRide: async (requestId: string, rider_id: string) => {
    await simulateDelay();
    const users = getUsers();
    const rider = users.find((u) => u.id === rider_id);
    const requests = getRequestsStorage();
    let target: BloodRequest | null = null;
    const next = requests.map((r) => {
      if (r.id === requestId) {
        target = {
          ...r,
          status: 'RIDER_ASSIGNED',
          rider_id,
          rider_name: rider?.name || 'Rider',
          rider_phone: rider?.phone || '+880 1811-987654',
          rider_vehicle: rider?.vehicle_type || 'Emergency Bike',
          rider_lat: rider?.lat || 23.7580,
          rider_lng: rider?.lng || 90.3890,
          updated_at: new Date().toISOString(),
        };
        return target;
      }
      return r;
    });
    setRequestsStorage(next);
    return { request: target || requests[0] };
  },

  pickupBlood: async (requestId: string, _actor_id?: string) => {
    await simulateDelay();
    const requests = getRequestsStorage();
    let target: BloodRequest | null = null;
    const next = requests.map((r) => {
      if (r.id === requestId) {
        target = { ...r, status: 'IN_TRANSIT', updated_at: new Date().toISOString() };
        return target;
      }
      return r;
    });
    setRequestsStorage(next);
    return { request: target || requests[0] };
  },

  deliverBlood: async (requestId: string, _actor_id?: string) => {
    await simulateDelay();
    const requests = getRequestsStorage();
    let target: BloodRequest | null = null;
    const next = requests.map((r) => {
      if (r.id === requestId) {
        target = { ...r, status: 'DELIVERED', updated_at: new Date().toISOString() };
        return target;
      }
      return r;
    });
    setRequestsStorage(next);
    return { request: target || requests[0] };
  },

  updateLocation: async (requestId: string, lat: number, lng: number, _user_id?: string) => {
    await simulateDelay(20);
    const requests = getRequestsStorage();
    let target: BloodRequest | null = null;
    const next = requests.map((r) => {
      if (r.id === requestId) {
        target = { ...r, rider_lat: lat, rider_lng: lng, updated_at: new Date().toISOString() };
        return target;
      }
      return r;
    });
    setRequestsStorage(next);
    return { request: target || requests[0] };
  },

  getChatContacts: async (userId: string) => {
    await simulateDelay(30);
    const users = getUsers();
    const contacts = users.filter((u) => u.id !== userId);
    return { contacts };
  },

  getChatThreads: async (userId?: string) => {
    await simulateDelay(30);
    const users = getUsers();
    const messages = getMessagesStorage();
    const currentId = userId || users[0].id;
    const contacts = users.filter((u) => u.id !== currentId);
    const threads: ChatThreadSummary[] = contacts.map((c) => {
      const roomMsgs = messages.filter(
        (m) =>
          (m.sender_id === currentId && m.receiver_id === c.id) ||
          (m.sender_id === c.id && m.receiver_id === currentId)
      );
      const last = roomMsgs[roomMsgs.length - 1];
      return {
        room_id: `room_${Math.min(currentId.charCodeAt(0), c.id.charCodeAt(0))}_${c.id}`,
        partner_id: c.id,
        partner_name: c.name,
        partner_role: c.role,
        partner_blood_type: c.blood_type,
        partner_online: true,
        request_id: last?.request_id || null,
        last_message: last?.message || 'Start a conversation...',
        last_time: last?.created_at ? new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      };
    });
    return { threads };
  },

  getRoomMessages: async (_roomId?: string) => {
    await simulateDelay(30);
    const messages = getMessagesStorage();
    return { messages };
  },

  sendMessage: async (payload: {
    sender_id: string;
    receiver_id: string;
    request_id?: string | null;
    message: string;
    msg_type?: 'text' | 'voice' | 'location';
    duration_sec?: number;
  }) => {
    await simulateDelay();
    const users = getUsers();
    const sender = users.find((u) => u.id === payload.sender_id);
    const messages = getMessagesStorage();
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      request_id: payload.request_id || null,
      room_id: `room_${payload.sender_id}_${payload.receiver_id}`,
      sender_id: payload.sender_id,
      sender_name: sender?.name || 'User',
      sender_role: sender?.role || 'donor',
      receiver_id: payload.receiver_id,
      message: payload.message,
      msg_type: payload.msg_type || 'text',
      duration_sec: payload.duration_sec || 0,
      created_at: new Date().toISOString(),
    };
    messages.push(newMsg);
    setMessagesStorage(messages);
    return { message: newMsg, room_id: newMsg.room_id };
  },

  getNotifications: async (_userId?: string) => {
    await simulateDelay(30);
    const notifications = getNotificationsStorage();
    return { notifications };
  },

  markNotificationsRead: async (_userId?: string) => {
    await simulateDelay();
    const notifications = getNotificationsStorage().map((n) => ({ ...n, is_read: 1 }));
    setNotificationsStorage(notifications);
    return { ok: true };
  },

  // --- TIKA CARE ---

  getTikaCampaigns: async (_userId?: string) => {
    await simulateDelay(30);
    const campaigns = getCampaignsStorage();
    return { campaigns };
  },

  createTikaCampaign: async (payload: {
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
  }) => {
    await simulateDelay();
    const campaigns = getCampaignsStorage();
    const newCamp: TikaCampaign = {
      id: `tika_camp_${Date.now()}`,
      gov_user_id: payload.gov_user_id,
      gov_org_name: 'DGHS Bangladesh',
      title: payload.title,
      vaccine_name: payload.vaccine_name,
      target_group: payload.target_group,
      dose_schedule: payload.dose_schedule,
      total_slots: payload.total_slots,
      registered_count: 0,
      vaccinated_count: 0,
      venue_name: payload.venue_name,
      venue_address: payload.venue_address,
      lat: payload.lat,
      lng: payload.lng,
      start_date: payload.start_date,
      end_date: payload.end_date,
      description: payload.description,
      home_visit_available: payload.home_visit_available ? 1 : 0,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };
    campaigns.unshift(newCamp);
    setCampaignsStorage(campaigns);
    return { campaign: newCamp };
  },

  updateTikaCampaignStatus: async (campaignId: string, _gov_id: string, status: TikaCampaignStatus) => {
    await simulateDelay();
    const campaigns = getCampaignsStorage();
    let updated: TikaCampaign | null = null;
    const next = campaigns.map((c) => {
      if (c.id === campaignId) {
        updated = { ...c, status };
        return updated;
      }
      return c;
    });
    setCampaignsStorage(next);
    return { campaign: updated || campaigns[0] };
  },

  getTikaRegistrations: async (_userId?: string) => {
    await simulateDelay(30);
    const registrations = getRegistrationsStorage();
    return { registrations };
  },

  createTikaRegistration: async (payload: {
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
  }) => {
    await simulateDelay();
    const campaigns = getCampaignsStorage();
    const registrations = getRegistrationsStorage();
    const camp = campaigns.find((c) => c.id === payload.campaign_id);

    const newReg: TikaRegistration = {
      id: `reg_${Date.now()}`,
      campaign_id: payload.campaign_id,
      campaign_title: camp?.title || 'Vaccination Campaign',
      vaccine_name: camp?.vaccine_name || 'Vaccine',
      venue_name: camp?.venue_name || 'Booth',
      venue_address: camp?.venue_address || 'Address',
      user_id: payload.user_id,
      beneficiary_name: payload.beneficiary_name,
      beneficiary_age: payload.beneficiary_age,
      nid_or_brn: payload.nid_or_brn,
      phone: payload.phone,
      dose_number: payload.dose_number,
      delivery_mode: payload.delivery_mode,
      address: payload.address,
      lat: payload.lat,
      lng: payload.lng,
      preferred_date: payload.preferred_date,
      preferred_slot: payload.preferred_slot,
      tika_card_code: `TK-${Math.floor(1000 + Math.random() * 9000)}-2026`,
      status: 'CONFIRMED',
      administered_at: null,
      created_at: new Date().toISOString(),
    };
    registrations.unshift(newReg);
    setRegistrationsStorage(registrations);

    let updatedCamp = camp;
    if (camp) {
      updatedCamp = { ...camp, registered_count: camp.registered_count + 1 };
      setCampaignsStorage(campaigns.map((c) => (c.id === camp.id ? updatedCamp! : c)));
    }

    return { registration: newReg, campaign: updatedCamp || campaigns[0] };
  },

  updateTikaRegistrationStatus: async (regId: string, _actor_id: string, status: TikaRegistrationStatus) => {
    await simulateDelay();
    const registrations = getRegistrationsStorage();
    const campaigns = getCampaignsStorage();
    let updatedReg: TikaRegistration | null = null;

    const nextRegs = registrations.map((r) => {
      if (r.id === regId) {
        updatedReg = {
          ...r,
          status,
          administered_at: status === 'VACCINATED' ? new Date().toISOString() : r.administered_at,
        };
        return updatedReg;
      }
      return r;
    });
    setRegistrationsStorage(nextRegs);

    const camp = campaigns.find((c) => c.id === updatedReg?.campaign_id);
    let updatedCamp = camp;
    if (camp && status === 'VACCINATED') {
      updatedCamp = { ...camp, vaccinated_count: camp.vaccinated_count + 1 };
      setCampaignsStorage(campaigns.map((c) => (c.id === camp.id ? updatedCamp! : c)));
    }

    return { registration: updatedReg || registrations[0], campaign: updatedCamp || campaigns[0] };
  },
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
      // ignore
    }
  }
}
