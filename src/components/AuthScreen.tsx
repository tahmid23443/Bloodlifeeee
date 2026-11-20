import { useState, useEffect, type FormEvent } from 'react';
import { ArrowRight, Bike, Building2, Droplet, Droplets, HeartHandshake, LocateFixed, ShieldCheck } from 'lucide-react';
import { BLOOD_TYPES } from '../shared/bloodLogic';
import type { BloodType, UserProfile, UserRole } from '../types';
import { api } from '../utils/api';

interface AuthScreenProps {
  onAuthenticated: (user: UserProfile) => void;
}

const ROLE_OPTIONS: {
  role: UserRole;
  title: string;
  subtitle: string;
  icon: typeof Droplets;
}[] = [
  {
    role: 'needer',
    title: 'Blood Needer',
    subtitle: 'Book blood & Tika slots',
    icon: HeartHandshake,
  },
  {
    role: 'donor',
    title: 'Blood Donor',
    subtitle: 'Accept nearby urgent requests',
    icon: Droplets,
  },
  {
    role: 'rider',
    title: 'Medical Rider',
    subtitle: 'Pick up & deliver blood units',
    icon: Bike,
  },
  {
    role: 'hospital',
    title: 'Hospital / Bank',
    subtitle: 'Manage stock & dispatch riders',
    icon: Building2,
  },
  {
    role: 'government',
    title: 'Govt Tika Care',
    subtitle: 'Launch immunization campaigns',
    icon: ShieldCheck,
  },
];

const DHAKA_HUBS = [
  { label: 'Dhanmondi 27, Dhaka', lat: 23.7465, lng: 90.376 },
  { label: 'Panthapath, Dhaka', lat: 23.7529, lng: 90.3816 },
  { label: 'Gulshan 2, Dhaka', lat: 23.8048, lng: 90.4157 },
  { label: 'Banani Road 11, Dhaka', lat: 23.7937, lng: 90.4066 },
  { label: 'Shahbagh Medical Hub, Dhaka', lat: 23.7389, lng: 90.3958 },
];

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [selectedRole, setSelectedRole] = useState<UserRole>('needer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodType, setBloodType] = useState<BloodType>('A+');
  const [hubIdx, setHubIdx] = useState(0);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [hospitalName, setHospitalName] = useState('');
  const [nid, setNid] = useState('');
  const [vehicleType, setVehicleType] = useState('Cold-Box Motorcycle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);



  function detectLiveGps() {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({
          lat: Math.round(pos.coords.latitude * 100000) / 100000,
          lng: Math.round(pos.coords.longitude * 100000) / 100000,
        });
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function handleDemoLogin(demoEmail: string) {
    setError('');
    setLoading(true);
    try {
      await api.seedDemo();
      const { user } = await api.login(demoEmail, 'demo123');
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { user } = await api.login(email, password);
        onAuthenticated(user);
      } else {
        const hub = DHAKA_HUBS[hubIdx] || DHAKA_HUBS[0];
        const { user } = await api.signup({
          name,
          email,
          password,
          role: selectedRole,
          blood_type: bloodType,
          phone,
          address: gpsCoords ? `${hub.label} (Live GPS)` : hub.label,
          lat: gpsCoords?.lat ?? hub.lat,
          lng: gpsCoords?.lng ?? hub.lng,
          hospital_name:
            selectedRole === 'hospital' || selectedRole === 'government'
              ? hospitalName || name
              : undefined,
          vehicle_type: selectedRole === 'rider' ? vehicleType : undefined,
          nid,
        });
        onAuthenticated(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#DC1423] md:bg-[#F2F3F5] flex flex-col items-center justify-center md:p-6">
      {/* Native App Container */}
      <div className="w-full max-w-md md:max-w-[460px] min-h-screen md:min-h-0 bg-white md:rounded-[32px] md:shadow-xl md:border md:border-neutral-200 overflow-hidden flex flex-col">
        {/* Compact Crimson App Header */}
        <div className="bg-[#DC1423] text-white px-6 pt-7 pb-8 rounded-b-[28px] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white text-[#DC1423] flex items-center justify-center">
                <Droplet className="w-5 h-5 fill-[#DC1423]" />
              </div>
              <span className="font-display text-xl font-extrabold tracking-tight">Blood Life</span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-black/15 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  mode === 'signup' ? 'bg-white text-[#DC1423]' : 'text-white/90 hover:text-white'
                }`}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  mode === 'login' ? 'bg-white text-[#DC1423]' : 'text-white/90 hover:text-white'
                }`}
              >
                Sign In
              </button>
            </div>
          </div>

          <h1 className="font-display text-2xl font-bold mt-5 leading-tight">
            {mode === 'signup' ? 'Choose your account role' : 'Sign in to continue'}
          </h1>
          <p className="text-xs text-white/85 mt-1">
            {mode === 'signup'
              ? 'Select Donor, Needer, Rider, Hospital, or Govt Tika Care mode.'
              : 'Access your live dispatch dashboard and messages.'}
          </p>
        </div>

        {/* Native Form Body */}
        <div className="flex-1 px-6 py-5 overflow-y-auto space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#DC1423]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <span className="block text-xs font-semibold text-neutral-600 mb-2">
                  Select Role
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {ROLE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = selectedRole === opt.role;
                    const fullSpan = opt.role === 'government';
                    return (
                      <button
                        key={opt.role}
                        type="button"
                        onClick={() => setSelectedRole(opt.role)}
                        className={`text-left p-3 rounded-2xl border transition-all flex ${
                          fullSpan ? 'col-span-2 items-center gap-3 min-h-[62px]' : 'flex-col gap-2 min-h-[82px]'
                        } ${
                          active
                            ? 'border-[#DC1423] bg-red-50/70 ring-1 ring-[#DC1423]'
                            : 'border-neutral-200 bg-[#FAFAFB] hover:border-neutral-300'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            active ? 'bg-[#DC1423] text-white' : 'bg-white text-neutral-700 border border-neutral-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#141417]">{opt.title}</div>
                          <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                            {opt.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-3.5">
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-semibold text-neutral-700 mb-1">
                    {selectedRole === 'hospital' || selectedRole === 'government'
                      ? 'Officer / Admin Name (as per NID)'
                      : 'Full Name (as per NID)'}
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ayesha Rahman"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="auth-nid" className="block text-xs font-semibold text-neutral-700 mb-1">
                    NID / Birth Registration Number
                  </label>
                  <input
                    id="auth-nid"
                    type="text"
                    required
                    value={nid}
                    onChange={(e) => setNid(e.target.value)}
                    placeholder="e.g. 199856789012345"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={mode === 'login' ? 'sm:col-span-2' : ''}>
                <label htmlFor="auth-email" className="block text-xs font-semibold text-neutral-700 mb-1">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none"
                />
              </div>

              <div className={mode === 'login' ? 'sm:col-span-2' : ''}>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-neutral-700 mb-1">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 4 chars"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="auth-phone" className="block text-xs font-semibold text-neutral-700 mb-1">
                      Phone
                    </label>
                    <input
                      id="auth-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+880 1711-0000"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="auth-blood" className="block text-xs font-semibold text-neutral-700 mb-1">
                      Blood Group
                    </label>
                    <select
                      id="auth-blood"
                      value={bloodType}
                      onChange={(e) => setBloodType(e.target.value as BloodType)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none"
                    >
                      {BLOOD_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="auth-hub" className="text-xs font-semibold text-neutral-700">
                      City Area
                    </label>
                    <button
                      type="button"
                      onClick={detectLiveGps}
                      className="text-[11px] font-bold text-[#DC1423] inline-flex items-center gap-1 hover:underline"
                    >
                      <LocateFixed className="w-3 h-3" />
                      <span>
                        {gpsLoading
                          ? 'Locating...'
                          : gpsCoords
                          ? `GPS Ready (${gpsCoords.lat.toFixed(2)}, ${gpsCoords.lng.toFixed(2)})`
                          : 'Use Live GPS'}
                      </span>
                    </button>
                  </div>
                  <select
                    id="auth-hub"
                    value={hubIdx}
                    onChange={(e) => setHubIdx(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none"
                  >
                    {DHAKA_HUBS.map((h, i) => (
                      <option key={h.label} value={i}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>

                {(selectedRole === 'hospital' || selectedRole === 'government') && (
                  <div>
                    <label htmlFor="auth-hospital-name" className="block text-xs font-semibold text-neutral-700 mb-1">
                      {selectedRole === 'government'
                        ? 'Government Authority / EPI Center'
                        : 'Hospital / Bank Name'}
                    </label>
                    <input
                      id="auth-hospital-name"
                      type="text"
                      required
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      placeholder={
                        selectedRole === 'government'
                          ? 'DGHS / City EPI Tika Center'
                          : 'City General Blood Bank'
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none"
                    />
                  </div>
                )}

                {selectedRole === 'rider' && (
                  <div>
                    <label htmlFor="auth-vehicle" className="block text-xs font-semibold text-neutral-700 mb-1">
                      Vehicle Type
                    </label>
                    <select
                      id="auth-vehicle"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#F6F6F8] border border-transparent focus:border-[#DC1423] focus:bg-white text-sm focus:outline-none"
                    >
                      <option value="Cold-Box Motorcycle">Cold-Box Motorcycle</option>
                      <option value="Rapid Ambulance Van">Rapid Ambulance Van</option>
                      <option value="Medical E-Bike">Medical E-Bike</option>
                    </select>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl bg-[#DC1423] hover:bg-[#B9101D] text-white font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <span>
                {loading
                  ? 'Opening App...'
                  : mode === 'signup'
                  ? `Continue as ${ROLE_OPTIONS.find((r) => r.role === selectedRole)?.title}`
                  : 'Sign In'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
