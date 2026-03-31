import { notFound } from "next/navigation";
import Link from "next/link";
import {
  loadProduct,
  loadFeatures,
  loadFeatureDocument,
  generateAllFeatureParams,
} from "@/lib/content-static";
import { renderMarkdown } from "@/lib/markdown";
import VersionSelector from "@/components/VersionSelector";
import FeedbackButton from "@/components/FeedbackButton";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import FeatureDocContent from "@/components/FeatureDocContent";

export function generateStaticParams() {
  return generateAllFeatureParams();
}

interface FeatureVersionPageProps {
  params: Promise<{
    product: string;
    locale: string;
    feature: string;
    version: string;
  }>;
}

/** Resolve a localized value with fallback to default locale, then first available. */
function getLocalizedValue(
  localizedMap: Record<string, string>,
  locale: string,
  defaultLocale: string,
): string {
  return (
    localizedMap[locale] ??
    localizedMap[defaultLocale] ??
    Object.values(localizedMap)[0] ??
    ""
  );
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

  if (!product.locales.includes(locale)) {
    notFound();
  }

  const features = loadFeatures(productSlug, version);
  const feature = features.find((f) => f.slug === featureSlug);

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

  const rawMarkdown =
    loadFeatureDocument(
      productSlug,
      version,
      locale,
      featureSlug,
      product.defaultLocale,
    ) ?? "";

  const renderedHtml = renderMarkdown(rawMarkdown, productSlug);

  const featureTitle = getLocalizedValue(
    feature.title,
    locale,
    product.defaultLocale,
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
        <FeatureDocContent
          product={productSlug}
          version={version}
          locale={locale}
          slug={featureSlug}
          initialMarkdown={rawMarkdown}
          renderedHtml={renderedHtml}
        />
      </div>
    </div>
  );
}
