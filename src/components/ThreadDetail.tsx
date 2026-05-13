"use client";
import { useState, useEffect } from "react";
import { EmailMessage } from "@/types";
import ReplyComposer from "./ReplyComposer";
import ForwardComposer from "./ForwardComposer";

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface ThreadEmail extends EmailMessage {
  attachments?: Attachment[];
}

interface GmailLabel {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  email: EmailMessage;
  onClose: () => void;
  onReplySuccess: () => void;
  replyOpen?: boolean;
  onReplyOpenChange?: (open: boolean) => void;
  availableLabels?: GmailLabel[];
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

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentChip({ att, messageId }: { att: Attachment; messageId: string }) {
  const url = `/api/emails/attachment?messageId=${encodeURIComponent(messageId)}&attachmentId=${encodeURIComponent(att.id)}&filename=${encodeURIComponent(att.filename)}`;
  return (
    <a
      href={url}
      download={att.filename}
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 transition-colors"
    >
      <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      <span className="truncate max-w-[160px]">{att.filename}</span>
      <span className="text-gray-400 shrink-0">({formatBytes(att.size)})</span>
    </a>
  );
}

function EmailCard({ msg, expanded, onToggle }: { msg: ThreadEmail; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
          style={{ backgroundColor: stringToColor(msg.fromName ?? msg.from) }}
        >
          {(msg.fromName ?? msg.from)[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {msg.fromName ?? msg.from}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">{formatDate(msg.date)}</span>
          </div>
          {!expanded && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{msg.snippet ?? msg.body}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 space-y-0.5">
            <p><span className="text-gray-400 dark:text-gray-500">差出人:</span> {msg.from}</p>
            <p><span className="text-gray-400 dark:text-gray-500">宛先:</span> {msg.to}</p>
          </div>
          {msg.bodyHtml ? (
            <div
              className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.bodyHtml) }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
              {msg.body}
            </pre>
          )}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-700 pt-3">
              {msg.attachments.map((att) => (
                <AttachmentChip key={att.id} att={att} messageId={msg.id} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ThreadDetail({ email, onClose, onReplySuccess, replyOpen, onReplyOpenChange, availableLabels = [] }: Props) {
  const [threadEmails, setThreadEmails] = useState<ThreadEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [localReply, setLocalReply] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [labelLoading, setLabelLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const showReply = replyOpen ?? localReply;
  const setShowReply = (v: boolean) => {
    setLocalReply(v);
    onReplyOpenChange?.(v);
  };

  useEffect(() => {
    setLoading(true);
    setExpandedIds(new Set());
    fetch(`/api/threads/${email.threadId ?? email.id}`)
      .then((r) => r.json())
      .then((data) => {
        const msgs: EmailMessage[] = data.emails ?? [email];
        setThreadEmails(msgs);
        // expand the last email by default
        if (msgs.length > 0) {
          setExpandedIds(new Set([msgs[msgs.length - 1].id]));
        }
      })
      .catch(() => {
        setThreadEmails([email]);
        setExpandedIds(new Set([email.id]));
      })
      .finally(() => setLoading(false));
  }, [email.id, email.threadId]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const latestEmail = threadEmails[threadEmails.length - 1] ?? email;
  const allIds = threadEmails.map((m) => m.id);

  async function handleSummarize() {
    setSummarizing(true);
    setSummary(null);
    try {
      const res = await fetch("/api/emails/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: email.threadId ?? email.id,
          emailIds: allIds.length ? allIds : [email.id],
        }),
      });
      const data = await res.json();
      setSummary(data.summary ?? data.error ?? "要約に失敗しました");
    } catch {
      setSummary("要約に失敗しました");
    } finally {
      setSummarizing(false);
    }
  }

  async function handleLabelToggle(labelId: string) {
    const currentLabels: string[] = JSON.parse(JSON.stringify(email.labels));
    const hasLabel = currentLabels.includes(labelId);
    setLabelLoading(true);
    try {
      await fetch("/api/emails/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailIds: allIds.length ? allIds : [email.id],
          labelId,
          action: hasLabel ? "remove" : "add",
        }),
      });
      onReplySuccess();
    } finally {
      setLabelLoading(false);
      setShowLabelPicker(false);
    }
  }

  async function handleAction(action: "archive" | "trash" | "star" | "unstar" | "markRead" | "markUnread") {
    setActionLoading(true);
    try {
      await fetch("/api/emails/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds: allIds.length ? allIds : [email.id], action }),
      });
      onReplySuccess();
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 lg:hidden"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex-1 truncate">{email.subject}</h2>
        {threadEmails.length > 1 && (
          <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{threadEmails.length}件</span>
        )}
        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* AI要約ボタン */}
          <button
            onClick={handleSummarize}
            disabled={summarizing}
            title="AIで要約"
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${summary ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-purple-600"}`}
          >
            {summarizing ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
              </svg>
            )}
            要約
          </button>
          <button
            onClick={() => handleAction(email.isStarred ? "unstar" : "star")}
            disabled={actionLoading}
            title={email.isStarred ? "スターを外す" : "スターを付ける"}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-yellow-500 disabled:opacity-40"
          >
            <svg className={`w-4 h-4 ${email.isStarred ? "fill-yellow-400 text-yellow-400" : ""}`} fill={email.isStarred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
          <button
            onClick={() => handleAction("archive")}
            disabled={actionLoading}
            title="アーカイブ"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
          <button
            onClick={() => handleAction("trash")}
            disabled={actionLoading}
            title="ゴミ箱へ移動"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-red-500 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {availableLabels.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                title="ラベル付け"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </button>
              {showLabelPicker && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                  <p className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">ラベル付け</p>
                  {availableLabels.map((label) => {
                    const has = email.labels.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => handleLabelToggle(label.id)}
                        disabled={labelLoading}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        <span className="w-3 h-3 rounded-sm border-2 flex items-center justify-center shrink-0" style={{ borderColor: label.color ?? "#9CA3AF", backgroundColor: has ? label.color ?? "#9CA3AF" : "transparent" }}>
                          {has && <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>}
                        </span>
                        <span className="truncate">{label.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => { setShowForward(!showForward); setShowReply(false); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors ${showForward ? "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600" : "text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          転送
        </button>
        <button
          onClick={() => { setShowReply(!showReply); setShowForward(false); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          返信
        </button>
      </div>

      {/* AI要約パネル */}
      {(summary || summarizing) && (
        <div className="mx-6 mt-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
              </svg>
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">AI要約</span>
            </div>
            {summary && (
              <button onClick={() => setSummary(null)} className="text-purple-400 hover:text-purple-600 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {summarizing ? (
            <div className="mt-2 space-y-2">
              <div className="h-3 bg-purple-200 rounded animate-pulse w-full" />
              <div className="h-3 bg-purple-200 rounded animate-pulse w-4/5" />
              <div className="h-3 bg-purple-200 rounded animate-pulse w-3/5" />
            </div>
          ) : (
            <p className="mt-2 text-sm text-purple-900 dark:text-purple-200 leading-relaxed whitespace-pre-wrap">{summary}</p>
          )}
        </div>
      )}

      {/* Thread body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          threadEmails.map((msg) => (
            <EmailCard
              key={msg.id}
              msg={msg}
              expanded={expandedIds.has(msg.id)}
              onToggle={() => toggleExpand(msg.id)}
            />
          ))
        )}
      </div>

      {/* Reply Composer */}
      {showReply && (
        <ReplyComposer
          email={latestEmail}
          onClose={() => setShowReply(false)}
          onSent={() => {
            setShowReply(false);
            onReplySuccess();
          }}
        />
      )}

      {/* Forward Composer */}
      {showForward && (
        <ForwardComposer
          email={latestEmail}
          onClose={() => setShowForward(false)}
          onSent={() => {
            setShowForward(false);
            onReplySuccess();
          }}
        />
      )}
    </div>
  );
}
