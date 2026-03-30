import { NextRequest, NextResponse } from "next/server";
import { saveFeatureDoc, loadProduct } from "@/lib/content";
import type { ContentSaveInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ContentSaveInput;

    const validationError = validateSaveInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const product = loadProduct(body.product);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    if (!product.versions.includes(body.version)) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    saveFeatureDoc(
      body.product,
      body.version,
      body.locale,
      body.slug,
      body.content
    );

    return NextResponse.json({
      success: true,
      message: `Saved ${body.slug}.md for ${body.locale} (${body.editMessage})`,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to save content" },
      { status: 500 }
    );
  }
}

function validateSaveInput(body: ContentSaveInput): string | null {
  if (!body.product || typeof body.product !== "string") {
    return "product is required";
  }
  if (!body.version || typeof body.version !== "string") {
    return "version is required";
  }
  if (!body.locale || typeof body.locale !== "string") {
    return "locale is required";
  }
  if (!body.slug || typeof body.slug !== "string") {
    return "slug is required";
  }
  if (typeof body.content !== "string") {
    return "content is required";
  }
  if (!body.editMessage || typeof body.editMessage !== "string") {
    return "editMessage is required";
  }
  return null;
}
