/** Map of locale code to localized string */
export type LocalizedString = Record<string, string>;

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  locales: string[];
  defaultLocale: string;
  versions: string[];
  latest: string;
}

export type DeviceType = "iphone" | "ipad" | "android-phone" | "android-tablet";
export type Orientation = "portrait" | "landscape";

export interface Feature {
  slug: string;
  title: LocalizedString;
  summary: LocalizedString;
  device: DeviceType;
  orientation: Orientation;
  video: string | null;
}

export type VersionStatus = "draft" | "published" | "archived";

export interface VersionManifest {
  version: string;
  status: VersionStatus;
  releaseDate?: string;
  features: Feature[];
}

export interface FeedbackItem {
  id: number;
  product: string;
  feature: string;
  version: string;
  locale: string;
  type: "text" | "video" | "general";
  selectedText: string | null;
  videoReference: string | null;
  comment: string;
  email: string | null;
  status: "open" | "acknowledged" | "fixed" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
}

export interface FeedbackCreateInput {
  product: string;
  feature: string;
  version: string;
  locale: string;
  type: "text" | "video" | "general";
  selectedText?: string;
  videoReference?: string;
  comment: string;
  email?: string;
}

export interface ContentSaveInput {
  product: string;
  version: string;
  locale: string;
  slug: string;
  content: string;
  editMessage: string;
}

/** Locale display metadata */
export const LOCALE_DISPLAY_NAMES: Record<string, string> = {
  en: "English",
  es: "Espanol",
  fr: "Francais",
  de: "Deutsch",
  it: "Italiano",
  pt: "Portugues",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
};
