"use client";
import { useState, useRef, useCallback } from "react";
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
  const [showAI, setShowAI] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState("");
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

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
      setTimeout(() => replyRef.current?.focus(), 100);
    } catch (err: any) {
      setError(err.message ?? "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }, [email.id, instruction, tone]);

  const handleSend = useCallback(async () => {
    if (!replyBody.trim()) return;
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
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSent();
    } catch (err: any) {
      setError(err.message ?? "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }, [email.id, replyBody, onSent]);

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
    <div className="border-t-2 border-gray-200 bg-white flex flex-col">
      {/* To + CC/BCC toggles + Close */}
      <div className="border-b border-gray-100">
        <div className="flex items-center px-4 py-2">
          <span className="text-xs text-gray-400 w-10 shrink-0">To</span>
          <span className="flex-1 text-sm text-gray-900 font-medium">{email.from}</span>
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
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
            </svg>
            <span className="text-sm font-semibold text-gray-800">Claude AI で下書き生成</span>
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
                className="w-full text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              {/* トーン選択 */}
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
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

          {/* 信頼度バー */}
          {confidence !== null && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">信頼度 {Math.round(confidence * 100)}%</span>
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
          className="w-full text-sm text-gray-900 placeholder-gray-400 bg-white border-0 resize-none focus:outline-none"
        />
      </div>

      {/* ボトムツールバー */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {/* 送信 */}
          <button
            onClick={handleSend}
            disabled={sending || !replyBody.trim()}
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
                ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                : "text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
            </svg>
            Claude AI
          </button>
        </div>

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
