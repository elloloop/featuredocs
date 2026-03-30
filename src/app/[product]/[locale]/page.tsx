import { notFound } from "next/navigation";
import Link from "next/link";
import { loadProduct, loadFeatures, getLocalizedValue } from "@/lib/content";
import { getFeedbackCountForFeature } from "@/lib/feedback-db";
import FeatureCard from "@/components/FeatureCard";
import LocaleSwitcher from "@/components/LocaleSwitcher";

interface ProductLocalePageProps {
  params: Promise<{ product: string; locale: string }>;
}

export default async function ProductLocalePage({
  params,
}: ProductLocalePageProps) {
  const { product: productSlug, locale } = await params;
  const product = loadProduct(productSlug);

  if (!product) {
    notFound();
  }

  // Validate locale is supported
  if (!product.locales.includes(locale)) {
    notFound();
  }

  const latestManifest = loadFeatures(productSlug, product.latest);

  if (!latestManifest) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-2">
        <Link
          href="/"
          className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
        >
          &larr; All Products
        </Link>
      </div>

      <div className="mb-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-[#1A1A1A]">
              {product.name}
            </h1>
            <p className="mt-1 text-sm text-[#6B6B6B]">{product.tagline}</p>
          </div>
          <div className="flex items-center gap-3">
            <LocaleSwitcher
              locales={product.locales}
              currentLocale={locale}
            />
            <Link
              href={`/${productSlug}/changelog`}
              className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors underline underline-offset-2"
            >
              Changelog
            </Link>
            <span className="rounded-full bg-[#F5F5F0] px-2.5 py-1 text-xs text-[#6B6B6B]">
              v{product.latest}
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
          {product.description}
        </p>
      </div>

      <div className="grid gap-3">
        {latestManifest.features.map((feature) => {
          const feedbackCount = getFeedbackCountForFeature(
            productSlug,
            feature.slug,
            product.latest
          );
          return (
            <FeatureCard
              key={feature.slug}
              feature={feature}
              productSlug={productSlug}
              locale={locale}
              defaultLocale={product.defaultLocale}
              version={product.latest}
              feedbackCount={feedbackCount}
            />
          );
        })}
      </div>
    </div>
  );
}
