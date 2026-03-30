import fs from "fs";
import path from "path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import type { Product, VersionManifest, Feature } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content");

/* ─── Product loading ─────────────────────────────────── */

export function listProducts(): Product[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(CONTENT_DIR, { withFileTypes: true });
  const products: Product[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const product = loadProduct(entry.name);
    if (product) {
      products.push(product);
    }
  }

  return products;
}

export function loadProduct(slug: string): Product | null {
  const productJsonPath = path.join(CONTENT_DIR, slug, "product.json");
  if (!fs.existsSync(productJsonPath)) {
    return null;
  }

  const raw = fs.readFileSync(productJsonPath, "utf-8");
  const data = JSON.parse(raw) as Omit<Product, "slug">;
  return { slug, ...data };
}

/* ─── Feature manifest loading ────────────────────────── */

export function loadFeatures(
  productSlug: string,
  version: string
): VersionManifest | null {
  const featuresJsonPath = path.join(
    CONTENT_DIR,
    productSlug,
    `v${version}`,
    "features.json"
  );
  if (!fs.existsSync(featuresJsonPath)) {
    return null;
  }

  const raw = fs.readFileSync(featuresJsonPath, "utf-8");
  return JSON.parse(raw) as VersionManifest;
}

export function getFeatureFromManifest(
  productSlug: string,
  version: string,
  featureSlug: string
): Feature | null {
  const manifest = loadFeatures(productSlug, version);
  if (!manifest) return null;

  return manifest.features.find((f) => f.slug === featureSlug) ?? null;
}

/* ─── Localized string helpers ────────────────────────── */

export function getLocalizedValue(
  localizedMap: Record<string, string>,
  locale: string,
  defaultLocale: string
): string {
  return localizedMap[locale] ?? localizedMap[defaultLocale] ?? Object.values(localizedMap)[0] ?? "";
}

/* ─── Markdown rendering with locale fallback ─────────── */

function transformVideoDirectives(markdown: string): string {
  return markdown.replace(
    /::video\[([^\]]+)\](?:\{title="([^"]+)"\})?/g,
    (_match, filename: string, title?: string) => {
      const titleAttr = title ? ` title="${title}"` : "";
      return `<div class="video-embed" data-video="${filename}"${titleAttr}></div>`;
    }
  );
}

export async function loadFeatureDoc(
  product: string,
  version: string,
  locale: string,
  slug: string
): Promise<string | null> {
  const productData = loadProduct(product);
  const defaultLocale = productData?.defaultLocale ?? "en";

  // Try locale-specific path first
  const localePath = path.join(
    CONTENT_DIR,
    product,
    `v${version}`,
    locale,
    `${slug}.md`
  );

  // Fall back to default locale
  const fallbackPath = path.join(
    CONTENT_DIR,
    product,
    `v${version}`,
    defaultLocale,
    `${slug}.md`
  );

  let markdownPath: string | null = null;
  if (fs.existsSync(localePath)) {
    markdownPath = localePath;
  } else if (fs.existsSync(fallbackPath)) {
    markdownPath = fallbackPath;
  }

  if (!markdownPath) {
    return null;
  }

  const raw = fs.readFileSync(markdownPath, "utf-8");
  return raw;
}

export async function renderFeatureDoc(
  product: string,
  version: string,
  locale: string,
  slug: string
): Promise<string | null> {
  const raw = await loadFeatureDoc(product, version, locale, slug);
  if (!raw) return null;

  const transformed = transformVideoDirectives(raw);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(transformed);

  return String(result);
}

/* ─── Video URL resolution with locale fallback ───────── */

export function resolveVideoUrl(
  product: string,
  version: string,
  locale: string,
  filename: string
): string {
  // Locale-specific video path on disk
  const localeVideoPath = path.join(
    CONTENT_DIR,
    product,
    `v${version}`,
    "videos",
    locale,
    filename
  );

  if (fs.existsSync(localeVideoPath)) {
    return `/api/content/${product}/v${version}/videos/${locale}/${filename}`;
  }

  // Shared fallback
  return `/api/content/${product}/v${version}/videos/${filename}`;
}

export function videoExistsOnDisk(
  product: string,
  version: string,
  locale: string,
  filename: string
): boolean {
  const localeVideoPath = path.join(
    CONTENT_DIR,
    product,
    `v${version}`,
    "videos",
    locale,
    filename
  );
  if (fs.existsSync(localeVideoPath)) return true;

  const sharedVideoPath = path.join(
    CONTENT_DIR,
    product,
    `v${version}`,
    "videos",
    filename
  );
  return fs.existsSync(sharedVideoPath);
}

/* ─── Content saving ──────────────────────────────────── */

export function saveFeatureDoc(
  product: string,
  version: string,
  locale: string,
  slug: string,
  content: string
): void {
  const dirPath = path.join(CONTENT_DIR, product, `v${version}`, locale);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const filePath = path.join(dirPath, `${slug}.md`);
  fs.writeFileSync(filePath, content, "utf-8");
}
