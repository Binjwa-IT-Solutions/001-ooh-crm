"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  ArrowUpRight,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { api } from "@/shared/api/client";

export interface AppNotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  readAt?: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function fetchNotifications() {
    try {
      const res = await api.get<NotificationsResponse>("/api/notifications?limit=15");
      if (res) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Best-effort silent catch
    }
  }

  useEffect(() => {
    fetchNotifications();

    // Auto-poll every 30 seconds for live notification updates
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  async function handleMarkRead(id: string, link?: string) {
    try {
      await api.post(`/api/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }

    if (link) {
      setOpen(false);
      router.push(link);
    }
  }

  async function handleMarkAllRead() {
    setLoading(true);
    try {
      await api.post("/api/notifications/read-all", {});
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function formatTimeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="View notifications"
        className="relative -m-2.5 p-2.5 text-[#687280] hover:text-[#1F2937] rounded-full border border-[#E6E8EC] shadow-sm ml-2 h-10 w-10 flex items-center justify-center transition-colors cursor-pointer hover:bg-slate-50 focus:outline-none"
      >
        <Bell className="h-5 w-5 text-gray-700" />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8B2424] px-1 text-[11px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-gray-200 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#F9DADA] px-2 py-0.5 text-xs font-semibold text-[#8B2424]">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="flex items-center gap-1 text-xs font-semibold text-[#8B2424] hover:underline disabled:opacity-50 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-2">
                  <Check className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-gray-900">
                  No notifications
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  You're all caught up!
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.readAt;
                const isEscalation = n.type.includes("escalat");

                return (
                  <div
                    key={n._id}
                    onClick={() => handleMarkRead(n._id, n.link)}
                    className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${
                      isUnread
                        ? "bg-[#FFF8F8] hover:bg-[#FFF0F0]"
                        : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isEscalation
                          ? "bg-gradient-to-br from-[#8B2424] to-[#A8333B] text-white shadow-xs"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {isEscalation ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs font-semibold truncate ${
                            isUnread ? "text-gray-900" : "text-gray-700"
                          }`}
                        >
                          {n.title}
                        </p>
                        {isUnread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#8B2424]" />
                        )}
                      </div>

                      {n.body && (
                        <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">
                          {n.body}
                        </p>
                      )}

                      <span className="mt-1 block text-[10px] text-gray-400 font-medium">
                        {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-2.5 text-center">
            <Link
              href="/escalations"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8B2424] hover:underline"
            >
              View all in Escalations
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

