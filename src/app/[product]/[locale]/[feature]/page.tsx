import { notFound, redirect } from "next/navigation";
import { loadProduct } from "@/lib/content";

interface FeaturePageProps {
  params: Promise<{ product: string; locale: string; feature: string }>;
}

/**
 * /[product]/[locale]/[feature] redirects to the latest version.
 */
export default async function FeatureLatestPage({ params }: FeaturePageProps) {
  const { product: productSlug, locale, feature: featureSlug } = await params;
  const product = loadProduct(productSlug);

  if (!product) {
    notFound();
  }

  redirect(`/${productSlug}/${locale}/${featureSlug}/${product.latest}`);
}
