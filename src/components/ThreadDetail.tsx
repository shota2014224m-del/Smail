"use client";
import { useState, useEffect } from "react";
import { EmailMessage } from "@/types";
import ReplyComposer from "./ReplyComposer";
import ForwardComposer from "./ForwardComposer";

interface Props {
  email: EmailMessage;
  onClose: () => void;
  onReplySuccess: () => void;
  replyOpen?: boolean;
  onReplyOpenChange?: (open: boolean) => void;
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

function EmailCard({ msg, expanded, onToggle }: { msg: EmailMessage; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
          style={{ backgroundColor: stringToColor(msg.fromName ?? msg.from) }}
        >
          {(msg.fromName ?? msg.from)[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {msg.fromName ?? msg.from}
            </span>
            <span className="text-xs text-gray-500 shrink-0">{formatDate(msg.date)}</span>
          </div>
          {!expanded && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{msg.snippet ?? msg.body}</p>
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
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-3 space-y-0.5">
            <p><span className="text-gray-400">差出人:</span> {msg.from}</p>
            <p><span className="text-gray-400">宛先:</span> {msg.to}</p>
          </div>
          {msg.bodyHtml ? (
            <div
              className="prose prose-sm max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.bodyHtml) }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
              {msg.body}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function ThreadDetail({ email, onClose, onReplySuccess, replyOpen, onReplyOpenChange }: Props) {
  const [threadEmails, setThreadEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [localReply, setLocalReply] = useState(false);
  const [showForward, setShowForward] = useState(false);

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

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500 lg:hidden"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-900 flex-1 truncate">{email.subject}</h2>
        {threadEmails.length > 1 && (
          <span className="text-sm text-gray-500 shrink-0">{threadEmails.length}件</span>
        )}
        <button
          onClick={() => { setShowForward(!showForward); setShowReply(false); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors ${showForward ? "bg-gray-100 text-gray-800 border-gray-300" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}
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

      {/* Thread body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
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
