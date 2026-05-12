"use client";
import { useState } from "react";
import { EmailMessage } from "@/types";
import ReplyComposer from "./ReplyComposer";

interface Props {
  email: EmailMessage;
  onClose: () => void;
  onReplySuccess: () => void;
}

export default function EmailDetail({ email, onClose, onReplySuccess }: Props) {
  const [showReply, setShowReply] = useState(false);

  function formatFullDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

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
        <div className="flex gap-2">
          <button
            onClick={() => setShowReply(!showReply)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            返信
          </button>
        </div>
      </div>

      {/* Email meta */}
      <div className="flex items-start gap-3 px-6 py-4 border-b border-gray-100">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
          style={{ backgroundColor: stringToColor(email.fromName ?? email.from) }}
        >
          {(email.fromName ?? email.from)[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-900 text-sm">
              {email.fromName ?? email.from}
            </span>
            <span className="text-xs text-gray-400 shrink-0">{formatFullDate(email.date)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="text-gray-400">差出人:</span> {email.from}
          </p>
          <p className="text-xs text-gray-500">
            <span className="text-gray-400">宛先:</span> {email.to}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {email.bodyHtml ? (
          <div
            className="prose prose-sm max-w-none text-gray-800"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.bodyHtml) }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
            {email.body}
          </pre>
        )}
      </div>

      {/* Reply Composer */}
      {showReply && (
        <ReplyComposer
          email={email}
          onClose={() => setShowReply(false)}
          onSent={() => {
            setShowReply(false);
            onReplySuccess();
          }}
        />
      )}
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

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "");
}
