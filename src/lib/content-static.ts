import fs from "fs";
import path from "path";
import type { Product, Feature, VersionManifest } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content");

/**
 * List all products by reading subdirectories of content/.
 * Each subdirectory must contain a product.json file.
 */
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

/**
 * Load a single product by slug.
 * Reads content/<slug>/product.json.
 */
export function loadProduct(slug: string): Product | null {
  const productJsonPath = path.join(CONTENT_DIR, slug, "product.json");

  if (!fs.existsSync(productJsonPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(productJsonPath, "utf-8"));
    return {
      slug,
      name: String(raw.name ?? ""),
      tagline: String(raw.tagline ?? ""),
      description: String(raw.description ?? ""),
      locales: Array.isArray(raw.locales) ? raw.locales.map(String) : ["en"],
      defaultLocale: String(raw.defaultLocale ?? "en"),
      versions: Array.isArray(raw.versions) ? raw.versions.map(String) : [],
      latest: String(raw.latest ?? ""),
    };
  } catch {
    return null;
  }
}

/**
 * Load the version manifest (features list) for a product version.
 * Reads content/<product>/v<version>/features.json.
 */
export function loadVersionManifest(
  product: string,
  version: string,
): VersionManifest | null {
  const featuresPath = path.join(
    CONTENT_DIR,
    product,
    `v${version}`,
    "features.json",
  );

  if (!fs.existsSync(featuresPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(featuresPath, "utf-8"));
    return {
      version: String(raw.version ?? version),
      status: raw.status ?? "draft",
      releaseDate: raw.releaseDate,
      features: Array.isArray(raw.features)
        ? raw.features.map(mapFeature)
        : [],
    };
  } catch {
    return null;
  }
}

/**
 * Load features for a product version.
 * Returns the features array from the version manifest.
 */
export function loadFeatures(product: string, version: string): Feature[] {
  const manifest = loadVersionManifest(product, version);
  return manifest?.features ?? [];
}

/**
 * Load a feature document (markdown) for a specific product/version/locale/slug.
 * Falls back to the product's default locale if the requested locale is not found.
 */
export function loadFeatureDocument(
  product: string,
  version: string,
  locale: string,
  slug: string,
  defaultLocale: string = "en",
): string | null {
  const primaryPath = path.join(
    CONTENT_DIR,
    product,
    `v${version}`,
    locale,
    `${slug}.md`,
  );

  if (fs.existsSync(primaryPath)) {
    return fs.readFileSync(primaryPath, "utf-8");
  }

  // Fall back to default locale
  if (locale !== defaultLocale) {
    const fallbackPath = path.join(
      CONTENT_DIR,
      product,
      `v${version}`,
      defaultLocale,
      `${slug}.md`,
    );

    if (fs.existsSync(fallbackPath)) {
      return fs.readFileSync(fallbackPath, "utf-8");
    }
  }

  return null;
}

/**
 * Generate all valid product/locale/feature/version combinations.
 * Used by generateStaticParams in page components.
 */
export function generateAllFeatureParams(): Array<{
  product: string;
  locale: string;
  feature: string;
  version: string;
}> {
  const products = listProducts();
  const params: Array<{
    product: string;
    locale: string;
    feature: string;
    version: string;
  }> = [];

  for (const product of products) {
    for (const version of product.versions) {
      const features = loadFeatures(product.slug, version);
      for (const locale of product.locales) {
        for (const feature of features) {
          params.push({
            product: product.slug,
            locale,
            feature: feature.slug,
            version,
          });
        }
      }
    }
  }

  return params;
}

function mapFeature(raw: Record<string, unknown>): Feature {
  return {
    slug: String(raw.slug ?? ""),
    title: (raw.title as Record<string, string>) ?? {},
    summary: (raw.summary as Record<string, string>) ?? {},
    device: String(raw.device ?? "ipad") as Feature["device"],
    orientation: (String(raw.orientation ?? "portrait")) as Feature["orientation"],
    video: raw.video ? String(raw.video) : null,
  };
}
