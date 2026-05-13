"use client";
import { useState, useRef, useCallback } from "react";

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
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [instruction, setInstruction] = useState("");
  const [tone, setTone] = useState<Tone>("business");
  const [showAI, setShowAI] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSend = useCallback(async () => {
    if (!to.trim()) { setError("宛先を入力してください"); return; }
    if (!subject.trim()) { setError("件名を入力してください"); return; }
    if (!body.trim()) { setError("本文を入力してください"); return; }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSent();
    } catch (err: any) {
      setError(err.message ?? "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }, [to, subject, body, onSent]);

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
          </div>
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

        {/* ボトムツールバー */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={sending || !to.trim() || !body.trim()}
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
          </div>

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
