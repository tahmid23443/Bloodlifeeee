import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import type {
  AppNotification,
  BloodRequest,
  BloodType,
  ChatMessage,
  TikaCampaign,
  TikaRegistration,
  UserProfile,
} from '../types';
import { BLOOD_TYPES } from '../shared/bloodLogic';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : isServerless
  ? '/tmp/bloodline.db'
  : path.resolve(process.cwd(), 'bloodline.db');

export const db = new Database(DB_PATH);

try {
  db.pragma('journal_mode = WAL');
} catch {
  // Fallback to default journal mode if environment disallows WAL
}
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // Check if an older users table lacked the 'government' role CHECK constraint
  const existingUsersTable = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get() as { sql?: string } | undefined;

  if (existingUsersTable?.sql && !existingUsersTable.sql.includes("'government'")) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      BEGIN TRANSACTION;
      ALTER TABLE users RENAME TO users_old;
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('donor', 'needer', 'rider', 'hospital', 'government')),
        blood_type TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        is_available INTEGER NOT NULL DEFAULT 1,
        donations_count INTEGER NOT NULL DEFAULT 0,
        requests_count INTEGER NOT NULL DEFAULT 0,
        vehicle_type TEXT,
        hospital_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users SELECT * FROM users_old;
      DROP TABLE users_old;
      COMMIT;
    `);
    db.pragma('foreign_keys = ON');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('donor', 'needer', 'rider', 'hospital', 'government')),
      blood_type TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      donations_count INTEGER NOT NULL DEFAULT 0,
      requests_count INTEGER NOT NULL DEFAULT 0,
      vehicle_type TEXT,
      hospital_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hospital_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id TEXT NOT NULL,
      blood_type TEXT NOT NULL,
      units INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(hospital_id, blood_type),
      FOREIGN KEY(hospital_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blood_requests (
      id TEXT PRIMARY KEY,
      needer_id TEXT NOT NULL,
      blood_type TEXT NOT NULL,
      units INTEGER NOT NULL DEFAULT 1,
      urgency TEXT NOT NULL CHECK(urgency IN ('critical', 'urgent', 'standard')),
      status TEXT NOT NULL,
      pickup_type TEXT,
      provider_id TEXT,
      rider_id TEXT,
      pickup_address TEXT,
      pickup_lat REAL,
      pickup_lng REAL,
      dropoff_address TEXT NOT NULL,
      dropoff_lat REAL NOT NULL,
      dropoff_lng REAL NOT NULL,
      rider_lat REAL,
      rider_lng REAL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(needer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tika_campaigns (
      id TEXT PRIMARY KEY,
      gov_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      vaccine_name TEXT NOT NULL,
      target_group TEXT NOT NULL,
      dose_schedule TEXT NOT NULL,
      total_slots INTEGER NOT NULL DEFAULT 100,
      venue_name TEXT NOT NULL,
      venue_address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      home_visit_available INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PAUSED', 'COMPLETED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(gov_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tika_registrations (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      beneficiary_name TEXT NOT NULL,
      beneficiary_age INTEGER NOT NULL DEFAULT 1,
      nid_or_brn TEXT NOT NULL,
      phone TEXT NOT NULL,
      dose_number INTEGER NOT NULL DEFAULT 1,
      delivery_mode TEXT NOT NULL DEFAULT 'camp' CHECK(delivery_mode IN ('camp', 'home_visit')),
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_slot TEXT NOT NULL,
      tika_card_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'REGISTERED' CHECK(status IN ('REGISTERED', 'CONFIRMED', 'VACCINATED', 'CANCELLED')),
      administered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(campaign_id) REFERENCES tika_campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      message TEXT NOT NULL,
      msg_type TEXT NOT NULL DEFAULT 'text',
      duration_sec INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'status',
      request_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  seedDemoDatabase();
}

export function seedDemoDatabase() {
  const count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const passwordHash = bcrypt.hashSync('demo123', 8);

  const tx = db.transaction(() => {
    const users = [
      { id: 'usr_needer', name: 'Tahmid Nirob', email: 'needer@demo.com', role: 'needer', blood_type: 'O+', phone: '+880 1711-223344', address: 'Dhanmondi 27, Dhaka', lat: 23.7465, lng: 90.3760 },
      { id: 'usr_donor', name: 'Dr. Tanvir Rahman', email: 'donor@demo.com', role: 'donor', blood_type: 'A+', phone: '+880 1812-334455', address: 'Panthapath, Dhaka', lat: 23.7529, lng: 90.3816 },
      { id: 'usr_donor2', name: 'Nusrat Jahan', email: 'donor2@demo.com', role: 'donor', blood_type: 'O+', phone: '+880 1913-445566', address: 'Gulshan 2, Dhaka', lat: 23.8048, lng: 90.4157 },
      { id: 'usr_rider', name: 'Shaheen Express', email: 'rider@demo.com', role: 'rider', blood_type: 'B+', phone: '+880 1714-556677', address: 'Banani Road 11, Dhaka', lat: 23.7937, lng: 90.4066, vehicle_type: 'Cold-Box Motorcycle' },
      { id: 'usr_hospital', name: 'Dhaka Medical Blood Bank', email: 'hospital@demo.com', role: 'hospital', blood_type: 'O+', phone: '+880 2-9661301', address: 'Shahbagh Medical Hub, Dhaka', lat: 23.7389, lng: 90.3958, hospital_name: 'Dhaka Medical Blood Bank' },
      { id: 'usr_gov', name: 'DGHS Immunization HQ', email: 'gov@demo.com', role: 'government', blood_type: 'A+', phone: '+880 2-7171212', address: 'Agargaon Health Directorate, Dhaka', lat: 23.7751, lng: 90.3801, hospital_name: 'DGHS Tika Care Unit' },
    ];

    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, blood_type, phone, address, lat, lng, is_available, donations_count, requests_count, vehicle_type, hospital_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 3, 1, ?, ?)
    `);

    for (const u of users) {
      insertUser.run(u.id, u.name, u.email, passwordHash, u.role, u.blood_type, u.phone, u.address, u.lat, u.lng, u.vehicle_type || null, u.hospital_name || null);
    }

    const invInsert = db.prepare('INSERT OR REPLACE INTO hospital_inventory (hospital_id, blood_type, units) VALUES (?, ?, ?)');
    for (const bt of BLOOD_TYPES) {
      invInsert.run('usr_hospital', bt, bt === 'O+' || bt === 'A+' ? 12 : 5);
    }

    db.prepare(`
      INSERT OR REPLACE INTO blood_requests (id, needer_id, blood_type, units, urgency, status, pickup_type, provider_id, rider_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, rider_lat, rider_lng, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'req_demo_01',
      'usr_needer',
      'O+',
      2,
      'critical',
      'rider_dispatched',
      'hospital',
      'usr_hospital',
      'usr_rider',
      'Dhaka Medical Blood Bank, Shahbagh',
      23.7389,
      90.3958,
      'Dhanmondi 27, Dhaka (Needer Home)',
      23.7465,
      90.3760,
      23.7420,
      90.3850,
      'Urgent surgery requirement. Please dispatch with cold-box rider.'
    );

    db.prepare(`
      INSERT OR REPLACE INTO tika_campaigns (id, gov_user_id, title, vaccine_name, target_group, dose_schedule, total_slots, venue_name, venue_address, lat, lng, start_date, end_date, description, home_visit_available, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'tika_demo_01',
      'usr_gov',
      'National HPV & Booster Immunization Drive 2026',
      'Gardasil-9 / HPV & Tetanus Booster',
      'Girls aged 10-15 & Adults',
      'Single Dose / Annual Booster',
      250,
      'Dhaka Medical College Centenary Hall',
      'Shahbagh, Dhaka',
      23.7395,
      90.3962,
      '2026-11-25',
      '2026-11-30',
      'Government authorized nationwide vaccination campaign with verified digital QR Tika Cards and home visit support.',
      1,
      'ACTIVE'
    );

    db.prepare(`
      INSERT OR REPLACE INTO tika_registrations (id, campaign_id, user_id, beneficiary_name, beneficiary_age, nid_or_brn, phone, dose_number, delivery_mode, address, lat, lng, preferred_date, preferred_slot, tika_card_code, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'reg_demo_01',
      'tika_demo_01',
      'usr_needer',
      'Sadia Nirob',
      14,
      'BRN-2012-88923411',
      '+880 1711-223344',
      1,
      'camp',
      'Dhanmondi 27, Dhaka',
      23.7465,
      90.3760,
      '2026-11-26',
      'Morning (09:00 AM - 12:00 PM)',
      'TIKA-BD-8841-2026',
      'CONFIRMED'
    );

    db.prepare(`
      INSERT OR REPLACE INTO chat_messages (id, request_id, room_id, sender_id, receiver_id, message, msg_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'msg_demo_1',
      'req_demo_01',
      'req_req_demo_01',
      'usr_rider',
      'usr_needer',
      'Hello Tahmid! I have picked up 2 units of O+ blood from Dhaka Medical Bank in my cold-box. Arriving at Dhanmondi 27 in 8 minutes!',
      'text'
    );
  });

  tx();
}

export function sanitizeUser(row: Record<string, unknown>): UserProfile {
  const { password_hash: _ignored, ...rest } = row;
  const user = rest as unknown as UserProfile;
  if (user.role === 'hospital') {
    const invRows = db
      .prepare('SELECT blood_type, units FROM hospital_inventory WHERE hospital_id = ?')
      .all(user.id) as { blood_type: BloodType; units: number }[];
    const inv = {} as Record<BloodType, number>;
    for (const bt of BLOOD_TYPES) inv[bt] = 0;
    for (const r of invRows) inv[r.blood_type] = r.units;
    user.inventory = inv;
  }
  return user;
}

export function getAllProviders(): UserProfile[] {
  const rows = db.prepare('SELECT * FROM users').all() as Record<string, unknown>[];
  return rows.map(sanitizeUser);
}

export function getEnrichedRequests(): BloodRequest[] {
  return db
    .prepare(
      `
      SELECT
        r.*,
        n.name as needer_name,
        n.phone as needer_phone,
        COALESCE(p.hospital_name, p.name) as provider_name,
        p.phone as provider_phone,
        ri.name as rider_name,
        ri.phone as rider_phone,
        ri.vehicle_type as rider_vehicle
      FROM blood_requests r
      JOIN users n ON r.needer_id = n.id
      LEFT JOIN users p ON r.provider_id = p.id
      LEFT JOIN users ri ON r.rider_id = ri.id
      ORDER BY r.created_at DESC
    `
    )
    .all() as BloodRequest[];
}

export function getEnrichedRequestById(id: string): BloodRequest | undefined {
  return db
    .prepare(
      `
      SELECT
        r.*,
        n.name as needer_name,
        n.phone as needer_phone,
        COALESCE(p.hospital_name, p.name) as provider_name,
        p.phone as provider_phone,
        ri.name as rider_name,
        ri.phone as rider_phone,
        ri.vehicle_type as rider_vehicle
      FROM blood_requests r
      JOIN users n ON r.needer_id = n.id
      LEFT JOIN users p ON r.provider_id = p.id
      LEFT JOIN users ri ON r.rider_id = ri.id
      WHERE r.id = ?
    `
    )
    .get(id) as BloodRequest | undefined;
}

export function getEnrichedTikaCampaigns(): TikaCampaign[] {
  return db
    .prepare(
      `
      SELECT
        c.*,
        COALESCE(u.hospital_name, u.name) as gov_org_name,
        COALESCE((SELECT COUNT(*) FROM tika_registrations r WHERE r.campaign_id = c.id AND r.status != 'CANCELLED'), 0) as registered_count,
        COALESCE((SELECT COUNT(*) FROM tika_registrations r WHERE r.campaign_id = c.id AND r.status = 'VACCINATED'), 0) as vaccinated_count
      FROM tika_campaigns c
      JOIN users u ON c.gov_user_id = u.id
      ORDER BY c.created_at DESC
    `
    )
    .all() as TikaCampaign[];
}

export function getEnrichedTikaCampaignById(id: string): TikaCampaign | undefined {
  return db
    .prepare(
      `
      SELECT
        c.*,
        COALESCE(u.hospital_name, u.name) as gov_org_name,
        COALESCE((SELECT COUNT(*) FROM tika_registrations r WHERE r.campaign_id = c.id AND r.status != 'CANCELLED'), 0) as registered_count,
        COALESCE((SELECT COUNT(*) FROM tika_registrations r WHERE r.campaign_id = c.id AND r.status = 'VACCINATED'), 0) as vaccinated_count
      FROM tika_campaigns c
      JOIN users u ON c.gov_user_id = u.id
      WHERE c.id = ?
    `
    )
    .get(id) as TikaCampaign | undefined;
}

export function getTikaRegistrationsForUser(userId: string): TikaRegistration[] {
  return db
    .prepare(
      `
      SELECT
        r.*,
        c.title as campaign_title,
        c.vaccine_name as vaccine_name,
        c.venue_name as venue_name,
        c.venue_address as venue_address
      FROM tika_registrations r
      JOIN tika_campaigns c ON r.campaign_id = c.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `
    )
    .all(userId) as TikaRegistration[];
}

export function getTikaRegistrationsForGov(govUserId: string): TikaRegistration[] {
  return db
    .prepare(
      `
      SELECT
        r.*,
        c.title as campaign_title,
        c.vaccine_name as vaccine_name,
        c.venue_name as venue_name,
        c.venue_address as venue_address
      FROM tika_registrations r
      JOIN tika_campaigns c ON r.campaign_id = c.id
      WHERE c.gov_user_id = ?
      ORDER BY r.created_at DESC
    `
    )
    .all(govUserId) as TikaRegistration[];
}

export function getTikaRegistrationById(id: string): TikaRegistration | undefined {
  return db
    .prepare(
      `
      SELECT
        r.*,
        c.title as campaign_title,
        c.vaccine_name as vaccine_name,
        c.venue_name as venue_name,
        c.venue_address as venue_address
      FROM tika_registrations r
      JOIN tika_campaigns c ON r.campaign_id = c.id
      WHERE r.id = ?
    `
    )
    .get(id) as TikaRegistration | undefined;
}

export function createNotification(
  userId: string,
  title: string,
  body: string,
  type: AppNotification['type'],
  requestId: string | null = null
): AppNotification {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type, request_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(id, userId, title, body, type, requestId);
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as AppNotification;
}

export function getMessagesByRoom(roomId: string): ChatMessage[] {
  return db
    .prepare(
      `
      SELECT m.*, u.name as sender_name, u.role as sender_role
      FROM chat_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.created_at ASC
    `
    )
    .all(roomId) as ChatMessage[];
}

export function getAllUserNotifications(userId: string): AppNotification[] {
  return db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40')
    .all(userId) as AppNotification[];
}
