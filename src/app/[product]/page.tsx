import { notFound, redirect } from "next/navigation";
import { loadProduct } from "@/lib/content";

interface ProductPageProps {
  params: Promise<{ product: string }>;
}

/**
 * /[product] redirects to /[product]/[defaultLocale]
 * This ensures every product page has a locale in the URL.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { product: productSlug } = await params;
  const product = loadProduct(productSlug);

  if (!product) {
    notFound();
  }

  redirect(`/${productSlug}/${product.defaultLocale}`);
}
