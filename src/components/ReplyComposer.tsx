"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import AttachmentPicker, { FileAttachment } from "./AttachmentPicker";
import TemplatePicker, { Template } from "./TemplatePicker";

const UNDO_DELAY_MS = 5000;
import { EmailMessage } from "@/types";

interface Props {
  email: EmailMessage;
  onSent: () => void;
  onClose: () => void;
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
  business: "ビジネスメールとして丁寧かつ簡潔に返信してください。",
  polite: "非常に丁寧で礼儀正しい表現で返信してください。",
  casual: "フレンドリーでカジュアルな口調で返信してください。",
  brief: "できるだけ短く要点だけを伝える返信にしてください。",
  detailed: "詳細かつ丁寧に説明しながら返信してください。",
};

export default function ReplyComposer({ email, onSent, onClose }: Props) {
  const [replyBody, setReplyBody] = useState("");
  const [instruction, setInstruction] = useState("");
  const [tone, setTone] = useState<Tone>("business");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [showAI, setShowAI] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [patternId, setPatternId] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<"up" | "down" | null>(null);
  const [error, setError] = useState("");
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const undoCancelRef = useRef<(() => void) | null>(null);
  const draftKey = `draft_reply_${email.id}`;

  // Restore draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) setReplyBody(saved);
  }, [draftKey]);

  // Auto-save draft on body change
  useEffect(() => {
    if (replyBody) {
      localStorage.setItem(draftKey, replyBody);
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [replyBody, draftKey]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError("");
    const fullInstruction = [TONE_INSTRUCTIONS[tone], instruction].filter(Boolean).join(" ");
    try {
      const res = await fetch("/api/reply/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id, userInstruction: fullInstruction }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReplyBody(data.body);
      setConfidence(data.confidence);
      setPatternId(data.patternId ?? null);
      setFeedbackSent(null);
      setTimeout(() => replyRef.current?.focus(), 100);
    } catch (err: any) {
      setError(err.message ?? "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }, [email.id, instruction, tone]);

  const handleFeedback = useCallback(async (type: "up" | "down") => {
    if (!patternId || feedbackSent) return;
    setFeedbackSent(type);
    await fetch("/api/reply/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patternId, delta: type === "up" ? 1 : -1 }),
    });
  }, [patternId, feedbackSent]);

  const executeSend = useCallback(async () => {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/reply/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: email.id,
          replyBody,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          attachments: attachments.length ? attachments.map(({ filename, mimeType, data }) => ({ filename, mimeType, data })) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.removeItem(draftKey);
      onSent();
    } catch (err: any) {
      setError(err.message ?? "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }, [email.id, replyBody, cc, bcc, attachments, onSent, draftKey]);

  const handleSend = useCallback(() => {
    if (!replyBody.trim()) return;
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
  }, [replyBody, executeSend]);

  const handleUndoSend = useCallback(() => {
    undoCancelRef.current?.();
    undoCancelRef.current = null;
    setUndoCountdown(null);
  }, []);

  function handleInstructionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  }

  function handleReplyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
      {/* To + CC/BCC toggles + Close */}
      <div className="border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center px-4 py-2">
          <span className="text-xs text-gray-400 dark:text-gray-500 w-10 shrink-0">To</span>
          <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{email.from}</span>
          <div className="flex items-center gap-1.5">
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
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded ml-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {showCc && (
          <div className="flex items-center px-4 py-2 border-t border-gray-100">
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
          <div className="flex items-center px-4 py-2 border-t border-gray-100">
            <span className="text-xs text-gray-400 w-10 shrink-0">BCC</span>
            <input
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="BCCメールアドレス（複数の場合はカンマ区切り）"
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* AI パネル */}
      {showAI && (
        <div className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
            </svg>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Claude AI で下書き生成</span>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={instructionRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleInstructionKeyDown}
                placeholder={`指示（例：丁寧にお断りして、来週の提案をする）　⌘+Enter で生成 / Enter で改行`}
                rows={2}
                className="w-full text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              {/* トーン選択 */}
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {/* 生成ボタン */}
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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

          {/* 信頼度バー + フィードバック */}
          {confidence !== null && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">信頼度 {Math.round(confidence * 100)}%</span>
              {patternId && (
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-xs text-gray-400 dark:text-gray-500">評価:</span>
                  <button
                    onClick={() => handleFeedback("up")}
                    disabled={!!feedbackSent}
                    title="良い返信"
                    className={`p-1 rounded transition-colors ${feedbackSent === "up" ? "text-green-500" : "text-gray-400 dark:text-gray-500 hover:text-green-500 disabled:opacity-50"}`}
                  >
                    <svg className="w-4 h-4" fill={feedbackSent === "up" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleFeedback("down")}
                    disabled={!!feedbackSent}
                    title="改善が必要"
                    className={`p-1 rounded transition-colors ${feedbackSent === "down" ? "text-red-500" : "text-gray-400 dark:text-gray-500 hover:text-red-500 disabled:opacity-50"}`}
                  >
                    <svg className="w-4 h-4" fill={feedbackSent === "down" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                  </button>
                  {feedbackSent && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">フィードバック送信済み</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* エラー */}
      {error && (
        <div className="mx-4 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* 返信入力エリア */}
      <div className="flex-1 px-4 pt-3 pb-2">
        <textarea
          ref={replyRef}
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          onKeyDown={handleReplyKeyDown}
          placeholder={`返信を入力... （⌘+Enter で送信）`}
          rows={6}
          className="w-full text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-900 border-0 resize-none focus:outline-none"
        />
      </div>

      {/* undo カウントダウンバナー */}
      {undoCountdown !== null && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white text-sm">
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
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {/* 送信 */}
          <button
            onClick={handleSend}
            disabled={sending || !replyBody.trim() || undoCountdown !== null}
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
                送信
              </>
            )}
          </button>

          {/* Claude AI トグル */}
          <button
            onClick={() => setShowAI(!showAI)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
              showAI
                ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                : "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
            </svg>
            Claude AI
          </button>
          <AttachmentPicker attachments={attachments} onChange={setAttachments} />
          <TemplatePicker onSelect={(t: Template) => {
            setReplyBody(t.body);
          }} />
        </div>

        <div className="flex items-center gap-2">
          {replyBody && (
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
  );
}
