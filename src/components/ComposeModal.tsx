"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import AttachmentPicker, { FileAttachment } from "./AttachmentPicker";
import TemplatePicker, { Template } from "./TemplatePicker";

const UNDO_DELAY_MS = 5000;

interface Props {
  onClose: () => void;
  onSent: () => void;
}

const TONES = [
  { value: "business", label: "ビジネス" },
  { value: "polite", label: "丁寧" },
  { value: "casual", label: "カジュアル" },
  { value: "brief", label: "簡潔" },
  { value: "detailed", label: "詳細" },
] as const;

type Tone = (typeof TONES)[number]["value"];

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  business: "ビジネスメールとして丁寧かつ簡潔に書いてください。",
  polite: "非常に丁寧で礼儀正しい表現で書いてください。",
  casual: "フレンドリーでカジュアルな口調で書いてください。",
  brief: "できるだけ短く要点だけを伝えるメールにしてください。",
  detailed: "詳細かつ丁寧に説明しながら書いてください。",
};

export default function ComposeModal({ onClose, onSent }: Props) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [instruction, setInstruction] = useState("");
  const [tone, setTone] = useState<Tone>("business");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [showAI, setShowAI] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const undoCancelRef = useRef<(() => void) | null>(null);
  const DRAFT_KEY = "draft_compose";

  // Restore draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.to) setTo(d.to);
        if (d.subject) setSubject(d.subject);
        if (d.body) setBody(d.body);
        if (d.cc) { setCc(d.cc); setShowCc(true); }
        if (d.bcc) { setBcc(d.bcc); setShowBcc(true); }
      } catch { /* ignore */ }
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (!to && !subject && !body) { localStorage.removeItem(DRAFT_KEY); return; }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ to, subject, body, cc, bcc }));
  }, [to, subject, body, cc, bcc]);

  const handleGenerate = useCallback(async () => {
    if (!subject && !instruction) {
      setError("件名または指示を入力してください");
      return;
    }
    setGenerating(true);
    setError("");
    const fullInstruction = [
      TONE_INSTRUCTIONS[tone],
      subject ? `件名: ${subject}` : "",
      instruction,
    ].filter(Boolean).join(" ");

    try {
      const res = await fetch("/api/reply/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: "__new__",
          userInstruction: fullInstruction,
          isNew: true,
          subject,
          to,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBody(data.body);
      setTimeout(() => bodyRef.current?.focus(), 100);
    } catch (err: any) {
      setError(err.message ?? "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }, [subject, instruction, tone, to]);

  const executeSend = useCallback(async () => {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          body,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          attachments: attachments.length ? attachments.map(({ filename, mimeType, data }) => ({ filename, mimeType, data })) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.removeItem(DRAFT_KEY);
      onSent();
    } catch (err: any) {
      setError(err.message ?? "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }, [to, subject, body, cc, bcc, attachments, onSent]);

  const handleSend = useCallback(() => {
    if (!to.trim()) { setError("宛先を入力してください"); return; }
    if (!subject.trim()) { setError("件名を入力してください"); return; }
    if (!body.trim()) { setError("本文を入力してください"); return; }

    let cancelled = false;
    undoCancelRef.current = () => { cancelled = true; };

    let remaining = UNDO_DELAY_MS / 1000;
    setUndoCountdown(remaining);
    const tick = setInterval(() => {
      remaining -= 1;
      setUndoCountdown(remaining);
      if (remaining <= 0) clearInterval(tick);
    }, 1000);

    setTimeout(() => {
      clearInterval(tick);
      setUndoCountdown(null);
      undoCancelRef.current = null;
      if (!cancelled) executeSend();
    }, UNDO_DELAY_MS);
  }, [to, subject, body, executeSend]);

  const handleUndoSend = useCallback(() => {
    undoCancelRef.current?.();
    undoCancelRef.current = null;
    setUndoCountdown(null);
  }, []);

  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInstructionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-end z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">新規メール作成</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 宛先・件名 */}
        <div className="border-b border-gray-100">
          <div className="flex items-center px-5 py-2 border-b border-gray-100">
            <span className="text-sm text-gray-400 w-10 shrink-0">To</span>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="宛先メールアドレス"
              type="email"
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
            />
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={() => setShowCc(!showCc)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${showCc ? "bg-blue-50 text-blue-600 border-blue-200" : "text-gray-400 border-gray-200 hover:bg-gray-50"}`}
              >
                CC
              </button>
              <button
                onClick={() => setShowBcc(!showBcc)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${showBcc ? "bg-blue-50 text-blue-600 border-blue-200" : "text-gray-400 border-gray-200 hover:bg-gray-50"}`}
              >
                BCC
              </button>
            </div>
          </div>
          {showCc && (
            <div className="flex items-center px-5 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-400 w-10 shrink-0">CC</span>
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="CCメールアドレス（複数の場合はカンマ区切り）"
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
              />
            </div>
          )}
          {showBcc && (
            <div className="flex items-center px-5 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-400 w-10 shrink-0">BCC</span>
              <input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="BCCメールアドレス（複数の場合はカンマ区切り）"
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
              />
            </div>
          )}
          <div className="flex items-center px-5 py-2">
            <span className="text-sm text-gray-400 w-10 shrink-0">件名</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="件名を入力"
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* AI パネル */}
        {showAI && (
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
              </svg>
              <span className="text-sm font-semibold text-gray-800">Claude AI で下書き生成</span>
            </div>
            <div className="flex gap-2">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleInstructionKeyDown}
                placeholder="指示（例：来週の打ち合わせの日程調整をお願いする）　⌘+Enter で生成"
                rows={2}
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <div className="flex flex-col gap-2">
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value as Tone)}
                  className="text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
                >
                  {TONES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      生成中...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
                      </svg>
                      生成
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="mx-4 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* 本文 */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleBodyKeyDown}
            placeholder="本文を入力... （⌘+Enter で送信）"
            className="w-full h-full min-h-40 text-sm text-gray-900 placeholder-gray-400 bg-transparent resize-none focus:outline-none"
          />
        </div>

        {/* 添付ファイル */}
        {attachments.length > 0 && (
          <div className="px-5 py-2 border-t border-gray-100">
            <AttachmentPicker attachments={attachments} onChange={setAttachments} />
          </div>
        )}

        {/* Undo カウントダウンバナー */}
        {undoCountdown !== null && (
          <div className="flex items-center justify-between px-5 py-2 bg-gray-900 text-white text-sm border-t border-gray-100">
            <span>{undoCountdown}秒後に送信...</span>
            <button
              onClick={handleUndoSend}
              className="px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 text-xs font-semibold"
            >
              取り消す
            </button>
          </div>
        )}

        {/* ボトムツールバー */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={sending || !to.trim() || !body.trim() || undoCountdown !== null}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  送信
                </>
              )}
            </button>

            <button
              onClick={() => setShowAI(!showAI)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                showAI
                  ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                  : "text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
              </svg>
              Claude AI
            </button>
            <AttachmentPicker attachments={attachments} onChange={setAttachments} />
            <TemplatePicker onSelect={(t: Template) => {
              setBody(t.body);
              if (!subject.trim() && t.subject) setSubject(t.subject);
            }} />
          </div>

          <div className="flex items-center gap-2">
            {(to || subject || body) && (
              <span className="text-xs text-gray-400">下書き保存済み</span>
            )}
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
