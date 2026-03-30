"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LOCALE_DISPLAY_NAMES } from "@/lib/types";

interface LocaleSwitcherProps {
  locales: string[];
  currentLocale: string;
}

const LOCALE_STORAGE_KEY = "featuredocs-locale";

export default function LocaleSwitcher({
  locales,
  currentLocale,
}: LocaleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(LOCALE_STORAGE_KEY, currentLocale);
    }
  }, [currentLocale, mounted]);

  if (locales.length <= 1) {
    return null;
  }

  function handleLocaleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = event.target.value;
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);

    // Replace locale segment in the URL path
    // URL pattern: /[product]/[locale]/... or /[product]/[locale]
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      segments[1] = newLocale;
      router.push("/" + segments.join("/"));
    }
  }

  function displayName(locale: string): string {
    return LOCALE_DISPLAY_NAMES[locale] ?? locale.toUpperCase();
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="locale-switcher"
        className="text-xs text-[#6B6B6B]"
      >
        Language:
      </label>
      <select
        id="locale-switcher"
        value={currentLocale}
        onChange={handleLocaleChange}
        className="rounded border border-[#E8E6E1] bg-white px-2 py-1 text-xs text-[#1A1A1A] focus:border-[#6B6B6B] focus:outline-none focus:ring-1 focus:ring-[#6B6B6B]"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {displayName(locale)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Read stored locale preference (for use on the server via cookies, or client) */
export function getStoredLocale(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOCALE_STORAGE_KEY);
}
