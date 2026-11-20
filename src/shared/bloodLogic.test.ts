import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionStatus,
  canTransitionTikaStatus,
  estimateMinutes,
  filterRequestsForUser,
  generateTikaCardCode,
  getAuthorizedChatPartnerIds,
  haversineKm,
  interpolateCoord,
  isBloodCompatible,
  makeDirectRoomId,
  rankNearbyProviders,
  rankTikaCampaigns,
} from './bloodLogic';
import type { BloodRequest, TikaCampaign, UserProfile } from '../types';

test('blood compatibility enforces RBC rules accurately', () => {
  assert.equal(isBloodCompatible('O-', 'AB+'), true);
  assert.equal(isBloodCompatible('O-', 'A-'), true);
  assert.equal(isBloodCompatible('A+', 'A+'), true);
  assert.equal(isBloodCompatible('A+', 'O+'), false);
  assert.equal(isBloodCompatible('B+', 'A+'), false);
  assert.equal(isBloodCompatible('AB+', 'A+'), false);
  assert.equal(isBloodCompatible('A-', 'AB+'), true);
});

test('haversineKm and estimateMinutes compute realistic urban distances', () => {
  const dist = haversineKm(23.7465, 90.376, 23.7529, 90.3816);
  assert.ok(dist > 0.7 && dist < 1.2, `Expected ~0.9km, got ${dist}`);
  assert.equal(estimateMinutes(0), 1);
  assert.equal(estimateMinutes(5, 30), 10);
});

test('rankNearbyProviders prioritizes exact matches and closer providers with stock', () => {
  const providers: UserProfile[] = [
    {
      id: 'h1',
      name: 'Far Hospital',
      email: 'h1@test.com',
      role: 'hospital',
      blood_type: 'O+',
      phone: '111',
      address: 'Banani',
      lat: 23.7937,
      lng: 90.4066,
      is_available: 1,
      donations_count: 0,
      requests_count: 0,
      vehicle_type: null,
      hospital_name: 'Far Hospital',
      created_at: '',
      inventory: { 'A+': 5, 'A-': 0, 'B+': 0, 'B-': 0, 'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0 },
    },
    {
      id: 'h2',
      name: 'Near Hospital',
      email: 'h2@test.com',
      role: 'hospital',
      blood_type: 'O+',
      phone: '222',
      address: 'Panthapath',
      lat: 23.7529,
      lng: 90.3816,
      is_available: 1,
      donations_count: 0,
      requests_count: 0,
      vehicle_type: null,
      hospital_name: 'Near Hospital',
      created_at: '',
      inventory: { 'A+': 3, 'A-': 0, 'B+': 0, 'B-': 0, 'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0 },
    },
    {
      id: 'd1',
      name: 'Donor Incompatible',
      email: 'd1@test.com',
      role: 'donor',
      blood_type: 'B+',
      phone: '333',
      address: 'Nearby',
      lat: 23.748,
      lng: 90.378,
      is_available: 1,
      donations_count: 2,
      requests_count: 0,
      vehicle_type: null,
      hospital_name: null,
      created_at: '',
    },
    {
      id: 'd2',
      name: 'Donor Exact',
      email: 'd2@test.com',
      role: 'donor',
      blood_type: 'A+',
      phone: '444',
      address: 'Kalabagan',
      lat: 23.7498,
      lng: 90.3821,
      is_available: 1,
      donations_count: 4,
      requests_count: 0,
      vehicle_type: null,
      hospital_name: null,
      created_at: '',
    },
  ];

  const ranked = rankNearbyProviders('A+', 2, 23.7465, 90.376, providers);
  assert.equal(ranked.hospitals.length, 2);
  assert.equal(ranked.hospitals[0].user.id, 'h2');
  assert.equal(ranked.donors.length, 1);
  assert.equal(ranked.donors[0].user.id, 'd2');
});

test('canTransitionStatus enforces role permissions across dispatch lifecycle', () => {
  assert.equal(canTransitionStatus('SEARCHING', 'AWAITING_RIDER', 'hospital'), true);
  assert.equal(canTransitionStatus('SEARCHING', 'AWAITING_RIDER', 'rider'), false);
  assert.equal(canTransitionStatus('AWAITING_RIDER', 'RIDER_ASSIGNED', 'rider'), true);
  assert.equal(canTransitionStatus('RIDER_ASSIGNED', 'IN_TRANSIT', 'rider'), true);
  assert.equal(canTransitionStatus('IN_TRANSIT', 'DELIVERED', 'rider'), true);
  assert.equal(canTransitionStatus('DELIVERED', 'SEARCHING', 'needer'), false);
});

test('interpolateCoord and makeDirectRoomId produce deterministic outputs', () => {
  const mid = interpolateCoord(23.7, 90.3, 23.8, 90.4, 0.5);
  assert.deepEqual(mid, { lat: 23.75, lng: 90.35 });
  assert.equal(makeDirectRoomId('u2', 'u1', 'r9'), makeDirectRoomId('u1', 'u2', 'r9'));
});

test('filterRequestsForUser and getAuthorizedChatPartnerIds enforce strict user privacy scoping', () => {
  const req1: BloodRequest = {
    id: 'r1',
    needer_id: 'n1',
    blood_type: 'A+',
    units: 1,
    urgency: 'critical',
    status: 'SEARCHING',
    pickup_type: null,
    provider_id: null,
    rider_id: null,
    pickup_address: null,
    pickup_lat: null,
    pickup_lng: null,
    dropoff_address: 'Dhanmondi',
    dropoff_lat: 23.7465,
    dropoff_lng: 90.376,
    rider_lat: null,
    rider_lng: null,
    notes: '',
    created_at: '',
    updated_at: '',
  };
  const req2: BloodRequest = {
    ...req1,
    id: 'r2',
    needer_id: 'n2',
    blood_type: 'B+',
    status: 'RIDER_ASSIGNED',
    provider_id: 'd_other',
    rider_id: 'ri_1',
  };

  const n1Visible = filterRequestsForUser(
    { id: 'n1', role: 'needer', blood_type: 'A+', lat: 23.7465, lng: 90.376, is_available: 1 },
    [req1, req2]
  );
  assert.deepEqual(n1Visible.map((r) => r.id), ['r1']);

  const donorVisible = filterRequestsForUser(
    { id: 'd_me', role: 'donor', blood_type: 'O-', lat: 23.75, lng: 90.38, is_available: 1 },
    [req1, req2]
  );
  assert.deepEqual(donorVisible.map((r) => r.id), ['r1']);

  assert.deepEqual(getAuthorizedChatPartnerIds('n1', [req1, req2]), []);
  assert.deepEqual(getAuthorizedChatPartnerIds('n2', [req1, req2]).sort(), ['d_other', 'ri_1']);
});

test('Government Tika Care status transitions, card code, and distance ranking work accurately', () => {
  assert.equal(canTransitionTikaStatus('REGISTERED', 'CONFIRMED', 'government'), true);
  assert.equal(canTransitionTikaStatus('REGISTERED', 'CONFIRMED', 'needer'), false);
  assert.equal(canTransitionTikaStatus('CONFIRMED', 'VACCINATED', 'government'), true);
  assert.equal(canTransitionTikaStatus('VACCINATED', 'CANCELLED', 'government'), false);

  const code = generateTikaCardCode('MR Vaccine', 'tikareg_12345ab');
  assert.equal(code, 'TIKA-MRVA-345AB');

  const cFar: TikaCampaign = {
    id: 'c1',
    gov_user_id: 'g1',
    title: 'Far Drive',
    vaccine_name: 'HPV',
    target_group: 'Adolescent Girls',
    dose_schedule: '2 doses',
    total_slots: 200,
    registered_count: 10,
    vaccinated_count: 4,
    venue_name: 'Banani EPI',
    venue_address: 'Banani',
    lat: 23.7937,
    lng: 90.4066,
    start_date: '2026-11-15',
    end_date: '2026-11-30',
    description: '',
    home_visit_available: 1,
    status: 'ACTIVE',
    created_at: '',
  };
  const cNear: TikaCampaign = {
    ...cFar,
    id: 'c2',
    title: 'Near Drive',
    lat: 23.748,
    lng: 90.378,
    status: 'ACTIVE',
  };
  const cPaused: TikaCampaign = { ...cNear, id: 'c3', status: 'PAUSED' };

  const ranked = rankTikaCampaigns([cFar, cPaused, cNear], 23.7465, 90.376);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].campaign.id, 'c2');
  assert.equal(ranked[0].remainingSlots, 190);
});

