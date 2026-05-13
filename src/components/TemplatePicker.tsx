"use client";
import { useState, useEffect, useRef } from "react";

export interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface Props {
  onSelect: (template: Template) => void;
}

export default function TemplatePicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []));
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        テンプレート
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded-lg"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        テンプレート
      </button>
      <div className="absolute bottom-full mb-1 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
        {templates.length === 0 ? (
          <p className="px-4 py-3 text-xs text-gray-400">テンプレートがまだありません。<br />設定 → テンプレート管理から追加できます。</p>
        ) : (
          templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onSelect(t); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm text-gray-900 font-medium truncate">{t.name}</p>
              {t.subject && <p className="text-xs text-gray-500 truncate mt-0.5">件名: {t.subject}</p>}
              <p className="text-xs text-gray-400 truncate mt-0.5">{t.body.slice(0, 60)}...</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
