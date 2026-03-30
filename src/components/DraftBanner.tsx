"use client";

import { useCallback } from "react";

interface DraftBannerProps {
  showPublishButton?: boolean;
  product?: string;
  version?: string;
}

export default function DraftBanner({
  showPublishButton,
  product,
  version,
}: DraftBannerProps) {
  const handlePublish = useCallback(async () => {
    if (!product || !version) return;

    const confirmed = window.confirm(
      `Publish version ${version} of ${product}? This will make it visible to all users.`
    );
    if (!confirmed) return;

    const response = await fetch("/api/content/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, version }),
    });

    if (response.ok) {
      window.location.reload();
    } else {
      const data = await response.json();
      alert(data.error ?? "Failed to publish");
    }
  }, [product, version]);

  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-yellow-600"
        >
          <path
            d="M8 1l1.5 4.5H14l-3.5 2.5L12 12.5 8 10l-4 2.5 1.5-4.5L2 5.5h4.5L8 1z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-sm font-medium text-yellow-800">
          Draft — only visible to editors
        </span>
      </div>
      {showPublishButton && product && version && (
        <button
          onClick={handlePublish}
          className="rounded bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
        >
          Publish
        </button>
      )}
    </div>
  );
}
