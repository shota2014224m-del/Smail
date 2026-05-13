"use client";
import { EmailMessage } from "@/types";

interface Props {
  emails: EmailMessage[];
  selectedId?: string;
  onSelect: (email: EmailMessage) => void;
  loading: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (threadId: string) => void;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = diff / (1000 * 60 * 60);

  if (hours < 24) {
    return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  }
  if (hours < 24 * 7) {
    return date.toLocaleDateString("ja-JP", { weekday: "short" });
  }
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export default function EmailList({ emails, selectedId, onSelect, loading, selectedIds, onToggleSelect }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg animate-pulse">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <svg className="w-16 h-16 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">メールがありません</p>
      </div>
    );
  }

  // Group by threadId, keep latest email per thread
  const threadMap = new Map<string, { latest: EmailMessage; count: number; hasUnread: boolean }>();
  for (const email of emails) {
    const key = email.threadId ?? email.id;
    const existing = threadMap.get(key);
    if (!existing) {
      threadMap.set(key, { latest: email, count: 1, hasUnread: !email.isRead });
    } else {
      const isNewer = new Date(email.date) > new Date(existing.latest.date);
      threadMap.set(key, {
        latest: isNewer ? email : existing.latest,
        count: existing.count + 1,
        hasUnread: existing.hasUnread || !email.isRead,
      });
    }
  }
  const threads = Array.from(threadMap.values()).sort(
    (a, b) => new Date(b.latest.date).getTime() - new Date(a.latest.date).getTime()
  );

  return (
    <div className="overflow-y-auto h-full">
      {threads.map(({ latest: email, count, hasUnread }) => {
        const threadKey = email.threadId ?? email.id;
        const isChecked = selectedIds?.has(threadKey) ?? false;
        return (
        <div
          key={threadKey}
          className={`flex items-start gap-2 px-3 py-3 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors group ${
            selectedId === email.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
          } ${isChecked ? "bg-blue-50" : hasUnread ? "bg-white" : "bg-gray-50"}`}
        >
          {/* Checkbox */}
          <div className="flex items-center pt-1 shrink-0">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => { e.stopPropagation(); onToggleSelect?.(threadKey); }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
            />
          </div>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 mt-0.5"
            style={{ backgroundColor: stringToColor(email.fromName ?? email.from) }}
            onClick={() => onSelect(email)}
          >
            {(email.fromName ?? email.from)[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0" onClick={() => onSelect(email)}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm truncate ${hasUnread ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                {email.fromName ?? email.from}
                {count > 1 && (
                  <span className="ml-1.5 text-xs text-gray-500 font-normal">{count}</span>
                )}
              </span>
              <span className="text-xs text-gray-600 shrink-0">{formatDate(email.date)}</span>
            </div>
            <p className={`text-sm truncate ${hasUnread ? "font-medium text-gray-900" : "text-gray-700"}`}>
              {email.subject}
            </p>
            <p className="text-xs text-gray-600 truncate">{email.snippet ?? email.body}</p>
          </div>
          {hasUnread && (
            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
          )}
        </div>
      );
      })}
    </div>
  );
}

function stringToColor(str: string): string {
  const colors = [
    "#4285F4", "#EA4335", "#34A853", "#FBBC04",
    "#FF6D00", "#7B1FA2", "#0097A7", "#C62828",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
