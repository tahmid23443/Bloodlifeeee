import express, { type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { GoogleGenAI } from '@google/genai';
import {
  createNotification,
  db,
  getAllProviders,
  getAllUserNotifications,
  getEnrichedRequestById,
  getEnrichedRequests,
  getEnrichedTikaCampaignById,
  getEnrichedTikaCampaigns,
  getMessagesByRoom,
  getTikaRegistrationById,
  getTikaRegistrationsForGov,
  getTikaRegistrationsForUser,
  initDatabase,
  sanitizeUser,
  seedDemoDatabase,
} from './db';
import {
  BLOOD_TYPES,
  canTransitionStatus,
  canTransitionTikaStatus,
  filterRequestsForUser,
  generateTikaCardCode,
  getAuthorizedChatPartnerIds,
  haversineKm,
  makeDirectRoomId,
  rankNearbyProviders,
} from '../shared/bloodLogic';
import type {
  BloodRequest,
  BloodType,
  TikaCampaignStatus,
  TikaRegistrationStatus,
  UrgencyLevel,
  UserRole,
} from '../types';

export interface RealtimeHooks {
  broadcastAll: (event: string, payload: unknown) => void;
  sendToUser: (userId: string, event: string, payload: unknown) => void;
  sendToRequestParticipants: (reqObj: BloodRequest, event: string, payload: unknown) => void;
  getOnlineUserIds: () => Set<string>;
}

const NOOP_REALTIME: RealtimeHooks = {
  broadcastAll: () => {},
  sendToUser: () => {},
  sendToRequestParticipants: () => {},
  getOnlineUserIds: () => new Set<string>(),
};

let dbInitialized = false;
function ensureDb() {
  if (!dbInitialized) {
    initDatabase();
    dbInitialized = true;
  }
}

export function createApiApp(realtime: RealtimeHooks = NOOP_REALTIME) {
  ensureDb();

  const { broadcastAll, sendToUser, sendToRequestParticipants, getOnlineUserIds } = realtime;
  const app = express();
  app.use(express.json());

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-server',
    });
  });

  // Demo seed endpoint
  app.post('/api/demo/seed', (_req, res) => {
    try {
      seedDemoDatabase();
      res.json({ ok: true, message: 'Demo database seeded successfully.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to seed demo data' });
    }
  });

  // AI Health & Dispatch Consultant (gemini-4-hydrogen)
  app.post('/api/ai/consult', async (req, res) => {
    try {
      const { prompt, context } = req.body || {};
      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required.' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are "Blood Life AI", an expert emergency blood dispatch and immunization health assistant for the Blood Life platform in Bangladesh. You help blood needers find stock, donors connect with requests, riders navigate securely, and citizens understand Government Tika Care immunization schedules. Keep answers concise, helpful, and empathetic. Context: ${JSON.stringify(context || {})}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: String(prompt),
        config: {
          systemInstruction,
        },
      });

      res.json({ answer: response.text || 'No response generated.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI consultation failed' });
    }
  });

  // --- AUTH ROUTES (Real Sign-Up & Sign-In Only) ---

  app.post('/api/auth/signup', (req, res) => {
    const {
      name,
      email,
      password,
      role,
      blood_type,
      phone,
      address,
      lat,
      lng,
      vehicle_type,
      hospital_name,
    } = req.body || {};

    if (!name || !email || !password || !role || !blood_type) {
      res.status(400).json({ error: 'Name, email, password, role, and blood type are required.' });
      return;
    }

    const validRoles: UserRole[] = ['donor', 'needer', 'rider', 'hospital', 'government'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role selected.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const passwordHash = bcrypt.hashSync(String(password), 8);
    const safeLat = typeof lat === 'number' ? lat : 23.7465 + (Math.random() - 0.5) * 0.02;
    const safeLng = typeof lng === 'number' ? lng : 90.376 + (Math.random() - 0.5) * 0.02;

    const tx = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO users (
          id, name, email, password_hash, role, blood_type, phone, address,
          lat, lng, is_available, donations_count, requests_count, vehicle_type, hospital_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?)
      `
      ).run(
        id,
        String(name).trim(),
        String(email).trim().toLowerCase(),
        passwordHash,
        role,
        blood_type,
        String(phone || '+880 1700-000000').trim(),
        String(address || 'Dhanmondi, Dhaka').trim(),
        safeLat,
        safeLng,
        role === 'rider' ? String(vehicle_type || 'Cold-Box Motorcycle') : null,
        role === 'hospital' || role === 'government' ? String(hospital_name || name).trim() : null
      );

      if (role === 'hospital') {
        const invInsert = db.prepare(
          'INSERT INTO hospital_inventory (hospital_id, blood_type, units) VALUES (?, ?, ?)'
        );
        for (const bt of BLOOD_TYPES) {
          invInsert.run(id, bt, bt === blood_type ? 5 : 2);
        }
      }
    });

    tx();

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>;
    const user = sanitizeUser(created);
    res.status(201).json({ user });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const row = db
      .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
      .get(String(email).trim()) as Record<string, unknown> | undefined;

    if (!row || !bcrypt.compareSync(String(password), String(row.password_hash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    res.json({ user: sanitizeUser(row) });
  });

  // --- PROFILE & PRIVACY-SCOPED PARTNERS ---

  app.get('/api/users/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: sanitizeUser(row) });
  });

  app.patch('/api/users/:id', (req, res) => {
    const { is_available, lat, lng, address, blood_type } = req.body || {};
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    db.prepare(
      `
      UPDATE users SET
        is_available = COALESCE(?, is_available),
        lat = COALESCE(?, lat),
        lng = COALESCE(?, lng),
        address = COALESCE(?, address),
        blood_type = COALESCE(?, blood_type)
      WHERE id = ?
    `
    ).run(
      typeof is_available === 'boolean' ? (is_available ? 1 : 0) : is_available ?? null,
      typeof lat === 'number' ? lat : null,
      typeof lng === 'number' ? lng : null,
      address ?? null,
      blood_type ?? null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<
      string,
      unknown
    >;
    const user = sanitizeUser(updated);
    sendToUser(user.id, 'provider:updated', user);
    res.json({ user });
  });

  app.get('/api/providers', (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;
    const all = getAllProviders();
    if (!userId) {
      res.json({ providers: [], nearbyCounts: { donors: 0, hospitals: 0, riders: 0 } });
      return;
    }

    const requester = all.find((u) => u.id === userId);
    if (!requester) {
      res.json({ providers: [], nearbyCounts: { donors: 0, hospitals: 0, riders: 0 } });
      return;
    }

    const allReqs = getEnrichedRequests();
    const partnerIds = new Set(getAuthorizedChatPartnerIds(userId, allReqs));
    partnerIds.add(userId);

    const visibleProviders = all.filter((u) => partnerIds.has(u.id));

    let donors = 0;
    let hospitals = 0;
    let riders = 0;
    for (const u of all) {
      if (u.id === userId || !u.is_available) continue;
      const dist = haversineKm(requester.lat, requester.lng, u.lat, u.lng);
      if (dist > 35) continue;
      if (u.role === 'donor') donors++;
      else if (u.role === 'hospital') hospitals++;
      else if (u.role === 'rider') riders++;
    }

    res.json({
      providers: visibleProviders,
      nearbyCounts: { donors, hospitals, riders },
    });
  });

  // --- HOSPITAL INVENTORY ---

  app.put('/api/inventory/:hospitalId', (req, res) => {
    const { blood_type, units } = req.body || {};
    if (!blood_type || typeof units !== 'number' || units < 0) {
      res.status(400).json({ error: 'Valid blood_type and non-negative units are required.' });
      return;
    }

    db.prepare(
      `
      INSERT INTO hospital_inventory (hospital_id, blood_type, units, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(hospital_id, blood_type)
      DO UPDATE SET units = excluded.units, updated_at = datetime('now')
    `
    ).run(req.params.hospitalId, blood_type, Math.floor(units));

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.hospitalId) as Record<
      string,
      unknown
    >;
    const hospital = sanitizeUser(row);
    sendToUser(hospital.id, 'provider:updated', hospital);
    res.json({ hospital });
  });

  // --- BLOOD DISPATCH REQUESTS (Strictly Privacy-Scoped) ---

  app.get('/api/requests', (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;
    if (!userId) {
      res.json({ requests: [] });
      return;
    }
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
      | Record<string, unknown>
      | undefined;
    if (!userRow) {
      res.json({ requests: [] });
      return;
    }
    const user = sanitizeUser(userRow);
    const scoped = filterRequestsForUser(user, getEnrichedRequests());
    res.json({ requests: scoped });
  });

  app.post('/api/requests', (req, res) => {
    const { needer_id, blood_type, units, urgency, dropoff_address, dropoff_lat, dropoff_lng, notes } =
      req.body || {};

    if (!needer_id || !blood_type || !dropoff_address) {
      res.status(400).json({ error: 'Needer, blood type, and delivery address are required.' });
      return;
    }

    const reqUnits = Math.max(1, Math.min(10, Number(units) || 1));
    const reqUrgency: UrgencyLevel = ['critical', 'urgent', 'standard'].includes(urgency)
      ? urgency
      : 'urgent';
    const targetLat = typeof dropoff_lat === 'number' ? dropoff_lat : 23.7465;
    const targetLng = typeof dropoff_lng === 'number' ? dropoff_lng : 90.376;

    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    db.prepare(
      `
      INSERT INTO blood_requests (
        id, needer_id, blood_type, units, urgency, status,
        dropoff_address, dropoff_lat, dropoff_lng, notes
      ) VALUES (?, ?, ?, ?, ?, 'SEARCHING', ?, ?, ?, ?)
    `
    ).run(
      id,
      needer_id,
      blood_type,
      reqUnits,
      reqUrgency,
      String(dropoff_address).trim(),
      targetLat,
      targetLng,
      String(notes || '').trim()
    );

    db.prepare('UPDATE users SET requests_count = requests_count + 1 WHERE id = ?').run(needer_id);

    const enriched = getEnrichedRequestById(id)!;
    const providers = getAllProviders();
    const ranked = rankNearbyProviders(blood_type as BloodType, reqUnits, targetLat, targetLng, providers);

    sendToUser(needer_id, 'request:created', {
      request: enriched,
      matchedHospitals: ranked.hospitals.length,
      matchedDonors: ranked.donors.length,
    });

    for (const h of ranked.hospitals.slice(0, 10)) {
      const notif = createNotification(
        h.user.id,
        `Urgent ${blood_type} Blood Request (${h.distanceKm} km)`,
        `${reqUnits} unit(s) needed at ${dropoff_address}. Stock available: ${h.availableUnits}.`,
        'dispatch',
        id
      );
      sendToUser(h.user.id, 'request:created', { request: enriched });
      sendToUser(h.user.id, 'notification:new', notif);
    }

    for (const d of ranked.donors.slice(0, 15)) {
      const notif = createNotification(
        d.user.id,
        `${blood_type} Donor Needed (${d.distanceKm} km)`,
        `Patient near ${dropoff_address} needs ${reqUnits} unit(s) (${reqUrgency}). Tap to accept.`,
        'dispatch',
        id
      );
      sendToUser(d.user.id, 'request:created', { request: enriched });
      sendToUser(d.user.id, 'notification:new', notif);
    }

    res.status(201).json({
      request: enriched,
      matchedCount: ranked.hospitals.length + ranked.donors.length,
    });
  });

  app.post('/api/requests/:id/cancel', (req, res) => {
    const { user_id } = req.body || {};
    const existing = getEnrichedRequestById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }
    if (existing.needer_id !== user_id) {
      res.status(403).json({ error: 'Only the requester can cancel this request.' });
      return;
    }
    if (!canTransitionStatus(existing.status, 'CANCELLED', 'needer')) {
      res.status(400).json({ error: `Cannot cancel request from status ${existing.status}.` });
      return;
    }

    db.prepare(
      `UPDATE blood_requests SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?`
    ).run(existing.id);

    const updated = getEnrichedRequestById(existing.id)!;
    broadcastAll('request:updated', updated);
    res.json({ request: updated });
  });

  app.post('/api/requests/:id/claim', (req, res) => {
    const { provider_id, dispatch_rider = true } = req.body || {};
    const existing = getEnrichedRequestById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    const providerRow = db.prepare('SELECT * FROM users WHERE id = ?').get(provider_id) as
      | Record<string, unknown>
      | undefined;
    if (!providerRow) {
      res.status(404).json({ error: 'Provider user not found.' });
      return;
    }

    const provider = sanitizeUser(providerRow);
    if (provider.role !== 'hospital' && provider.role !== 'donor') {
      res.status(403).json({ error: 'Only hospitals or donors can claim blood requests.' });
      return;
    }

    const nextStatus =
      provider.role === 'hospital'
        ? 'AWAITING_RIDER'
        : dispatch_rider
        ? 'AWAITING_RIDER'
        : 'DONOR_ACCEPTED';

    if (!canTransitionStatus(existing.status, nextStatus, provider.role)) {
      res.status(400).json({ error: `Cannot claim request from status ${existing.status}.` });
      return;
    }

    const tx = db.transaction(() => {
      if (provider.role === 'hospital') {
        const invRow = db
          .prepare('SELECT units FROM hospital_inventory WHERE hospital_id = ? AND blood_type = ?')
          .get(provider.id, existing.blood_type) as { units: number } | undefined;
        if (invRow && invRow.units > 0) {
          const deduct = Math.min(invRow.units, existing.units);
          db.prepare(
            `UPDATE hospital_inventory SET units = units - ?, updated_at = datetime('now') WHERE hospital_id = ? AND blood_type = ?`
          ).run(deduct, provider.id, existing.blood_type);
        }
      }

      db.prepare(
        `
        UPDATE blood_requests SET
          status = ?,
          pickup_type = ?,
          provider_id = ?,
          pickup_address = ?,
          pickup_lat = ?,
          pickup_lng = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(
        nextStatus,
        provider.role,
        provider.id,
        provider.address,
        provider.lat,
        provider.lng,
        existing.id
      );
    });

    tx();

    const updated = getEnrichedRequestById(existing.id)!;
    const providerDisplay = provider.hospital_name || provider.name;

    const neederNotif = createNotification(
      existing.needer_id,
      `${provider.role === 'hospital' ? 'Hospital' : 'Donor'} Accepted Your ${existing.blood_type} Request`,
      nextStatus === 'AWAITING_RIDER'
        ? `${providerDisplay} confirmed supply. Searching nearby rider for pickup — you can chat now.`
        : `${providerDisplay} accepted your request — you can chat directly now.`,
      'status',
      existing.id
    );
    sendToUser(existing.needer_id, 'notification:new', neederNotif);

    sendToRequestParticipants(updated, 'request:updated', updated);
    broadcastAll('request:closed', {
      requestId: updated.id,
      status: updated.status,
      providerId: updated.provider_id,
      riderId: updated.rider_id,
      neederId: updated.needer_id,
    });

    if (nextStatus === 'AWAITING_RIDER') {
      const riders = db
        .prepare("SELECT * FROM users WHERE role = 'rider' AND is_available = 1")
        .all() as Record<string, unknown>[];
      for (const r of riders) {
        const riderUser = sanitizeUser(r);
        const dist = haversineKm(provider.lat, provider.lng, riderUser.lat, riderUser.lng);
        if (dist <= 35) {
          const riderNotif = createNotification(
            riderUser.id,
            `New Blood Pickup Job (${dist} km away)`,
            `Pick up ${existing.units}u ${existing.blood_type} from ${providerDisplay} -> ${existing.dropoff_address}`,
            'rider',
            existing.id
          );
          sendToUser(riderUser.id, 'request:updated', updated);
          sendToUser(riderUser.id, 'notification:new', riderNotif);
        }
      }
    }

    if (provider.role === 'hospital') {
      const updatedHosp = sanitizeUser(
        db.prepare('SELECT * FROM users WHERE id = ?').get(provider.id) as Record<string, unknown>
      );
      sendToUser(provider.id, 'provider:updated', updatedHosp);
    }
    res.json({ request: updated });
  });

  app.post('/api/requests/:id/request-rider', (req, res) => {
    const existing = getEnrichedRequestById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }
    if (!canTransitionStatus(existing.status, 'AWAITING_RIDER', 'donor')) {
      res.status(400).json({ error: 'Cannot request rider in current state.' });
      return;
    }

    db.prepare(
      "UPDATE blood_requests SET status = 'AWAITING_RIDER', updated_at = datetime('now') WHERE id = ?"
    ).run(existing.id);

    const updated = getEnrichedRequestById(existing.id)!;
    sendToRequestParticipants(updated, 'request:updated', updated);

    const riders = db
      .prepare("SELECT * FROM users WHERE role = 'rider' AND is_available = 1")
      .all() as Record<string, unknown>[];
    for (const r of riders) {
      const riderUser = sanitizeUser(r);
      const notif = createNotification(
        riderUser.id,
        `Donor Pickup Ready (${existing.blood_type})`,
        `Collect from ${existing.provider_name || 'Donor'} -> ${existing.dropoff_address}`,
        'rider',
        existing.id
      );
      sendToUser(riderUser.id, 'request:updated', updated);
      sendToUser(riderUser.id, 'notification:new', notif);
    }

    res.json({ request: updated });
  });

  app.post('/api/requests/:id/accept-ride', (req, res) => {
    const { rider_id } = req.body || {};
    const existing = getEnrichedRequestById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }
    const riderRow = db.prepare('SELECT * FROM users WHERE id = ?').get(rider_id) as
      | Record<string, unknown>
      | undefined;
    if (!riderRow || riderRow.role !== 'rider') {
      res.status(403).json({ error: 'Valid rider account is required.' });
      return;
    }
    if (!canTransitionStatus(existing.status, 'RIDER_ASSIGNED', 'rider')) {
      res.status(400).json({ error: `Request is not awaiting a rider (${existing.status}).` });
      return;
    }

    db.prepare(
      `
      UPDATE blood_requests SET
        status = 'RIDER_ASSIGNED',
        rider_id = ?,
        rider_lat = ?,
        rider_lng = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `
    ).run(riderRow.id, riderRow.lat, riderRow.lng, existing.id);

    const updated = getEnrichedRequestById(existing.id)!;

    for (const targetId of [existing.needer_id, existing.provider_id].filter(Boolean) as string[]) {
      const notif = createNotification(
        targetId,
        `Rider ${riderRow.name} Assigned`,
        `${riderRow.name} (${riderRow.vehicle_type || 'Courier'}) is heading to pickup ${existing.blood_type} blood.`,
        'rider',
        existing.id
      );
      sendToUser(targetId, 'notification:new', notif);
    }

    sendToRequestParticipants(updated, 'request:updated', updated);
    broadcastAll('request:closed', {
      requestId: updated.id,
      status: updated.status,
      providerId: updated.provider_id,
      riderId: updated.rider_id,
      neederId: updated.needer_id,
    });
    res.json({ request: updated });
  });

  app.post('/api/requests/:id/pickup', (req, res) => {
    const { rider_id } = req.body || {};
    const existing = getEnrichedRequestById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }
    if (existing.rider_id !== rider_id) {
      res.status(403).json({ error: 'Only the assigned rider can confirm pickup.' });
      return;
    }
    if (!canTransitionStatus(existing.status, 'IN_TRANSIT', 'rider')) {
      res.status(400).json({ error: 'Cannot mark picked up from current status.' });
      return;
    }

    db.prepare(
      `
      UPDATE blood_requests SET
        status = 'IN_TRANSIT',
        rider_lat = COALESCE(pickup_lat, rider_lat),
        rider_lng = COALESCE(pickup_lng, rider_lng),
        updated_at = datetime('now')
      WHERE id = ?
    `
    ).run(existing.id);

    const updated = getEnrichedRequestById(existing.id)!;
    const notif = createNotification(
      existing.needer_id,
      `Blood Picked Up & In Transit`,
      `${updated.rider_name || 'Your rider'} collected the ${existing.blood_type} units and is heading to ${existing.dropoff_address}.`,
      'rider',
      existing.id
    );
    sendToUser(existing.needer_id, 'notification:new', notif);

    sendToRequestParticipants(updated, 'request:updated', updated);
    res.json({ request: updated });
  });

  app.post('/api/requests/:id/deliver', (req, res) => {
    const { actor_id } = req.body || {};
    const existing = getEnrichedRequestById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }
    const actor = db.prepare('SELECT role FROM users WHERE id = ?').get(actor_id) as
      | { role: UserRole }
      | undefined;
    if (!actor || !canTransitionStatus(existing.status, 'DELIVERED', actor.role)) {
      res.status(400).json({ error: 'Cannot mark delivered from current status.' });
      return;
    }

    const tx = db.transaction(() => {
      db.prepare(
        `
        UPDATE blood_requests SET
          status = 'DELIVERED',
          rider_lat = dropoff_lat,
          rider_lng = dropoff_lng,
          updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(existing.id);

      if (existing.pickup_type === 'donor' && existing.provider_id) {
        db.prepare('UPDATE users SET donations_count = donations_count + 1 WHERE id = ?').run(
          existing.provider_id
        );
      }
    });
    tx();

    const updated = getEnrichedRequestById(existing.id)!;
    for (const targetId of [existing.needer_id, existing.provider_id].filter(Boolean) as string[]) {
      const notif = createNotification(
        targetId,
        `Blood Delivery Completed`,
        `${existing.units} unit(s) of ${existing.blood_type} safely delivered to ${existing.dropoff_address}.`,
        'status',
        existing.id
      );
      sendToUser(targetId, 'notification:new', notif);
    }

    sendToRequestParticipants(updated, 'request:updated', updated);
    res.json({ request: updated });
  });

  app.post('/api/requests/:id/location', (req, res) => {
    const { lat, lng, user_id } = req.body || {};
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'Numeric lat and lng required.' });
      return;
    }

    const existing = getEnrichedRequestById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }

    db.prepare(
      `UPDATE blood_requests SET rider_lat = ?, rider_lng = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(lat, lng, existing.id);

    if (user_id) {
      db.prepare('UPDATE users SET lat = ?, lng = ? WHERE id = ?').run(lat, lng, user_id);
    }

    const updated = getEnrichedRequestById(existing.id)!;
    sendToRequestParticipants(updated, 'location:updated', {
      requestId: existing.id,
      lat,
      lng,
      request: updated,
    });
    res.json({ request: updated });
  });

  // --- DIRECT CHAT (Strictly Between Matched Request Participants) ---

  app.get('/api/chats/contacts/:userId', (req, res) => {
    const userId = req.params.userId;
    const allReqs = getEnrichedRequests();
    const partnerIds = getAuthorizedChatPartnerIds(userId, allReqs);
    if (partnerIds.length === 0) {
      res.json({ contacts: [] });
      return;
    }
    const all = getAllProviders();
    const contacts = all.filter((u) => partnerIds.includes(u.id));
    res.json({ contacts });
  });

  app.get('/api/chats/threads/:userId', (req, res) => {
    const userId = req.params.userId;
    const rows = db
      .prepare(
        `
        SELECT m.*, u_sender.name as sender_name, u_sender.role as sender_role
        FROM chat_messages m
        JOIN users u_sender ON m.sender_id = u_sender.id
        WHERE m.sender_id = ? OR m.receiver_id = ?
        ORDER BY m.created_at DESC
      `
      )
      .all(userId, userId) as Array<{
      room_id: string;
      request_id: string | null;
      sender_id: string;
      receiver_id: string;
      message: string;
      created_at: string;
    }>;

    const onlineIds = getOnlineUserIds();
    const threadMap = new Map<string, unknown>();
    for (const row of rows) {
      if (threadMap.has(row.room_id)) continue;
      const partnerId = row.sender_id === userId ? row.receiver_id : row.sender_id;
      const partner = db.prepare('SELECT * FROM users WHERE id = ?').get(partnerId) as
        | Record<string, unknown>
        | undefined;
      if (!partner) continue;
      threadMap.set(row.room_id, {
        room_id: row.room_id,
        partner_id: partnerId,
        partner_name: partner.hospital_name || partner.name,
        partner_role: partner.role,
        partner_blood_type: partner.blood_type,
        partner_online: onlineIds.has(partnerId) || Boolean(partner.is_available),
        request_id: row.request_id,
        last_message: row.message,
        last_time: row.created_at,
      });
    }

    res.json({ threads: Array.from(threadMap.values()) });
  });

  app.get('/api/chats/room/:roomId', (req, res) => {
    const messages = getMessagesByRoom(req.params.roomId);
    res.json({ messages });
  });

  app.post('/api/chats/send', (req, res) => {
    const { sender_id, receiver_id, request_id = null, message, msg_type = 'text', duration_sec = 0 } =
      req.body || {};

    if (!sender_id || !receiver_id || !message) {
      res.status(400).json({ error: 'sender_id, receiver_id, and message are required.' });
      return;
    }

    const authorizedPartners = getAuthorizedChatPartnerIds(sender_id, getEnrichedRequests());
    if (!authorizedPartners.includes(receiver_id)) {
      res.status(403).json({
        error: 'Direct chat unlocks once a donor, hospital, or rider is matched with your request.',
      });
      return;
    }

    const roomId = makeDirectRoomId(sender_id, receiver_id, request_id);
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    db.prepare(
      `
      INSERT INTO chat_messages (id, request_id, room_id, sender_id, receiver_id, message, msg_type, duration_sec)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(id, request_id, roomId, sender_id, receiver_id, String(message).trim(), msg_type, duration_sec);

    const saved = db
      .prepare(
        `
        SELECT m.*, u.name as sender_name, u.role as sender_role
        FROM chat_messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `
      )
      .get(id) as Record<string, unknown>;

    const notif = createNotification(
      receiver_id,
      `New message from ${saved.sender_name}`,
      String(message).slice(0, 80),
      'chat',
      request_id
    );

    sendToUser(receiver_id, 'chat:message', saved);
    sendToUser(sender_id, 'chat:message', saved);
    sendToUser(receiver_id, 'notification:new', notif);

    res.status(201).json({ message: saved, room_id: roomId });
  });

  // --- NOTIFICATIONS ---

  app.get('/api/notifications/:userId', (req, res) => {
    res.json({ notifications: getAllUserNotifications(req.params.userId) });
  });

  app.post('/api/notifications/:userId/read', (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.params.userId);
    res.json({ ok: true });
  });

  // --- GOVERNMENT TIKA CARE CAMPAIGNS & REGISTRATIONS ---

  app.get('/api/tika/campaigns', (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;
    const all = getEnrichedTikaCampaigns();
    const visible = all.filter((c) => c.status === 'ACTIVE' || (userId && c.gov_user_id === userId));
    res.json({ campaigns: visible });
  });

  app.post('/api/tika/campaigns', (req, res) => {
    const {
      gov_user_id,
      title,
      vaccine_name,
      target_group,
      dose_schedule,
      total_slots,
      venue_name,
      venue_address,
      lat,
      lng,
      start_date,
      end_date,
      description,
      home_visit_available,
    } = req.body || {};

    if (!gov_user_id || !title || !vaccine_name || !venue_name || !venue_address) {
      res.status(400).json({ error: 'Campaign title, vaccine name, venue name, and address are required.' });
      return;
    }

    const govRow = db.prepare('SELECT * FROM users WHERE id = ?').get(gov_user_id) as
      | Record<string, unknown>
      | undefined;
    if (!govRow || govRow.role !== 'government') {
      res.status(403).json({ error: 'Only Government / Tika Center accounts can launch campaigns.' });
      return;
    }

    const govUser = sanitizeUser(govRow);
    const id = `tika_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const safeLat = typeof lat === 'number' ? lat : govUser.lat;
    const safeLng = typeof lng === 'number' ? lng : govUser.lng;
    const slots = Math.max(10, Math.min(50000, Number(total_slots) || 250));

    db.prepare(
      `
      INSERT INTO tika_campaigns (
        id, gov_user_id, title, vaccine_name, target_group, dose_schedule,
        total_slots, venue_name, venue_address, lat, lng, start_date, end_date,
        description, home_visit_available, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `
    ).run(
      id,
      govUser.id,
      String(title).trim(),
      String(vaccine_name).trim(),
      String(target_group || 'All Citizens').trim(),
      String(dose_schedule || '1 Dose · Single Visit').trim(),
      slots,
      String(venue_name).trim(),
      String(venue_address).trim(),
      safeLat,
      safeLng,
      String(start_date || new Date().toISOString().slice(0, 10)),
      String(end_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)),
      String(description || '').trim(),
      home_visit_available ? 1 : 0
    );

    const created = getEnrichedTikaCampaignById(id)!;
    broadcastAll('tika:campaign_created', created);

    const citizens = db
      .prepare("SELECT id FROM users WHERE role != 'government'")
      .all() as { id: string }[];
    for (const c of citizens) {
      const notif = createNotification(
        c.id,
        `Govt Tika Drive: ${created.vaccine_name}`,
        `${created.title} at ${created.venue_name} (${created.target_group}). Book your Tika slot now.`,
        'tika',
        created.id
      );
      sendToUser(c.id, 'notification:new', notif);
    }

    res.status(201).json({ campaign: created });
  });

  app.patch('/api/tika/campaigns/:id', (req, res) => {
    const { gov_user_id, status } = req.body || {};
    const existing = getEnrichedTikaCampaignById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }
    if (existing.gov_user_id !== gov_user_id) {
      res.status(403).json({ error: 'Only the launching Government authority can modify this campaign.' });
      return;
    }
    const validStatuses: TikaCampaignStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid campaign status.' });
      return;
    }

    db.prepare('UPDATE tika_campaigns SET status = ? WHERE id = ?').run(status, existing.id);
    const updated = getEnrichedTikaCampaignById(existing.id)!;
    broadcastAll('tika:campaign_updated', updated);
    res.json({ campaign: updated });
  });

  app.get('/api/tika/registrations', (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;
    if (!userId) {
      res.json({ registrations: [] });
      return;
    }
    const userRow = db.prepare('SELECT role FROM users WHERE id = ?').get(userId) as
      | { role: UserRole }
      | undefined;
    if (!userRow) {
      res.json({ registrations: [] });
      return;
    }

    const registrations =
      userRow.role === 'government'
        ? getTikaRegistrationsForGov(userId)
        : getTikaRegistrationsForUser(userId);
    res.json({ registrations });
  });

  app.post('/api/tika/registrations', (req, res) => {
    const {
      campaign_id,
      user_id,
      beneficiary_name,
      beneficiary_age,
      nid_or_brn,
      phone,
      dose_number,
      delivery_mode,
      address,
      lat,
      lng,
      preferred_date,
      preferred_slot,
    } = req.body || {};

    if (!campaign_id || !user_id || !beneficiary_name || !nid_or_brn || !phone) {
      res.status(400).json({
        error: 'Campaign, user, beneficiary name, NID/Birth Reg No., and phone are required.',
      });
      return;
    }

    const campaign = getEnrichedTikaCampaignById(campaign_id);
    if (!campaign || campaign.status !== 'ACTIVE') {
      res.status(400).json({ error: 'This Tika campaign is not currently accepting registrations.' });
      return;
    }
    if (campaign.registered_count >= campaign.total_slots) {
      res.status(409).json({ error: 'All vaccination slots for this campaign are full.' });
      return;
    }

    const id = `treg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cardCode = generateTikaCardCode(campaign.vaccine_name, id);
    const mode = delivery_mode === 'home_visit' && campaign.home_visit_available ? 'home_visit' : 'camp';

    db.prepare(
      `
      INSERT INTO tika_registrations (
        id, campaign_id, user_id, beneficiary_name, beneficiary_age, nid_or_brn,
        phone, dose_number, delivery_mode, address, lat, lng, preferred_date,
        preferred_slot, tika_card_code, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REGISTERED')
    `
    ).run(
      id,
      campaign.id,
      user_id,
      String(beneficiary_name).trim(),
      Math.max(0, Math.min(120, Number(beneficiary_age) || 1)),
      String(nid_or_brn).trim(),
      String(phone).trim(),
      Math.max(1, Math.min(5, Number(dose_number) || 1)),
      mode,
      String(address || campaign.venue_address).trim(),
      typeof lat === 'number' ? lat : campaign.lat,
      typeof lng === 'number' ? lng : campaign.lng,
      String(preferred_date || campaign.start_date),
      String(preferred_slot || '09:00 AM - 12:00 PM'),
      cardCode
    );

    const createdReg = getTikaRegistrationById(id)!;
    const updatedCampaign = getEnrichedTikaCampaignById(campaign.id)!;

    sendToUser(user_id, 'tika:registration_created', createdReg);
    sendToUser(campaign.gov_user_id, 'tika:registration_created', createdReg);
    broadcastAll('tika:campaign_updated', updatedCampaign);

    const govNotif = createNotification(
      campaign.gov_user_id,
      `New Tika Slot Booked (${campaign.vaccine_name})`,
      `${createdReg.beneficiary_name} registered (${createdReg.tika_card_code}) · ${mode === 'home_visit' ? 'Home Visit' : 'Camp Booth'}.`,
      'tika',
      campaign.id
    );
    sendToUser(campaign.gov_user_id, 'notification:new', govNotif);

    res.status(201).json({ registration: createdReg, campaign: updatedCampaign });
  });

  app.patch('/api/tika/registrations/:id/status', (req, res) => {
    const { actor_id, status } = req.body || {};
    const existing = getTikaRegistrationById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Registration not found.' });
      return;
    }
    const campaign = getEnrichedTikaCampaignById(existing.campaign_id);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }

    const actorRow = db.prepare('SELECT role FROM users WHERE id = ?').get(actor_id) as
      | { role: UserRole }
      | undefined;
    if (!actorRow) {
      res.status(403).json({ error: 'Unauthorized actor.' });
      return;
    }

    if (actorRow.role === 'government' && campaign.gov_user_id !== actor_id) {
      res.status(403).json({ error: 'Only the owning Government center can verify this dose.' });
      return;
    }
    if (actorRow.role !== 'government' && existing.user_id !== actor_id) {
      res.status(403).json({ error: 'You can only update your own registration.' });
      return;
    }

    const nextStatus = status as TikaRegistrationStatus;
    if (!canTransitionTikaStatus(existing.status, nextStatus, actorRow.role)) {
      res.status(400).json({ error: `Cannot change status from ${existing.status} to ${nextStatus}.` });
      return;
    }

    if (nextStatus === 'VACCINATED') {
      db.prepare(
        `UPDATE tika_registrations SET status = 'VACCINATED', administered_at = datetime('now') WHERE id = ?`
      ).run(existing.id);
    } else {
      db.prepare('UPDATE tika_registrations SET status = ? WHERE id = ?').run(nextStatus, existing.id);
    }

    const updatedReg = getTikaRegistrationById(existing.id)!;
    const updatedCampaign = getEnrichedTikaCampaignById(campaign.id)!;

    sendToUser(existing.user_id, 'tika:registration_updated', updatedReg);
    sendToUser(campaign.gov_user_id, 'tika:registration_updated', updatedReg);
    broadcastAll('tika:campaign_updated', updatedCampaign);

    if (actorRow.role === 'government') {
      const title =
        nextStatus === 'VACCINATED'
          ? `Tika Verified: ${campaign.vaccine_name}`
          : `Tika Slot Confirmed`;
      const body =
        nextStatus === 'VACCINATED'
          ? `${updatedReg.beneficiary_name}'s Dose #${updatedReg.dose_number} is verified on Digital Tika Card ${updatedReg.tika_card_code}.`
          : `Your slot for ${campaign.title} on ${updatedReg.preferred_date} (${updatedReg.preferred_slot}) is confirmed.`;
      const citizenNotif = createNotification(existing.user_id, title, body, 'tika', campaign.id);
      sendToUser(existing.user_id, 'notification:new', citizenNotif);
    }

    res.json({ registration: updatedReg, campaign: updatedCampaign });
  });

  // Catch-all JSON 404 for unknown /api/* endpoints so Vercel/clients never receive HTML/text 404s
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Always return JSON errors instead of Express default HTML stack traces
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal server error.';
    res.status(500).json({ error: message });
  });

  return app;
}
