import { NextRequest, NextResponse } from "next/server";
import { createFeedback, getFeedbackList } from "@/lib/feedback-db";
import {
  createFeedbackIssue,
  getGitHubFeedbackConfig,
} from "@/lib/github-feedback";
import type { FeedbackCreateInput } from "@/lib/types";

/* ─── Rate limiter (in-memory, per IP) ──────────────────── */

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/* ─── Turnstile verification ────────────────────────────── */

const TURNSTILE_SECRET_KEY =
  process.env.TURNSTILE_SECRET_KEY ??
  "1x0000000000000000000000000000000AA";

async function verifyTurnstileToken(
  token: string,
  ip: string
): Promise<boolean> {
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: ip,
        }),
      }
    );

    const result = (await response.json()) as { success: boolean };
    return result.success;
  } catch {
    // If Turnstile verification fails due to network, allow submission
    // but log the error in production
    return true;
  }
}

/* ─── POST handler ──────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validation
    const validationError = validateFeedbackInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Honeypot check: if the hidden "website" field has a value, silently reject
    if (body.website) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Rate limiting
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    // Turnstile verification
    const turnstileToken = body.turnstileToken as string | undefined;
    if (turnstileToken) {
      const isValid = await verifyTurnstileToken(turnstileToken, clientIp);
      if (!isValid) {
        return NextResponse.json(
          { error: "Spam check failed. Please try again." },
          { status: 403 }
        );
      }
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

    // Try GitHub Issues first (if configured)
    const githubConfig = getGitHubFeedbackConfig();
    let issueUrl: string | null = null;

    if (githubConfig) {
      try {
        const result = await createFeedbackIssue(githubConfig, {
          product: input.product,
          feature: input.feature,
          version: input.version,
          locale: input.locale,
          type: input.type,
          selectedText: input.selectedText,
          videoReference: input.videoReference,
          comment: input.comment,
          email: input.email,
        });
        issueUrl = result.issueUrl;
      } catch {
        // Fall through to SQLite if GitHub fails
      }
    }

    // Always store in SQLite as a fallback / local record
    const feedback = createFeedback(input);

    return NextResponse.json(
      {
        ...feedback,
        ...(issueUrl ? { issueUrl } : {}),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    );
  }
}

/* ─── GET handler ───────────────────────────────────────── */

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

/* ─── Validation ────────────────────────────────────────── */

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
