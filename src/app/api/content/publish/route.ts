import { NextRequest, NextResponse } from "next/server";
import { loadProduct, loadFeatures, setVersionStatus } from "@/lib/content";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      product: string;
      version: string;
    };

    if (!body.product || typeof body.product !== "string") {
      return NextResponse.json(
        { error: "product is required" },
        { status: 400 }
      );
    }
    if (!body.version || typeof body.version !== "string") {
      return NextResponse.json(
        { error: "version is required" },
        { status: 400 }
      );
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

    const manifest = loadFeatures(body.product, body.version);
    if (!manifest) {
      return NextResponse.json(
        { error: "Version manifest not found" },
        { status: 404 }
      );
    }

    setVersionStatus(body.product, body.version, "published");

    return NextResponse.json({
      success: true,
      message: `Version ${body.version} of ${body.product} is now published.`,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to publish version" },
      { status: 500 }
    );
  }
}
