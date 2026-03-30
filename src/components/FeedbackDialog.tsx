"use client";

import { useState, useCallback, useRef, useEffect } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          size?: "invisible" | "normal" | "compact";
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: string;
  feature: string;
  version: string;
  locale: string;
  type: "text" | "video" | "general";
  selectedText?: string;
  videoReference?: string;
}

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

export default function FeedbackDialog({
  isOpen,
  onClose,
  product,
  feature,
  version,
  locale,
  type,
  selectedText,
  videoReference,
}: FeedbackDialogProps) {
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function loadTurnstile() {
      if (window.turnstile && turnstileContainerRef.current) {
        if (turnstileWidgetId.current) {
          window.turnstile.remove(turnstileWidgetId.current);
        }
        turnstileWidgetId.current = window.turnstile.render(
          turnstileContainerRef.current,
          {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token: string) => {
              setTurnstileToken(token);
            },
            "error-callback": () => {
              setTurnstileToken(null);
            },
            size: "invisible",
          }
        );
        return;
      }

      // Load script if not present
      if (!document.querySelector('script[src*="turnstile"]')) {
        const script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.onload = () => {
          // Small delay for turnstile to initialize
          setTimeout(loadTurnstile, 100);
        };
        document.head.appendChild(script);
      } else {
        // Script already in DOM but turnstile not ready yet
        setTimeout(loadTurnstile, 100);
      }
    }

    loadTurnstile();

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!comment.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          feature,
          version,
          locale,
          type,
          selectedText,
          videoReference,
          comment: comment.trim(),
          email: email.trim() || undefined,
          website: honeypot,
          turnstileToken: turnstileToken ?? "",
        }),
      });

      if (response.status === 429) {
        setError("Too many submissions. Please try again later.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setComment("");
        setEmail("");
        setHoneypot("");
        setTurnstileToken(null);
        setSubmitted(false);
      }, 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    comment,
    email,
    honeypot,
    turnstileToken,
    product,
    feature,
    version,
    locale,
    type,
    selectedText,
    videoReference,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="mx-4 w-full max-w-md rounded-lg border border-[#E8E6E1] bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {submitted ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9]">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 10l4 4 8-8"
                  stroke="#2E7D32"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#1A1A1A]">
              Thank you for your feedback!
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-[#1A1A1A]">
                Report Content
              </h3>
              <button
                onClick={onClose}
                className="text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {selectedText && (
              <div className="mb-4 rounded border border-[#E8E6E1] bg-[#FAF9F6] p-3">
                <p className="mb-1 text-xs font-medium text-[#6B6B6B]">
                  Selected text:
                </p>
                <p className="text-sm italic text-[#1A1A1A] line-clamp-3">
                  &ldquo;{selectedText}&rdquo;
                </p>
              </div>
            )}

            {videoReference && (
              <div className="mb-4 rounded border border-[#E8E6E1] bg-[#FAF9F6] p-3">
                <p className="text-xs text-[#6B6B6B]">
                  Reporting video:{" "}
                  <span className="font-mono">{videoReference}</span>
                </p>
              </div>
            )}

            <div className="mb-4">
              <label
                htmlFor="feedback-comment"
                className="mb-1.5 block text-sm font-medium text-[#1A1A1A]"
              >
                What&apos;s outdated or incorrect?
              </label>
              <textarea
                id="feedback-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                className="w-full rounded border border-[#E8E6E1] bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder:text-[#B0B0B0] focus:border-[#6B6B6B] focus:outline-none focus:ring-1 focus:ring-[#6B6B6B]"
                rows={3}
                placeholder="What's outdated or incorrect?"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="feedback-email"
                className="mb-1.5 block text-sm font-medium text-[#1A1A1A]"
              >
                Email <span className="text-[#B0B0B0]">(optional)</span>
              </label>
              <input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded border border-[#E8E6E1] bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder:text-[#B0B0B0] focus:border-[#6B6B6B] focus:outline-none focus:ring-1 focus:ring-[#6B6B6B]"
                placeholder="your@email.com"
              />
            </div>

            {/* Honeypot field — hidden from real users */}
            <input
              name="website"
              type="text"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
              style={{ display: "none" }}
              aria-hidden="true"
            />

            {/* Turnstile widget container (invisible mode) */}
            <div ref={turnstileContainerRef} />

            {error && (
              <p className="mb-4 text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded px-4 py-2 text-sm text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!comment.trim() || isSubmitting}
                className="rounded bg-[#1A1A1A] px-4 py-2 text-sm text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
