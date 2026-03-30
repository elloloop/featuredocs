import { notFound } from "next/navigation";
import Link from "next/link";
import {
  loadProduct,
  getFeatureFromManifest,
  renderFeatureDoc,
  loadFeatureDoc,
  resolveVideoUrl,
  videoExistsOnDisk,
  getLocalizedValue,
} from "@/lib/content";
import VersionSelector from "@/components/VersionSelector";
import FeedbackButton from "@/components/FeedbackButton";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import FeaturePageClient from "@/components/FeaturePageClient";
import InlineEditor from "@/components/InlineEditor";

interface FeatureVersionPageProps {
  params: Promise<{
    product: string;
    locale: string;
    feature: string;
    version: string;
  }>;
}

export default async function FeatureVersionPage({
  params,
}: FeatureVersionPageProps) {
  const {
    product: productSlug,
    locale,
    feature: featureSlug,
    version,
  } = await params;
  const product = loadProduct(productSlug);

  if (!product) {
    notFound();
  }

  // Validate locale
  if (!product.locales.includes(locale)) {
    notFound();
  }

  const feature = getFeatureFromManifest(productSlug, version, featureSlug);

  if (!feature) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-2">
          <Link
            href={`/${productSlug}/${locale}`}
            className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
          >
            &larr; {product.name}
          </Link>
        </div>
        <div className="mt-8 rounded-lg border border-[#E8E6E1] bg-white p-12 text-center">
          <h2 className="font-serif text-xl font-semibold text-[#1A1A1A]">
            Not available in this version
          </h2>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            This feature does not exist in v{version}. Try switching to a
            different version.
          </p>
          <div className="mt-6 flex justify-center">
            <VersionSelector
              productSlug={productSlug}
              locale={locale}
              featureSlug={featureSlug}
              currentVersion={version}
              versions={product.versions}
              latestVersion={product.latest}
            />
          </div>
        </div>
      </div>
    );
  }

  const html = await renderFeatureDoc(productSlug, version, locale, featureSlug);
  const rawMarkdown = await loadFeatureDoc(productSlug, version, locale, featureSlug);

  if (!html || !rawMarkdown) {
    notFound();
  }

  // Resolve video URLs with locale fallback
  const videoUrls = buildVideoUrlMap(html, productSlug, version, locale);
  const featureTitle = getLocalizedValue(
    feature.title,
    locale,
    product.defaultLocale
  );
  const isLatest = version === product.latest;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-2">
        <Link
          href={`/${productSlug}/${locale}`}
          className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
        >
          &larr; {product.name}
        </Link>
      </div>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1A1A1A]">
            {featureTitle}
          </h1>
          {!isLatest && (
            <p className="mt-1 text-xs text-[#E65100]">
              You are viewing an older version (v{version}). The latest is v
              {product.latest}.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <LocaleSwitcher
            locales={product.locales}
            currentLocale={locale}
          />
          <FeedbackButton
            product={productSlug}
            feature={featureSlug}
            version={version}
            locale={locale}
          />
          <VersionSelector
            productSlug={productSlug}
            locale={locale}
            featureSlug={featureSlug}
            currentVersion={version}
            versions={product.versions}
            latestVersion={product.latest}
          />
        </div>
      </div>

      <div className="rounded-lg border border-[#E8E6E1] bg-white p-8">
        <InlineEditor
          product={productSlug}
          version={version}
          locale={locale}
          slug={featureSlug}
          initialMarkdown={rawMarkdown}
          renderedHtml={html}
        />
      </div>
    </div>
  );
}

/**
 * Extract all video references from rendered HTML and resolve their URLs.
 */
function buildVideoUrlMap(
  html: string,
  productSlug: string,
  version: string,
  locale: string
): Record<string, { url: string; exists: boolean }> {
  const videoPattern =
    /data-video="([^"]+)"/g;
  const urls: Record<string, { url: string; exists: boolean }> = {};

  let match: RegExpExecArray | null;
  while ((match = videoPattern.exec(html)) !== null) {
    const videoRef = match[1];
    if (!urls[videoRef]) {
      // The video reference in markdown is like "videos/demo_day_view.mp4"
      // We need to extract just the filename for the locale-aware resolver
      const filename = videoRef.replace(/^videos\//, "");
      const url = resolveVideoUrl(productSlug, version, locale, filename);
      const exists = videoExistsOnDisk(productSlug, version, locale, filename);
      urls[videoRef] = { url, exists };
    }
  }

  return urls;
}
