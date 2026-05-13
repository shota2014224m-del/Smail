"use client";
import { useState, useEffect, useCallback } from "react";

export function useDarkMode() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("smail-dark-mode");
    const enabled = stored === "true";
    setDark(enabled);
    document.documentElement.classList.toggle("dark", enabled);
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("smail-dark-mode", String(next));
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }, []);

  return { dark, toggle };
}
