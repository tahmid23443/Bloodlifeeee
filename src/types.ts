export type UserRole = 'donor' | 'needer' | 'rider' | 'hospital' | 'government';

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type UrgencyLevel = 'critical' | 'urgent' | 'standard';

export type RequestStatus =
  | 'SEARCHING'
  | 'HOSPITAL_CONFIRMED'
  | 'DONOR_ACCEPTED'
  | 'AWAITING_RIDER'
  | 'RIDER_ASSIGNED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

export type TikaCampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type TikaRegistrationStatus = 'REGISTERED' | 'CONFIRMED' | 'VACCINATED' | 'CANCELLED';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  blood_type: BloodType;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  is_available: number;
  donations_count: number;
  requests_count: number;
  vehicle_type: string | null;
  hospital_name: string | null;
  nid?: string | null;
  created_at: string;
  inventory?: Record<BloodType, number>;
}

export interface BloodRequest {
  id: string;
  needer_id: string;
  needer_name?: string;
  needer_phone?: string;
  blood_type: BloodType;
  units: number;
  urgency: UrgencyLevel;
  status: RequestStatus;
  pickup_type: 'hospital' | 'donor' | null;
  provider_id: string | null;
  provider_name?: string | null;
  provider_phone?: string | null;
  rider_id: string | null;
  rider_name?: string | null;
  rider_phone?: string | null;
  rider_vehicle?: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  rider_lat: number | null;
  rider_lng: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface TikaCampaign {
  id: string;
  gov_user_id: string;
  gov_org_name?: string;
  title: string;
  vaccine_name: string;
  target_group: string;
  dose_schedule: string;
  total_slots: number;
  registered_count: number;
  vaccinated_count: number;
  venue_name: string;
  venue_address: string;
  lat: number;
  lng: number;
  start_date: string;
  end_date: string;
  description: string;
  home_visit_available: number;
  status: TikaCampaignStatus;
  created_at: string;
}

export interface TikaRegistration {
  id: string;
  campaign_id: string;
  campaign_title?: string;
  vaccine_name?: string;
  venue_name?: string;
  venue_address?: string;
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
  tika_card_code: string;
  status: TikaRegistrationStatus;
  administered_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  request_id: string | null;
  room_id: string;
  sender_id: string;
  sender_name?: string;
  sender_role?: UserRole;
  receiver_id: string;
  message: string;
  msg_type: 'text' | 'voice' | 'location';
  duration_sec: number;
  created_at: string;
}

export interface ChatThreadSummary {
  room_id: string;
  partner_id: string;
  partner_name: string;
  partner_role: UserRole;
  partner_blood_type: BloodType;
  partner_online: boolean;
  request_id: string | null;
  last_message: string;
  last_time: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: 'dispatch' | 'status' | 'chat' | 'rider' | 'tika';
  request_id: string | null;
  is_read: number;
  created_at: string;
}
