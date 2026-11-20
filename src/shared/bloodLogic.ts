import type {
  BloodRequest,
  BloodType,
  RequestStatus,
  TikaCampaign,
  TikaRegistrationStatus,
  UserProfile,
  UserRole,
} from '../types';

export const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/**
 * Red blood cell (RBC) donor -> recipient compatibility matrix.
 * Key = Donor Blood Type, Value = Recipient Blood Types that can safely receive it.
 */
const COMPATIBILITY_MAP: Record<BloodType, BloodType[]> = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

export function isBloodCompatible(donorGroup: BloodType, neededGroup: BloodType): boolean {
  const recipients = COMPATIBILITY_MAP[donorGroup];
  if (!recipients) return false;
  return recipients.includes(neededGroup);
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export function estimateMinutes(distanceKm: number, speedKmh = 28): number {
  if (distanceKm <= 0) return 1;
  return Math.max(2, Math.round((distanceKm / speedKmh) * 60));
}

export interface RankedProvider {
  user: UserProfile;
  distanceKm: number;
  etaMinutes: number;
  exactMatch: boolean;
  availableUnits: number;
}

export function rankNearbyProviders(
  neededBlood: BloodType,
  unitsNeeded: number,
  targetLat: number,
  targetLng: number,
  providers: UserProfile[],
  maxRadiusKm = 35
): { hospitals: RankedProvider[]; donors: RankedProvider[] } {
  const hospitals: RankedProvider[] = [];
  const donors: RankedProvider[] = [];

  for (const user of providers) {
    if (!user.is_available) continue;
    const distanceKm = haversineKm(targetLat, targetLng, user.lat, user.lng);
    if (distanceKm > maxRadiusKm) continue;

    if (user.role === 'hospital') {
      const inv = user.inventory || ({} as Record<BloodType, number>);
      const exactUnits = inv[neededBlood] ?? 0;
      let compatibleUnits = exactUnits;
      const exactMatch = exactUnits >= unitsNeeded;
      if (compatibleUnits < unitsNeeded) {
        for (const bt of BLOOD_TYPES) {
          if (isBloodCompatible(bt, neededBlood) && (inv[bt] ?? 0) > compatibleUnits) {
            compatibleUnits = inv[bt] ?? 0;
          }
        }
      }
      if (compatibleUnits > 0) {
        hospitals.push({
          user,
          distanceKm,
          etaMinutes: estimateMinutes(distanceKm),
          exactMatch,
          availableUnits: compatibleUnits,
        });
      }
    } else if (user.role === 'donor') {
      if (isBloodCompatible(user.blood_type, neededBlood)) {
        donors.push({
          user,
          distanceKm,
          etaMinutes: estimateMinutes(distanceKm, 22),
          exactMatch: user.blood_type === neededBlood,
          availableUnits: 1,
        });
      }
    }
  }

  const sortFn = (a: RankedProvider, b: RankedProvider) => {
    if (a.exactMatch !== b.exactMatch) return a.exactMatch ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  };

  hospitals.sort(sortFn);
  donors.sort(sortFn);
  return { hospitals, donors };
}

const VALID_TRANSITIONS: Record<RequestStatus, { next: RequestStatus; roles: UserRole[] }[]> = {
  SEARCHING: [
    { next: 'AWAITING_RIDER', roles: ['hospital', 'donor'] },
    { next: 'HOSPITAL_CONFIRMED', roles: ['hospital'] },
    { next: 'DONOR_ACCEPTED', roles: ['donor'] },
    { next: 'CANCELLED', roles: ['needer'] },
  ],
  HOSPITAL_CONFIRMED: [
    { next: 'AWAITING_RIDER', roles: ['hospital'] },
    { next: 'RIDER_ASSIGNED', roles: ['rider'] },
    { next: 'CANCELLED', roles: ['needer', 'hospital'] },
  ],
  DONOR_ACCEPTED: [
    { next: 'AWAITING_RIDER', roles: ['donor'] },
    { next: 'IN_TRANSIT', roles: ['donor'] },
    { next: 'DELIVERED', roles: ['donor', 'needer'] },
    { next: 'CANCELLED', roles: ['needer', 'donor'] },
  ],
  AWAITING_RIDER: [
    { next: 'RIDER_ASSIGNED', roles: ['rider'] },
    { next: 'CANCELLED', roles: ['needer', 'hospital'] },
  ],
  RIDER_ASSIGNED: [
    { next: 'IN_TRANSIT', roles: ['rider'] },
    { next: 'CANCELLED', roles: ['needer', 'hospital'] },
  ],
  IN_TRANSIT: [{ next: 'DELIVERED', roles: ['rider', 'needer'] }],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionStatus(
  current: RequestStatus,
  next: RequestStatus,
  actorRole: UserRole
): boolean {
  const allowed = VALID_TRANSITIONS[current] || [];
  return allowed.some((rule) => rule.next === next && rule.roles.includes(actorRole));
}

export function interpolateCoord(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  fraction: number
): { lat: number; lng: number } {
  const clamped = Math.max(0, Math.min(1, fraction));
  return {
    lat: Math.round((fromLat + (toLat - fromLat) * clamped) * 100000) / 100000,
    lng: Math.round((fromLng + (toLng - fromLng) * clamped) * 100000) / 100000,
  };
}

export function formatRequestStatusLabel(status: BloodRequest['status']): string {
  switch (status) {
    case 'SEARCHING':
      return 'Broadcasting Nearby';
    case 'HOSPITAL_CONFIRMED':
      return 'Hospital Confirmed';
    case 'DONOR_ACCEPTED':
      return 'Donor Matched';
    case 'AWAITING_RIDER':
      return 'Awaiting Courier Rider';
    case 'RIDER_ASSIGNED':
      return 'Rider En Route to Pickup';
    case 'IN_TRANSIT':
      return 'Blood In Transit';
    case 'DELIVERED':
      return 'Delivered Safely';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

export function makeDirectRoomId(userIdA: string, userIdB: string, requestId?: string | null): string {
  const sorted = [userIdA, userIdB].sort().join('__');
  return requestId ? `req_${requestId}_${sorted}` : `dm_${sorted}`;
}

export function filterRequestsForUser(
  user: Pick<UserProfile, 'id' | 'role' | 'blood_type' | 'lat' | 'lng' | 'is_available'>,
  requests: BloodRequest[],
  maxRadiusKm = 35
): BloodRequest[] {
  return requests.filter((r) => {
    if (user.role === 'needer') {
      return r.needer_id === user.id;
    }
    if (user.role === 'donor') {
      if (r.provider_id === user.id) return true;
      if (r.status === 'SEARCHING') {
        const dist = haversineKm(user.lat, user.lng, r.dropoff_lat, r.dropoff_lng);
        return dist <= maxRadiusKm && isBloodCompatible(user.blood_type, r.blood_type);
      }
      return false;
    }
    if (user.role === 'hospital') {
      if (r.provider_id === user.id) return true;
      if (r.status === 'SEARCHING') {
        const dist = haversineKm(user.lat, user.lng, r.dropoff_lat, r.dropoff_lng);
        return dist <= maxRadiusKm;
      }
      return false;
    }
    if (user.role === 'rider') {
      if (r.rider_id === user.id) return true;
      if (r.status === 'AWAITING_RIDER') {
        const refLat = r.pickup_lat ?? r.dropoff_lat;
        const refLng = r.pickup_lng ?? r.dropoff_lng;
        return haversineKm(user.lat, user.lng, refLat, refLng) <= maxRadiusKm;
      }
      return false;
    }
    return false;
  });
}

export function getAuthorizedChatPartnerIds(userId: string, requests: BloodRequest[]): string[] {
  const partnerIds = new Set<string>();
  for (const r of requests) {
    const participants = [r.needer_id, r.provider_id, r.rider_id].filter(
      (id): id is string => Boolean(id)
    );
    if (!participants.includes(userId)) continue;
    for (const p of participants) {
      if (p !== userId) partnerIds.add(p);
    }
  }
  return Array.from(partnerIds);
}

// --- GOVERNMENT TIKA CARE PURE LOGIC ---

const TIKA_TRANSITIONS: Record<
  TikaRegistrationStatus,
  { next: TikaRegistrationStatus; govOnly: boolean }[]
> = {
  REGISTERED: [
    { next: 'CONFIRMED', govOnly: true },
    { next: 'VACCINATED', govOnly: true },
    { next: 'CANCELLED', govOnly: false },
  ],
  CONFIRMED: [
    { next: 'VACCINATED', govOnly: true },
    { next: 'CANCELLED', govOnly: false },
  ],
  VACCINATED: [],
  CANCELLED: [],
};

export function canTransitionTikaStatus(
  current: TikaRegistrationStatus,
  next: TikaRegistrationStatus,
  actorRole: UserRole
): boolean {
  const rules = TIKA_TRANSITIONS[current] || [];
  return rules.some((rule) => rule.next === next && (!rule.govOnly || actorRole === 'government'));
}

export function generateTikaCardCode(vaccineName: string, regId: string): string {
  const prefix = vaccineName
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(2, 'X');
  const tail = regId
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(-5)
    .padStart(5, '0');
  return `TIKA-${prefix}-${tail}`;
}

export interface RankedTikaCampaign {
  campaign: TikaCampaign;
  distanceKm: number;
  remainingSlots: number;
}

export function rankTikaCampaigns(
  campaigns: TikaCampaign[],
  userLat: number,
  userLng: number
): RankedTikaCampaign[] {
  return campaigns
    .filter((c) => c.status === 'ACTIVE')
    .map((c) => ({
      campaign: c,
      distanceKm: haversineKm(userLat, userLng, c.lat, c.lng),
      remainingSlots: Math.max(0, c.total_slots - c.registered_count),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}


