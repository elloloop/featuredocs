import { redirect, notFound } from "next/navigation";
import { listProducts, loadProduct } from "@/lib/content-static";

export function generateStaticParams() {
  return listProducts().map((product) => ({
    product: product.slug,
  }));
}

interface ProductPageProps {
  params: Promise<{ product: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { product: productSlug } = await params;
  const product = loadProduct(productSlug);

  if (!product) {
    notFound();
  }

  redirect(`/${productSlug}/${product.defaultLocale}`);
}
