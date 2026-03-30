import { NextRequest, NextResponse } from "next/server";
import { createFeedback, getFeedbackList } from "@/lib/feedback-db";
import type { FeedbackCreateInput } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validationError = validateFeedbackInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const input: FeedbackCreateInput = {
      product: body.product,
      feature: body.feature,
      version: body.version,
      locale: body.locale ?? "en",
      type: body.type,
      selectedText: body.selectedText,
      videoReference: body.videoReference,
      comment: body.comment,
      email: body.email,
    };

    const feedback = createFeedback(input);
    return NextResponse.json(feedback, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const product = searchParams.get("product") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const type = searchParams.get("type") ?? undefined;

    const feedback = getFeedbackList({ product, status, type });
    return NextResponse.json(feedback);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

function validateFeedbackInput(
  body: Record<string, unknown>
): string | null {
  if (!body.product || typeof body.product !== "string") {
    return "product is required";
  }
  if (!body.feature || typeof body.feature !== "string") {
    return "feature is required";
  }
  if (!body.version || typeof body.version !== "string") {
    return "version is required";
  }
  if (
    !body.type ||
    !["text", "video", "general"].includes(body.type as string)
  ) {
    return "type must be one of: text, video, general";
  }
  if (!body.comment || typeof body.comment !== "string") {
    return "comment is required";
  }
  if (body.email && typeof body.email !== "string") {
    return "email must be a string";
  }
  return null;
}
