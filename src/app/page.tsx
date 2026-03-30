import Link from "next/link";
import { listProducts } from "@/lib/content";

export default function HomePage() {
  const products = listProducts();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-bold text-[#1A1A1A]">
          Products
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Browse feature documentation for all products.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border border-[#E8E6E1] bg-white p-12 text-center">
          <p className="text-sm text-[#6B6B6B]">
            No products found. Add a product directory under{" "}
            <code className="rounded bg-[#F5F5F0] px-1.5 py-0.5 font-mono text-xs">
              content/
            </code>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <Link
              key={product.slug}
              href={`/${product.slug}`}
              className="group block rounded-lg border border-[#E8E6E1] bg-white p-6 transition-all hover:border-[#C8C6C1] hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-[#1A1A1A] group-hover:opacity-80 transition-opacity">
                    {product.name}
                  </h2>
                  <p className="mt-1 text-sm text-[#6B6B6B]">
                    {product.tagline}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
                    {product.description}
                  </p>
                </div>
                <span className="ml-4 shrink-0 rounded-full bg-[#F5F5F0] px-2.5 py-1 text-xs text-[#6B6B6B]">
                  v{product.latest}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
