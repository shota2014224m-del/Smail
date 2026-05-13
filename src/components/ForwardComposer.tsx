"use client";
import { useState, useRef, useCallback } from "react";
import { EmailMessage } from "@/types";

interface Props {
  email: EmailMessage;
  onClose: () => void;
  onSent: () => void;
}

function buildQuotedBody(email: EmailMessage): string {
  const dateStr = new Date(email.date).toLocaleString("ja-JP");
  const header = `---------- Forwarded message ----------\nFrom: ${email.fromName ? `${email.fromName} <${email.from}>` : email.from}\nDate: ${dateStr}\nSubject: ${email.subject}\nTo: ${email.to}\n\n`;
  return `\n\n${header}${email.body}`;
}

export default function ForwardComposer({ email, onClose, onSent }: Props) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [body, setBody] = useState(() => buildQuotedBody(email));
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const toRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(async () => {
    if (!to.trim()) { setError("宛先を入力してください"); return; }
    if (!body.trim()) { setError("本文を入力してください"); return; }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/emails/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: email.id,
          to,
          body,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSent();
    } catch (err: any) {
      setError(err.message ?? "転送に失敗しました");
    } finally {
      setSending(false);
    }
  }, [email.id, to, body, cc, bcc, onSent]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const subject = email.subject.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject}`;

  return (
    <div className="border-t-2 border-gray-200 bg-white flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">転送</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCc(!showCc)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${showCc ? "bg-blue-50 text-blue-600 border-blue-200" : "text-gray-500 border-gray-200 hover:bg-gray-50"}`}
          >
            CC
          </button>
          <button
            onClick={() => setShowBcc(!showBcc)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${showBcc ? "bg-blue-50 text-blue-600 border-blue-200" : "text-gray-500 border-gray-200 hover:bg-gray-50"}`}
          >
            BCC
          </button>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="border-b border-gray-100">
        <div className="flex items-center px-4 py-2 border-b border-gray-100">
          <span className="text-xs text-gray-400 w-10 shrink-0">To</span>
          <input
            ref={toRef}
            autoFocus
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="転送先メールアドレス"
            type="email"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
          />
        </div>
        {showCc && (
          <div className="flex items-center px-4 py-2 border-b border-gray-100">
            <span className="text-xs text-gray-400 w-10 shrink-0">CC</span>
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="CCメールアドレス（複数の場合はカンマ区切り）"
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
            />
          </div>
        )}
        {showBcc && (
          <div className="flex items-center px-4 py-2 border-b border-gray-100">
            <span className="text-xs text-gray-400 w-10 shrink-0">BCC</span>
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="BCCメールアドレス（複数の場合はカンマ区切り）"
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
            />
          </div>
        )}
        <div className="flex items-center px-4 py-2">
          <span className="text-xs text-gray-400 w-10 shrink-0">件名</span>
          <span className="text-sm text-gray-600">{subject}</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 px-4 pt-3 pb-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="転送メッセージ... （⌘+Enter で送信）"
          rows={6}
          className="w-full text-sm text-gray-900 placeholder-gray-400 bg-white border-0 resize-none focus:outline-none"
        />
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
        <button
          onClick={handleSend}
          disabled={sending || !to.trim() || !body.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              送信中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              転送
            </>
          )}
        </button>
        <button
          onClick={onClose}
          className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
