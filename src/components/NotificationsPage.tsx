import { ArrowLeft, BellRing, CheckCheck } from 'lucide-react';
import type { AppNotification } from '../types';

interface NotificationsPageProps {
  notifications: AppNotification[];
  pushPermission: NotificationPermission | 'unsupported';
  onRequestPushPermission: () => void;
  onMarkAllRead: () => void;
  onBack: () => void;
}

export function NotificationsPage({
  notifications,
  pushPermission,
  onRequestPushPermission,
  onMarkAllRead,
  onBack,
}: NotificationsPageProps) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-0 pb-8 space-y-4">
      <div className="flex items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to home"
            className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-[#141417] hover:bg-neutral-50 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display font-bold text-lg text-[#141417]">Live Alerts</h1>
            <p className="text-xs text-neutral-500">Real-time dispatch & status push notifications</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onMarkAllRead}
          className="px-3.5 py-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 flex items-center gap-1.5 min-h-[40px]"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Mark Read</span>
        </button>
      </div>

      {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
        <div className="bg-[#DC1423] text-white rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="text-xs">
            <div className="font-bold text-sm">Enable Instant Push Notifications</div>
            <div className="text-white/85 mt-0.5">
              Get immediate alerts when a donor, hospital, or rider updates status.
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestPushPermission}
            className="px-3.5 py-2.5 rounded-xl bg-white text-[#DC1423] text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Enable</span>
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-neutral-200 divide-y divide-neutral-100 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-500">
            No notifications yet. Live blood dispatches and rider updates appear here automatically.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`px-5 py-4 ${n.is_read ? 'bg-white' : 'bg-red-50/45'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm text-[#141417]">{n.title}</p>
                {!n.is_read && (
                  <span className="text-[11px] font-bold text-[#DC1423] shrink-0">New</span>
                )}
              </div>
              <p className="text-xs text-neutral-600 mt-1 leading-relaxed">{n.body}</p>
              <p className="text-[11px] text-neutral-400 mt-1.5 tabular-nums">
                {n.type.toUpperCase()} · {n.created_at}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
