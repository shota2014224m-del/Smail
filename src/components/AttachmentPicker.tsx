"use client";
import { useRef } from "react";

export interface FileAttachment {
  filename: string;
  mimeType: string;
  data: string; // base64 without data URI prefix
  size: number;
}

interface Props {
  attachments: FileAttachment[];
  onChange: (attachments: FileAttachment[]) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentPicker({ attachments, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const pending = Array.from(files);
    Promise.all(
      pending.map(
        (file) =>
          new Promise<FileAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(",")[1] ?? "";
              resolve({ filename: file.name, mimeType: file.type || "application/octet-stream", data: base64, size: file.size });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    ).then((newFiles) => onChange([...attachments, ...newFiles]));
  }

  function remove(index: number) {
    onChange(attachments.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        添付
      </button>
      {attachments.map((att, i) => (
        <div key={i} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-700 max-w-[200px]">
          <span className="truncate">{att.filename}</span>
          <span className="text-gray-400 shrink-0">({formatBytes(att.size)})</span>
          <button onClick={() => remove(i)} className="ml-0.5 text-gray-400 hover:text-red-500 shrink-0">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
