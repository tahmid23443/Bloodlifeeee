import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Crosshair,
  LocateFixed,
  MapPin,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  Syringe,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { rankTikaCampaigns } from '../shared/bloodLogic';
import type {
  TikaCampaign,
  TikaCampaignStatus,
  TikaRegistration,
  TikaRegistrationStatus,
  UserProfile,
} from '../types';
import type { LiveGeoCoords } from '../utils/useLiveLocation';

interface TikaCarePageProps {
  currentUser: UserProfile;
  campaigns: TikaCampaign[];
  registrations: TikaRegistration[];
  liveCoords: LiveGeoCoords | null;
  pickedCoords: { lat: number; lng: number };
  onUseLiveLocation: () => void;
  onRequestMapPick: () => void;
  onCreateCampaign: (payload: {
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
  }) => Promise<void>;
  onUpdateCampaignStatus: (campaignId: string, status: TikaCampaignStatus) => Promise<void>;
  onCreateRegistration: (payload: {
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
  }) => Promise<void>;
  onUpdateRegistrationStatus: (
    regId: string,
    status: TikaRegistrationStatus
  ) => Promise<void>;
  onViewOnMap: () => void;
  onBack: () => void;
}

const VACCINE_PRESETS = [
  'BCG / EPI',
  'Measles-Rubella (MR)',
  'HPV Cervical',
  'Typhoid TCV',
  'Tetanus (TT)',
  'COVID-19 Booster',
];

const TARGET_GROUPS = [
  'All Citizens',
  'Children 0-5y',
  'Adolescent Girls (10-14y)',
  'Pregnant Mothers',
  'Adults / Seniors (50+)',
];

const TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '11:00 AM - 01:00 PM',
  '02:00 PM - 04:00 PM',
];

export function TikaCarePage({
  currentUser,
  campaigns,
  registrations,
  liveCoords,
  pickedCoords,
  onUseLiveLocation,
  onRequestMapPick,
  onCreateCampaign,
  onUpdateCampaignStatus,
  onCreateRegistration,
  onUpdateRegistrationStatus,
  onViewOnMap,
  onBack,
}: TikaCarePageProps) {
  const isGov = currentUser.role === 'government';

  // Government tab state
  const [govTab, setGovTab] = useState<'campaigns' | 'launch' | 'queue'>('campaigns');
  // Citizen tab state
  const [citizenTab, setCitizenTab] = useState<'drives' | 'cards'>('drives');

  const [searchQuery, setSearchQuery] = useState('');
  const [targetFilter, setTargetFilter] = useState<string>('ALL');
  const [queueFilterStatus, setQueueFilterStatus] = useState<string>('ALL');
  const [error, setError] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Government launch campaign form state
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [title, setTitle] = useState('');
  const [vaccineName, setVaccineName] = useState('Measles-Rubella (MR)');
  const [targetGroup, setTargetGroup] = useState('Children 0-5y');
  const [doseSchedule, setDoseSchedule] = useState('Single Dose + Booster');
  const [totalSlots, setTotalSlots] = useState(250);
  const [venueName, setVenueName] = useState(currentUser.hospital_name || '');
  const [venueAddress, setVenueAddress] = useState(currentUser.address || '');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(nextWeekStr);
  const [description, setDescription] = useState('');
  const [homeVisitAvailable, setHomeVisitAvailable] = useState(true);
  const [launching, setLaunching] = useState(false);

  // Citizen booking modal state
  const [bookingCampaign, setBookingCampaign] = useState<TikaCampaign | null>(null);
  const [benName, setBenName] = useState(currentUser.name || '');
  const [benAge, setBenAge] = useState<number>(24);
  const [nidOrBrn, setNidOrBrn] = useState('');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [doseNumber, setDoseNumber] = useState(1);
  const [deliveryMode, setDeliveryMode] = useState<'camp' | 'home_visit'>('camp');
  const [benAddress, setBenAddress] = useState(currentUser.address || '');
  const [preferredDate, setPreferredDate] = useState(todayStr);
  const [preferredSlot, setPreferredSlot] = useState(TIME_SLOTS[0]);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    if (!bookingCampaign) return;
    setBenName(currentUser.name || '');
    setPhone(currentUser.phone || '');
    setBenAddress(currentUser.address || '');
    setDeliveryMode('camp');
    setPreferredDate(bookingCampaign.start_date || todayStr);
    setBookingError('');
  }, [bookingCampaign, currentUser.address, currentUser.name, currentUser.phone, todayStr]);

  const refLat = liveCoords?.lat ?? currentUser.lat;
  const refLng = liveCoords?.lng ?? currentUser.lng;

  const myGovCampaigns = campaigns.filter((c) => c.gov_user_id === currentUser.id);
  const rankedCitizenCampaigns = rankTikaCampaigns(campaigns, refLat, refLng).filter(({ campaign }) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesQ =
      !q ||
      campaign.title.toLowerCase().includes(q) ||
      campaign.vaccine_name.toLowerCase().includes(q) ||
      campaign.venue_name.toLowerCase().includes(q) ||
      campaign.venue_address.toLowerCase().includes(q);
    const matchesTarget = targetFilter === 'ALL' || campaign.target_group === targetFilter;
    return matchesQ && matchesTarget;
  });

  async function handleLaunchSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim() || !vaccineName.trim() || !venueName.trim() || !venueAddress.trim()) {
      setError('Please complete campaign title, vaccine name, venue name, and address.');
      return;
    }
    setLaunching(true);
    try {
      await onCreateCampaign({
        title: title.trim(),
        vaccine_name: vaccineName.trim(),
        target_group: targetGroup,
        dose_schedule: doseSchedule.trim() || 'Standard EPI Dose',
        total_slots: Number(totalSlots) || 100,
        venue_name: venueName.trim(),
        venue_address: venueAddress.trim(),
        lat: pickedCoords.lat,
        lng: pickedCoords.lng,
        start_date: startDate,
        end_date: endDate,
        description: description.trim(),
        home_visit_available: homeVisitAvailable,
      });
      setTitle('');
      setDescription('');
      setGovTab('campaigns');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch Tika campaign');
    } finally {
      setLaunching(false);
    }
  }

  async function handleBookingSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bookingCampaign) return;
    setBookingError('');
    if (!benName.trim() || !nidOrBrn.trim() || !phone.trim() || !benAddress.trim()) {
      setBookingError('Please enter beneficiary name, NID/Birth Reg No., phone, and address.');
      return;
    }
    setBookingBusy(true);
    try {
      await onCreateRegistration({
        campaign_id: bookingCampaign.id,
        beneficiary_name: benName.trim(),
        beneficiary_age: Number(benAge) || 0,
        nid_or_brn: nidOrBrn.trim(),
        phone: phone.trim(),
        dose_number: doseNumber,
        delivery_mode: deliveryMode,
        address: benAddress.trim(),
        lat: refLat,
        lng: refLng,
        preferred_date: preferredDate,
        preferred_slot: preferredSlot,
      });
      setBookingCampaign(null);
      setNidOrBrn('');
      setCitizenTab('cards');
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Unable to book Tika slot');
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleStatusAction(regId: string, nextStatus: TikaRegistrationStatus) {
    setActionBusyId(regId);
    setError('');
    try {
      await onUpdateRegistrationStatus(regId, nextStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update registration');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleCampaignToggle(c: TikaCampaign) {
    setActionBusyId(c.id);
    setError('');
    try {
      await onUpdateCampaignStatus(c.id, c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign status');
    } finally {
      setActionBusyId(null);
    }
  }

  const totalRegistered = myGovCampaigns.reduce((sum, c) => sum + c.registered_count, 0);
  const totalVaccinated = myGovCampaigns.reduce((sum, c) => sum + c.vaccinated_count, 0);
  const activeGovDrives = myGovCampaigns.filter((c) => c.status === 'ACTIVE').length;

  const filteredGovQueue = registrations.filter((reg) => {
    if (queueFilterStatus !== 'ALL' && reg.status !== queueFilterStatus) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      reg.beneficiary_name.toLowerCase().includes(q) ||
      reg.tika_card_code.toLowerCase().includes(q) ||
      (reg.vaccine_name || '').toLowerCase().includes(q) ||
      reg.nid_or_brn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-0 pb-10 space-y-5">
      {/* Native Top Bar */}
      <div className="flex items-center justify-between gap-3 pt-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to home"
            className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[#141417] hover:bg-neutral-50 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg text-[#141417] truncate">
              {isGov ? 'Govt Tika Care Console' : 'Govt Tika Care'}
            </h1>
            <p className="text-xs text-neutral-500 truncate">
              {isGov
                ? 'Launch official immunization drives & verify digital Tika cards'
                : 'Book official vaccines nearby or request doorstep Tika visits'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewOnMap}
          className="px-3.5 py-2.5 rounded-2xl bg-white border border-neutral-200 hover:border-[#DC1423] text-xs font-bold text-[#141417] flex items-center gap-1.5 shrink-0 min-h-[44px]"
        >
          <MapPin className="w-4 h-4 text-[#DC1423]" />
          <span>Camp Map</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3.5 rounded-2xl bg-red-50 text-xs font-semibold text-[#DC1423]">
          {error}
        </div>
      )}

      {/* GOVERNMENT IMMUNIZATION CONSOLE */}
      {isGov ? (
        <>
          {/* Live Gov KPI Strip */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-white rounded-2xl border border-neutral-200 p-3.5">
              <div className="text-[11px] font-semibold text-neutral-500">Active Drives</div>
              <div className="font-display font-extrabold text-xl text-[#141417] tabular-nums mt-0.5">
                {activeGovDrives}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-3.5">
              <div className="text-[11px] font-semibold text-neutral-500">Booked Citizens</div>
              <div className="font-display font-extrabold text-xl text-[#DC1423] tabular-nums mt-0.5">
                {totalRegistered}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-neutral-200 p-3.5">
              <div className="text-[11px] font-semibold text-neutral-500">Doses Given</div>
              <div className="font-display font-extrabold text-xl text-[#141417] tabular-nums mt-0.5">
                {totalVaccinated}
              </div>
            </div>
          </div>

          {/* Segmented Tabs */}
          <div className="bg-white p-1.5 rounded-2xl border border-neutral-200 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setGovTab('campaigns')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-colors min-h-[42px] ${
                govTab === 'campaigns' ? 'bg-[#DC1423] text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              My Campaigns ({myGovCampaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setGovTab('launch')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-colors min-h-[42px] flex items-center justify-center gap-1 ${
                govTab === 'launch' ? 'bg-[#DC1423] text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Launch Drive</span>
            </button>
            <button
              type="button"
              onClick={() => setGovTab('queue')}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-colors min-h-[42px] ${
                govTab === 'queue' ? 'bg-[#DC1423] text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              Beneficiaries ({registrations.length})
            </button>
          </div>

          {/* TAB 1: MY CAMPAIGNS */}
          {govTab === 'campaigns' && (
            <div className="space-y-3">
              {myGovCampaigns.length === 0 ? (
                <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#DC1423] flex items-center justify-center mx-auto">
                    <Syringe className="w-6 h-6" />
                  </div>
                  <h2 className="font-display font-bold text-base text-[#141417]">
                    No Tika campaigns launched yet
                  </h2>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Create an official government immunization drive to pin vaccination booths on the Red & White map and notify nearby citizens.
                  </p>
                  <button
                    type="button"
                    onClick={() => setGovTab('launch')}
                    className="px-5 py-3 rounded-2xl bg-[#DC1423] hover:bg-[#B9101D] text-white text-xs font-bold inline-flex items-center gap-2 min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Launch First Tika Drive</span>
                  </button>
                </div>
              ) : (
                myGovCampaigns.map((camp) => {
                  const pct =
                    camp.total_slots > 0
                      ? Math.min(100, Math.round((camp.registered_count / camp.total_slots) * 100))
                      : 0;
                  return (
                    <div
                      key={camp.id}
                      className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-[#DC1423]">
                            {camp.vaccine_name} · {camp.target_group} · {camp.status}
                          </div>
                          <h3 className="font-display font-bold text-base text-[#141417] mt-0.5">
                            {camp.title}
                          </h3>
                          <p className="text-xs text-neutral-500 mt-1">
                            {camp.venue_name} · {camp.venue_address}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={actionBusyId === camp.id}
                          onClick={() => handleCampaignToggle(camp)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 min-h-[40px] border transition-colors ${
                            camp.status === 'ACTIVE'
                              ? 'border-neutral-200 text-[#141417] hover:bg-neutral-50'
                              : 'bg-[#DC1423] border-[#DC1423] text-white'
                          }`}
                        >
                          {camp.status === 'ACTIVE' ? (
                            <>
                              <PauseCircle className="w-4 h-4 text-[#DC1423]" />
                              <span>Pause Drive</span>
                            </>
                          ) : (
                            <>
                              <PlayCircle className="w-4 h-4" />
                              <span>Resume Drive</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs tabular-nums">
                          <span className="font-semibold text-neutral-700">
                            {camp.registered_count} / {camp.total_slots} slots booked · {camp.vaccinated_count} vaccinated
                          </span>
                          <span className="font-bold text-[#DC1423]">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#DC1423]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 pt-1 border-t border-neutral-100">
                        <span className="tabular-nums">
                          {camp.start_date} to {camp.end_date} · {camp.dose_schedule}
                        </span>
                        <span>
                          {camp.home_visit_available ? 'Camp + Doorstep Visit' : 'Camp Booth Only'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: LAUNCH NEW GOVERNMENT TIKA CAMPAIGN */}
          {govTab === 'launch' && (
            <form
              id="gov-tika-launch-form"
              onSubmit={handleLaunchSubmit}
              className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 space-y-4"
            >
              <div>
                <h2 className="font-display font-bold text-base text-[#141417]">
                  Publish Official Tika Campaign
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Broadcasts immediately to citizens on the map and Tika Care directory.
                </p>
              </div>

              <div>
                <label htmlFor="tika-title" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Campaign Title
                </label>
                <input
                  id="tika-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. National Measles-Rubella Tika Drive"
                  className="w-full px-4 py-3 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                />
              </div>

              <div>
                <span className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Vaccine Type
                </span>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {VACCINE_PRESETS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVaccineName(v)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        vaccineName === v
                          ? 'bg-[#DC1423] text-white'
                          : 'bg-[#F6F6F8] text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Custom vaccine name"
                  type="text"
                  required
                  value={vaccineName}
                  onChange={(e) => setVaccineName(e.target.value)}
                  placeholder="Vaccine name"
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="tika-target" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Target Beneficiary Group
                  </label>
                  <select
                    id="tika-target"
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F6F8] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  >
                    {TARGET_GROUPS.map((tg) => (
                      <option key={tg} value={tg}>
                        {tg}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="tika-slots" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Available Dose Slots
                  </label>
                  <input
                    id="tika-slots"
                    type="number"
                    min={10}
                    max={50000}
                    required
                    value={totalSlots}
                    onChange={(e) => setTotalSlots(Number(e.target.value))}
                    className="w-full h-11 px-4 rounded-2xl bg-[#F6F6F8] text-sm font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="tika-venue" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Tika Booth / EPI Center Name
                  </label>
                  <input
                    id="tika-venue"
                    type="text"
                    required
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="e.g. Dhaka EPI Ward 18 Center"
                    className="w-full px-4 py-3 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>

                <div>
                  <label htmlFor="tika-schedule" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Dose Schedule
                  </label>
                  <input
                    id="tika-schedule"
                    type="text"
                    value={doseSchedule}
                    onChange={(e) => setDoseSchedule(e.target.value)}
                    placeholder="e.g. Dose 1 + 4-week Booster"
                    className="w-full px-4 py-3 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="tika-address" className="text-xs font-semibold text-neutral-700">
                    Camp Location & Coordinates
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onUseLiveLocation}
                      className="text-xs font-bold text-[#141417] hover:text-[#DC1423] inline-flex items-center gap-1"
                    >
                      <LocateFixed className="w-3.5 h-3.5 text-[#DC1423]" />
                      <span>Use Live GPS</span>
                    </button>
                    <button
                      type="button"
                      onClick={onRequestMapPick}
                      className="text-xs font-bold text-[#DC1423] inline-flex items-center gap-1"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Pick on Map</span>
                    </button>
                  </div>
                </div>
                <input
                  id="tika-address"
                  type="text"
                  required
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="Street / Sector / Municipality"
                  className="w-full px-4 py-3 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                />
                <p className="text-[11px] text-neutral-400 mt-1 tabular-nums">
                  Camp Pin: {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="tika-start" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    Start Date
                  </label>
                  <input
                    id="tika-start"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F6F8] text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>
                <div>
                  <label htmlFor="tika-end" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    End Date
                  </label>
                  <input
                    id="tika-end"
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl bg-[#F6F6F8] text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tika-desc" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Instructions / Eligibility Notes
                </label>
                <input
                  id="tika-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Bring NID or Birth Registration card. Free Govt EPI service."
                  className="w-full px-4 py-3 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                />
              </div>

              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F6F6F8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={homeVisitAvailable}
                  onChange={(e) => setHomeVisitAvailable(e.target.checked)}
                  className="w-4 h-4 accent-[#DC1423]"
                />
                <span className="text-xs font-semibold text-[#141417]">
                  Allow citizens to request mobile Home-Visit Tika team (via Live GPS)
                </span>
              </label>

              <button
                type="submit"
                disabled={launching}
                className="w-full h-13 rounded-2xl bg-[#DC1423] hover:bg-[#B9101D] text-white font-display font-bold text-sm transition-colors disabled:opacity-50"
              >
                {launching ? 'Publishing Tika Campaign...' : 'Publish Official Tika Drive'}
              </button>
            </form>
          )}

          {/* TAB 3: BENEFICIARY REGISTRATION QUEUE */}
          {govTab === 'queue' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px] bg-white rounded-2xl border border-neutral-200 px-3.5 h-11 flex items-center gap-2">
                  <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search beneficiary, NID, or TIKA code"
                    className="w-full text-xs bg-transparent focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Filter registration status"
                  value={queueFilterStatus}
                  onChange={(e) => setQueueFilterStatus(e.target.value)}
                  className="h-11 px-3 rounded-2xl bg-white border border-neutral-200 text-xs font-bold text-[#141417]"
                >
                  <option value="ALL">All Status</option>
                  <option value="REGISTERED">Pending Confirm</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="VACCINATED">Vaccinated</option>
                </select>
              </div>

              {filteredGovQueue.length === 0 ? (
                <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center text-xs text-neutral-500">
                  No citizen Tika registrations match this filter yet.
                </div>
              ) : (
                filteredGovQueue.map((reg) => (
                  <div
                    key={reg.id}
                    className="bg-white rounded-3xl border border-neutral-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                        <span className="text-[#DC1423] font-mono">{reg.tika_card_code}</span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-neutral-700">{reg.status}</span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-neutral-500">
                          {reg.delivery_mode === 'home_visit' ? 'Home Visit GPS' : 'Camp Booth'}
                        </span>
                      </div>
                      <div className="font-display font-bold text-base text-[#141417]">
                        {reg.beneficiary_name} ({reg.beneficiary_age}y)
                      </div>
                      <div className="text-xs text-neutral-500 tabular-nums">
                        {reg.vaccine_name} · Dose {reg.dose_number} · {reg.preferred_date} ({reg.preferred_slot})
                      </div>
                      <div className="text-xs text-neutral-500 truncate">
                        NID/BRN: {reg.nid_or_brn} · {reg.phone} · {reg.address}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {reg.status === 'REGISTERED' && (
                        <button
                          type="button"
                          disabled={actionBusyId === reg.id}
                          onClick={() => handleStatusAction(reg.id, 'CONFIRMED')}
                          className="px-3.5 py-2.5 rounded-xl border border-[#DC1423] text-[#DC1423] hover:bg-red-50 text-xs font-bold min-h-[42px]"
                        >
                          Confirm Slot
                        </button>
                      )}
                      {(reg.status === 'REGISTERED' || reg.status === 'CONFIRMED') && (
                        <button
                          type="button"
                          disabled={actionBusyId === reg.id}
                          onClick={() => handleStatusAction(reg.id, 'VACCINATED')}
                          className="px-4 py-2.5 rounded-xl bg-[#DC1423] hover:bg-[#B9101D] text-white text-xs font-bold flex items-center gap-1.5 min-h-[42px]"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Mark Vaccinated</span>
                        </button>
                      )}
                      {reg.status === 'VACCINATED' && (
                        <span className="text-xs font-bold text-[#141417] flex items-center gap-1">
                          <ShieldCheck className="w-4 h-4 text-[#DC1423]" />
                          Verified Dose
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        /* CITIZEN / DONOR / RIDER / HOSPITAL TIKA CARE VIEW */
        <>
          <div className="bg-white p-1.5 rounded-2xl border border-neutral-200 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setCitizenTab('drives')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-colors min-h-[42px] ${
                citizenTab === 'drives' ? 'bg-[#DC1423] text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              Active Govt Drives ({rankedCitizenCampaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setCitizenTab('cards')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-colors min-h-[42px] ${
                citizenTab === 'cards' ? 'bg-[#DC1423] text-white' : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              My Digital Tika Cards ({registrations.length})
            </button>
          </div>

          {citizenTab === 'drives' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px] bg-white rounded-2xl border border-neutral-200 px-3.5 h-11 flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#DC1423] shrink-0" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search vaccine, area, or Tika booth"
                    className="w-full text-xs bg-transparent focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Filter target group"
                  value={targetFilter}
                  onChange={(e) => setTargetFilter(e.target.value)}
                  className="h-11 px-3 rounded-2xl bg-white border border-neutral-200 text-xs font-bold text-[#141417]"
                >
                  <option value="ALL">All Groups</option>
                  {TARGET_GROUPS.map((tg) => (
                    <option key={tg} value={tg}>
                      {tg}
                    </option>
                  ))}
                </select>
              </div>

              {rankedCitizenCampaigns.length === 0 ? (
                <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#DC1423] flex items-center justify-center mx-auto">
                    <Syringe className="w-6 h-6" />
                  </div>
                  <h2 className="font-display font-bold text-base text-[#141417]">
                    No active Govt Tika drives right now
                  </h2>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Official government health centers can sign up as Govt Tika Care to publish vaccination camps here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rankedCitizenCampaigns.map(({ campaign, distanceKm, remainingSlots }) => (
                    <div
                      key={campaign.id}
                      className="bg-white rounded-3xl border border-neutral-200 p-5 space-y-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-[#DC1423] flex flex-wrap items-center gap-1.5">
                            <span>{campaign.vaccine_name}</span>
                            <span className="text-neutral-300">·</span>
                            <span className="text-neutral-600">{campaign.target_group}</span>
                            <span className="text-neutral-300">·</span>
                            <span className="tabular-nums text-[#141417]">{distanceKm} km away</span>
                          </div>
                          <h3 className="font-display font-bold text-base text-[#141417] mt-1">
                            {campaign.title}
                          </h3>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {campaign.venue_name} · {campaign.venue_address}
                          </p>
                        </div>

                        <div className="text-right shrink-0 tabular-nums">
                          <div className="font-display font-extrabold text-sm text-[#DC1423]">
                            {remainingSlots} slots left
                          </div>
                          <div className="text-[11px] text-neutral-400">of {campaign.total_slots}</div>
                        </div>
                      </div>

                      {campaign.description && (
                        <p className="text-xs text-neutral-600 leading-relaxed">{campaign.description}</p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-100">
                        <div className="text-[11px] text-neutral-500 flex items-center gap-2 tabular-nums">
                          <Calendar className="w-3.5 h-3.5 text-[#DC1423]" />
                          <span>
                            {campaign.start_date} – {campaign.end_date} ·{' '}
                            {campaign.home_visit_available ? 'Camp & Home Visit' : 'Camp Only'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={onViewOnMap}
                            className="px-3 py-2 rounded-xl border border-neutral-200 text-xs font-bold text-[#141417] hover:bg-neutral-50 min-h-[40px]"
                          >
                            Map
                          </button>
                          <button
                            type="button"
                            disabled={remainingSlots <= 0}
                            onClick={() => setBookingCampaign(campaign)}
                            className="px-4 py-2 rounded-xl bg-[#DC1423] hover:bg-[#B9101D] text-white text-xs font-bold min-h-[40px] disabled:opacity-40"
                          >
                            {remainingSlots > 0 ? 'Book Tika Slot' : 'Full'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {citizenTab === 'cards' && (
            <div className="space-y-3">
              {registrations.length === 0 ? (
                <div className="bg-white rounded-3xl border border-neutral-200 p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#DC1423] flex items-center justify-center mx-auto">
                    <Ticket className="w-6 h-6" />
                  </div>
                  <h2 className="font-display font-bold text-base text-[#141417]">
                    No Digital Tika Cards yet
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Book a vaccination slot from Active Govt Drives to generate your official digital Tika card.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCitizenTab('drives')}
                    className="px-5 py-2.5 rounded-2xl bg-[#DC1423] text-white text-xs font-bold min-h-[44px]"
                  >
                    Browse Govt Tika Drives
                  </button>
                </div>
              ) : (
                registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="bg-white rounded-3xl border-2 border-[#DC1423]/25 overflow-hidden shadow-xs"
                  >
                    {/* Red & White Official Tika Card Header */}
                    <div className="bg-[#DC1423] text-white px-5 py-3.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/85">
                          Government Tika Card
                        </div>
                        <div className="font-mono font-extrabold text-sm tracking-wide mt-0.5">
                          {reg.tika_card_code}
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-xl bg-white text-[#DC1423] text-xs font-extrabold">
                        {reg.status}
                      </span>
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-display font-bold text-base text-[#141417]">
                            {reg.beneficiary_name} · Age {reg.beneficiary_age}
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            {reg.campaign_title} · {reg.vaccine_name} (Dose {reg.dose_number})
                          </div>
                        </div>
                        <div className="sm:text-right text-xs tabular-nums">
                          <div className="font-bold text-[#141417]">{reg.preferred_date}</div>
                          <div className="text-neutral-500">{reg.preferred_slot}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-100 text-xs text-neutral-600">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#DC1423] shrink-0" />
                          <span className="truncate">NID/BRN: {reg.nid_or_brn}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#DC1423] shrink-0" />
                          <span className="truncate">
                            {reg.delivery_mode === 'home_visit'
                              ? `Home Visit: ${reg.address}`
                              : reg.venue_name || reg.address}
                          </span>
                        </div>
                      </div>

                      {reg.status === 'VACCINATED' && reg.administered_at && (
                        <div className="p-2.5 rounded-xl bg-red-50 text-[#DC1423] text-xs font-bold flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>Dose verified & administered ({reg.administered_at.slice(0, 10)})</span>
                        </div>
                      )}

                      {(reg.status === 'REGISTERED' || reg.status === 'CONFIRMED') && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            disabled={actionBusyId === reg.id}
                            onClick={() => handleStatusAction(reg.id, 'CANCELLED')}
                            className="px-3.5 py-2 rounded-xl bg-[#F6F6F8] hover:bg-red-50 hover:text-[#DC1423] text-xs font-bold text-neutral-700"
                          >
                            Cancel Slot
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* CITIZEN SLOT BOOKING MODAL */}
      {bookingCampaign && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Book Tika Vaccination Slot"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold text-[#DC1423]">
                  {bookingCampaign.vaccine_name} · {bookingCampaign.venue_name}
                </div>
                <h2 className="font-display font-bold text-lg text-[#141417]">
                  Book Tika Slot
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close booking modal"
                onClick={() => setBookingCampaign(null)}
                className="w-10 h-10 rounded-full bg-[#F6F6F8] flex items-center justify-center text-neutral-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bookingError && (
              <div role="alert" className="p-3 rounded-xl bg-red-50 text-xs font-semibold text-[#DC1423]">
                {bookingError}
              </div>
            )}

            <form onSubmit={handleBookingSubmit} className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor="ben-name" className="block text-xs font-semibold text-neutral-700 mb-1">
                    Beneficiary Name
                  </label>
                  <input
                    id="ben-name"
                    type="text"
                    required
                    value={benName}
                    onChange={(e) => setBenName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>
                <div>
                  <label htmlFor="ben-age" className="block text-xs font-semibold text-neutral-700 mb-1">
                    Age
                  </label>
                  <input
                    id="ben-age"
                    type="number"
                    min={0}
                    max={120}
                    required
                    value={benAge}
                    onChange={(e) => setBenAge(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6F6F8] text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ben-nid" className="block text-xs font-semibold text-neutral-700 mb-1">
                    NID / Birth Reg No.
                  </label>
                  <input
                    id="ben-nid"
                    type="text"
                    required
                    value={nidOrBrn}
                    onChange={(e) => setNidOrBrn(e.target.value)}
                    placeholder="e.g. 1999123456789"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6F6F8] text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>
                <div>
                  <label htmlFor="ben-phone" className="block text-xs font-semibold text-neutral-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    id="ben-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ben-dose" className="block text-xs font-semibold text-neutral-700 mb-1">
                    Dose Number
                  </label>
                  <select
                    id="ben-dose"
                    value={doseNumber}
                    onChange={(e) => setDoseNumber(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-2xl bg-[#F6F6F8] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  >
                    <option value={1}>Dose 1</option>
                    <option value={2}>Dose 2</option>
                    <option value={3}>Dose 3 (Booster)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ben-date" className="block text-xs font-semibold text-neutral-700 mb-1">
                    Preferred Date
                  </label>
                  <input
                    id="ben-date"
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-2xl bg-[#F6F6F8] text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ben-slot" className="block text-xs font-semibold text-neutral-700 mb-1">
                  Time Window
                </label>
                <select
                  id="ben-slot"
                  value={preferredSlot}
                  onChange={(e) => setPreferredSlot(e.target.value)}
                  className="w-full h-11 px-3 rounded-2xl bg-[#F6F6F8] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                >
                  {TIME_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {bookingCampaign.home_visit_available === 1 && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('camp')}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-colors ${
                      deliveryMode === 'camp'
                        ? 'bg-[#DC1423] text-white border-[#DC1423]'
                        : 'bg-[#F6F6F8] text-[#141417] border-transparent'
                    }`}
                  >
                    Camp Booth Visit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMode('home_visit');
                      onUseLiveLocation();
                    }}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-colors ${
                      deliveryMode === 'home_visit'
                        ? 'bg-[#DC1423] text-white border-[#DC1423]'
                        : 'bg-[#F6F6F8] text-[#141417] border-transparent'
                    }`}
                  >
                    Home Visit (Live GPS)
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="ben-address" className="block text-xs font-semibold text-neutral-700 mb-1">
                  {deliveryMode === 'home_visit' ? 'Home Visit Address' : 'Citizen Address'}
                </label>
                <input
                  id="ben-address"
                  type="text"
                  required
                  value={benAddress}
                  onChange={(e) => setBenAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
                />
              </div>

              <button
                type="submit"
                disabled={bookingBusy}
                className="w-full h-12 rounded-2xl bg-[#DC1423] hover:bg-[#B9101D] text-white font-display font-bold text-sm transition-colors disabled:opacity-50"
              >
                {bookingBusy ? 'Generating Digital Tika Card...' : 'Confirm Booking & Get Tika Card'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
