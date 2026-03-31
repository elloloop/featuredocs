import { redirect, notFound } from "next/navigation";
import {
  listProducts,
  loadProduct,
  loadFeatures,
} from "@/lib/content-static";

export function generateStaticParams() {
  const products = listProducts();
  const params: Array<{
    product: string;
    locale: string;
    feature: string;
  }> = [];

  for (const product of products) {
    const features = loadFeatures(product.slug, product.latest);
    for (const locale of product.locales) {
      for (const feature of features) {
        params.push({
          product: product.slug,
          locale,
          feature: feature.slug,
        });
      }
    }
  }

  return params;
}

interface FeatureRedirectPageProps {
  params: Promise<{ product: string; locale: string; feature: string }>;
}

export default async function FeatureRedirectPage({
  params,
}: FeatureRedirectPageProps) {
  const { product: productSlug, locale, feature: featureSlug } = await params;
  const product = loadProduct(productSlug);

  if (!product) {
    notFound();
  }

  redirect(`/${productSlug}/${locale}/${featureSlug}/${product.latest}`);
}
