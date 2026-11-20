import { useState } from 'react';
import { ArrowLeft, Check, Droplet, LogOut } from 'lucide-react';
import type { UserProfile } from '../types';

interface DonorProfileViewProps {
  user: UserProfile;
  onToggleAvailability: () => Promise<void>;
  onBack: () => void;
  onLogout: () => void;
}

const SLIDES = [
  {
    title: 'One Drop Can Save a Life',
    subtitle:
      'Easily save lives with a tap, respond to nearby emergency requests, and coordinate with courier riders instantly.',
  },
  {
    title: 'Verified Real-Time Dispatch',
    subtitle:
      'Your live availability pairs directly with nearby hospitals and critical patients needing compatible blood units.',
  },
  {
    title: 'Direct Rider & Clinic Sync',
    subtitle:
      'Chat directly with medical courier riders and hospital blood banks for zero-delay handoff.',
  },
];

export function DonorProfileView({
  user,
  onToggleAvailability,
  onBack,
  onLogout,
}: DonorProfileViewProps) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [toggling, setToggling] = useState(false);

  async function handleAction() {
    setToggling(true);
    try {
      await onToggleAvailability();
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto bg-white rounded-3xl overflow-hidden border border-neutral-200 shadow-sm">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <clipPath id="blood-drop-clip" clipPathUnits="objectBoundingBox">
            <path d="M 0.5,0.02 C 0.7,0.23 0.96,0.42 0.96,0.63 C 0.96,0.85 0.75,0.99 0.5,0.99 C 0.25,0.99 0.04,0.85 0.04,0.63 C 0.04,0.42 0.3,0.23 0.5,0.02 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Curved Crimson Top Section (Matches Reference Screen 3) */}
      <div className="bg-[#DC1423] pt-5 pb-8 px-6 relative flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to dispatch"
            className="w-10 h-10 rounded-full bg-white text-[#141417] flex items-center justify-center shadow-sm hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Blood-Drop Masked Hero Photo */}
        <div className="w-[215px] h-[255px] flex items-center justify-center">
          <div className="w-full h-full blood-drop-mask overflow-hidden bg-red-900/30 shadow-xl">
            <img
              src="/src/assets/images/donor_clinic_hero_1794741118603.jpg"
              alt="Blood donor clinic care"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Carousel Indicator Dots */}
        <div className="flex items-center gap-2 mt-4">
          {SLIDES.map((s, idx) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Slide ${idx + 1}`}
              onClick={() => setSlideIdx(idx)}
              className={`h-2 rounded-full transition-all ${
                slideIdx === idx ? 'w-6 bg-white' : 'w-2 bg-white/45 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      </div>

      {/* White Lower Sheet */}
      <div className="px-6 pt-5 pb-6 bg-white -mt-4 rounded-t-3xl relative">
        <div className="text-center mb-4">
          <h2 className="font-display text-xl font-bold text-[#141417]">
            {user.hospital_name || user.name}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {user.role === 'government' ? 'GOVT TIKA CARE' : user.role.toUpperCase()} · {user.address} · {user.phone}
          </p>
        </div>

        {/* 3 Summary Stat Tiles */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-[#F6F6F8] rounded-2xl py-3.5 px-2 text-center">
            <div className="font-display text-xl font-bold text-[#141417] tabular-nums">
              {user.role === 'government' ? 'EPI' : user.blood_type}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {user.role === 'government' ? 'Authority' : 'Blood Type'}
            </div>
          </div>
          <div className="bg-[#F6F6F8] rounded-2xl py-3.5 px-2 text-center">
            <div className="font-display text-xl font-bold text-[#141417] tabular-nums">
              {user.donations_count}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {user.role === 'government' ? 'Verified' : 'Donate'}
            </div>
          </div>
          <div className="bg-[#F6F6F8] rounded-2xl py-3.5 px-2 text-center">
            <div className="font-display text-xl font-bold text-[#141417] tabular-nums">
              {user.requests_count}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {user.role === 'government' ? 'Drives' : 'Request'}
            </div>
          </div>
        </div>

        <div className="text-center px-2 mb-5">
          <h3 className="font-display text-xl font-bold text-[#141417] text-balance">
            {SLIDES[slideIdx].title}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1.5 leading-relaxed">
            {SLIDES[slideIdx].subtitle}
          </p>
        </div>

        {/* Full-Width Crimson CTA Bar */}
        <button
          type="button"
          disabled={toggling}
          onClick={handleAction}
          className="w-full h-14 rounded-full bg-[#DC1423] hover:bg-[#B9101D] text-white px-2.5 flex items-center justify-between transition-colors shadow-md shadow-red-600/20 disabled:opacity-60"
        >
          <span className="w-10 h-10 rounded-full bg-white text-[#DC1423] flex items-center justify-center shrink-0">
            <Droplet className="w-5 h-5 fill-[#DC1423]" />
          </span>
          <span className="font-display font-bold text-sm">
            {toggling
              ? 'Updating Status...'
              : user.is_available
              ? user.role === 'donor'
                ? 'Active & Ready to Donate'
                : user.role === 'government'
                ? 'Tika Center Active'
                : 'Online & Active'
              : user.role === 'government'
              ? 'Activate Tika Center'
              : 'Go Online / Donate Now'}
          </span>
          <span className="w-10 h-10 rounded-full bg-white text-[#DC1423] flex items-center justify-center shrink-0">
            <Check className="w-5 h-5" />
          </span>
        </button>
      </div>
    </div>
  );
}
