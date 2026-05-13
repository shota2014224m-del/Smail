"use client";
import { useState, useRef, useEffect } from "react";
import { AccountInfo } from "@/types";

interface Props {
  accounts: AccountInfo[];
  onSwitch: (id: string) => void;
  onAddAccount: () => void;
  onDelete: (id: string) => void;
}

export default function AccountSwitcher({ accounts, onSwitch, onAddAccount, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = accounts.find((a) => a.isActive);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 w-full"
      >
        {active?.picture ? (
          <img src={active.picture} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
            {active?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{active?.name ?? active?.email}</p>
          <p className="text-xs text-gray-600 truncate">{active?.email}</p>
        </div>
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 mb-2">
          <div className="p-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
                  account.isActive ? "bg-blue-50" : ""
                }`}
                onClick={() => {
                  onSwitch(account.id);
                  setOpen(false);
                }}
              >
                {account.picture ? (
                  <img src={account.picture} alt="" className="w-9 h-9 rounded-full" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                    {account.email[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{account.name ?? account.email}</p>
                  <p className="text-xs text-gray-600 truncate">{account.email}</p>
                </div>
                {account.isActive && (
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(account.id);
                  }}
                  className="text-gray-400 hover:text-red-500 ml-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 p-2">
            <button
              onClick={() => { onAddAccount(); setOpen(false); }}
              className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              別のアカウントを追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
