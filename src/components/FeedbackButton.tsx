"use client";

import { useState } from "react";
import FeedbackDialog from "./FeedbackDialog";

interface FeedbackButtonProps {
  product: string;
  feature: string;
  version: string;
  locale: string;
}

export default function FeedbackButton({
  product,
  feature,
  version,
  locale,
}: FeedbackButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsDialogOpen(true)}
        className="inline-flex items-center gap-1.5 rounded border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs text-[#6B6B6B] transition-colors hover:border-[#C8C6C1] hover:text-[#1A1A1A]"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M1.5 1.5h5l-1.5 2.25L6.5 6H1.5V1.5ZM1.5 6v4.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Report outdated
      </button>
      <FeedbackDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        product={product}
        feature={feature}
        version={version}
        locale={locale}
        type="general"
      />
    </>
  );
}
