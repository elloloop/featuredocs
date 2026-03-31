import { notFound } from "next/navigation";
import Link from "next/link";
import {
  listProducts,
  loadProduct,
  loadFeatures,
  loadVersionManifest,
} from "@/lib/content-static";
import FeatureCard from "@/components/FeatureCard";
import LocaleSwitcher from "@/components/LocaleSwitcher";

export function generateStaticParams() {
  const products = listProducts();
  return products.flatMap((product) =>
    product.locales.map((locale) => ({
      product: product.slug,
      locale,
    })),
  );
}

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

  if (!product.locales.includes(locale)) {
    notFound();
  }

  const features = loadFeatures(productSlug, product.latest);
  const manifest = loadVersionManifest(productSlug, product.latest);
  const versionStatus = manifest?.status ?? "draft";
  const isPublished = versionStatus === "published";

  if (!isPublished) {
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
        <div className="mt-8 rounded-lg border border-[#E8E6E1] bg-white p-12 text-center">
          <h2 className="font-serif text-xl font-semibold text-[#1A1A1A]">
            No published versions
          </h2>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            This product has no published versions yet.
          </p>
        </div>
      </div>
    );
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
      </div>

      <div className="grid gap-3">
        {features.map((feature) => (
          <FeatureCard
            key={feature.slug}
            feature={feature}
            productSlug={productSlug}
            locale={locale}
            defaultLocale={product.defaultLocale}
            version={product.latest}
            feedbackCount={0}
          />
        ))}
      </div>
    </div>
  );
}
