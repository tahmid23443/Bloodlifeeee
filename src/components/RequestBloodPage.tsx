import { useState, type FormEvent } from 'react';
import { ArrowLeft, Crosshair, LocateFixed, Minus, Plus } from 'lucide-react';
import { BLOOD_TYPES } from '../shared/bloodLogic';
import type { BloodType, UrgencyLevel, UserProfile } from '../types';
import type { LiveGeoCoords } from '../utils/useLiveLocation';

interface RequestBloodPageProps {
  currentUser: UserProfile;
  liveCoords?: LiveGeoCoords | null;
  pickedCoords: { lat: number; lng: number };
  onUseLiveLocation?: () => void;
  onRequestMapPick: () => void;
  onSubmitRequest: (payload: {
    blood_type: BloodType;
    units: number;
    urgency: UrgencyLevel;
    dropoff_address: string;
    dropoff_lat: number;
    dropoff_lng: number;
    notes: string;
  }) => Promise<void>;
  onBack: () => void;
}

export function RequestBloodPage({
  currentUser,
  liveCoords,
  pickedCoords,
  onUseLiveLocation,
  onRequestMapPick,
  onSubmitRequest,
  onBack,
}: RequestBloodPageProps) {
  const [reqBloodType, setReqBloodType] = useState<BloodType>(currentUser.blood_type || 'A+');
  const [reqUnits, setReqUnits] = useState(1);
  const [reqUrgency, setReqUrgency] = useState<UrgencyLevel>('critical');
  const [reqAddress, setReqAddress] = useState(currentUser.address || 'Road 27, Dhanmondi, Dhaka');
  const [reqNotes, setReqNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!reqAddress.trim()) {
      setError('Please enter a delivery hospital or ward address.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitRequest({
        blood_type: reqBloodType,
        units: reqUnits,
        urgency: reqUrgency,
        dropoff_address: reqAddress.trim(),
        dropoff_lat: pickedCoords.lat,
        dropoff_lng: pickedCoords.lng,
        notes: reqNotes.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create blood request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4 sm:px-0 pb-8">
      {/* Native Top Bar */}
      <div className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[#141417] hover:bg-neutral-50 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display font-bold text-lg text-[#141417]">Request Blood</h1>
          <p className="text-xs text-neutral-500">Alerts nearby hospitals & compatible donors</p>
        </div>
      </div>

      <form
        id="needer-blood-form"
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 space-y-5"
      >
        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 text-xs font-medium text-[#DC1423]">
            {error}
          </div>
        )}

        <div>
          <span className="block text-xs font-semibold text-neutral-700 mb-2.5">
            Blood Group Needed
          </span>
          <div className="grid grid-cols-4 gap-2.5">
            {BLOOD_TYPES.map((bt) => (
              <button
                key={bt}
                type="button"
                onClick={() => setReqBloodType(bt)}
                className={`py-3 rounded-2xl text-sm font-bold transition-colors min-h-[48px] ${
                  reqBloodType === bt
                    ? 'bg-[#DC1423] text-white'
                    : 'bg-[#F6F6F8] text-[#141417] hover:bg-neutral-200'
                }`}
              >
                {bt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="req-units" className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Units Required
            </label>
            <div className="flex items-center justify-between bg-[#F6F6F8] rounded-2xl px-2 h-12">
              <button
                type="button"
                aria-label="Decrease units"
                onClick={() => setReqUnits((u) => Math.max(1, u - 1))}
                className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-2xs"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span id="req-units" className="font-display font-bold text-sm tabular-nums">
                {reqUnits} unit{reqUnits > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                aria-label="Increase units"
                onClick={() => setReqUnits((u) => Math.min(8, u + 1))}
                className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-2xs"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="req-urgency" className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Urgency
            </label>
            <select
              id="req-urgency"
              value={reqUrgency}
              onChange={(e) => setReqUrgency(e.target.value as UrgencyLevel)}
              className="w-full h-12 px-3.5 rounded-2xl bg-[#F6F6F8] text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
            >
              <option value="critical">Critical (Now)</option>
              <option value="urgent">Urgent (1h)</option>
              <option value="standard">Standard</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label htmlFor="req-address" className="text-xs font-semibold text-neutral-700">
              Delivery Location
            </label>
            <div className="flex items-center gap-3">
              {onUseLiveLocation && (
                <button
                  type="button"
                  onClick={onUseLiveLocation}
                  className="text-xs font-bold text-[#141417] hover:text-[#DC1423] flex items-center gap-1"
                >
                  <LocateFixed className="w-3.5 h-3.5 text-[#DC1423]" />
                  <span>{liveCoords ? 'Use Live GPS' : 'Detect GPS'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onRequestMapPick}
                className="text-xs font-bold text-[#DC1423] flex items-center gap-1"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Pick on Map</span>
              </button>
            </div>
          </div>
          <input
            id="req-address"
            type="text"
            required
            value={reqAddress}
            onChange={(e) => setReqAddress(e.target.value)}
            placeholder="Hospital Ward or Home Address"
            className="w-full px-4 py-3 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
          />
          <p className="text-[11px] text-neutral-400 mt-1 tabular-nums">
            Coordinates: {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
            {liveCoords ? ' · Live GPS ready' : ''}
          </p>
        </div>

        <div>
          <label htmlFor="req-notes" className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Patient / Ward Notes (Optional)
          </label>
          <input
            id="req-notes"
            type="text"
            value={reqNotes}
            onChange={(e) => setReqNotes(e.target.value)}
            placeholder="e.g. ICU Bed 4, ask for Dr. Karim"
            className="w-full px-4 py-3 rounded-2xl bg-[#F6F6F8] text-sm focus:outline-none focus:ring-1 focus:ring-[#DC1423]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-13 rounded-2xl bg-[#DC1423] hover:bg-[#B9101D] text-white font-display font-bold text-sm transition-colors disabled:opacity-50"
        >
          {submitting ? 'Broadcasting Request...' : 'Request Blood Dispatch'}
        </button>
      </form>
    </div>
  );
}
