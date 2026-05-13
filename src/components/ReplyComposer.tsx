"use client";
import { useState } from "react";
import { EmailMessage } from "@/types";

interface Props {
  email: EmailMessage;
  onSent: () => void;
  onClose: () => void;
}

export default function ReplyComposer({ email, onSent, onClose }: Props) {
  const [replyBody, setReplyBody] = useState("");
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/reply/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id, userInstruction: instruction }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReplyBody(data.body);
      setConfidence(data.confidence);
    } catch (err: any) {
      setError(err.message ?? "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!replyBody.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/reply/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id, replyBody }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSent();
    } catch (err: any) {
      setError(err.message ?? "送信に失敗しました");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            返信先: {email.fromName ?? email.from}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="AI指示（例：丁寧に断る、詳細を確認する）"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                生成中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI返信生成
              </>
            )}
          </button>
        </div>
        {confidence !== null && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">信頼度 {Math.round(confidence * 100)}%</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="p-4">
        <textarea
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          placeholder="返信を入力、またはAI生成ボタンで自動作成..."
          rows={8}
          className="w-full text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono bg-white"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            キャンセル
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !replyBody.trim()}
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
        </div>
      </div>
    </div>
  );
}
