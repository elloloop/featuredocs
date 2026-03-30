"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import FeedbackDialog from "./FeedbackDialog";

interface TextSelectionFeedbackProps {
  product: string;
  feature: string;
  version: string;
  locale: string;
}

interface PopoverPosition {
  top: number;
  left: number;
}

export default function TextSelectionFeedback({
  product,
  feature,
  version,
  locale,
}: TextSelectionFeedbackProps) {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] =
    useState<PopoverPosition | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopoverPosition(null);
      setSelectedText(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 3) {
      setPopoverPosition(null);
      setSelectedText(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectedText(text);
    setPopoverPosition({
      top: rect.top + window.scrollY - 40,
      left: rect.left + window.scrollX + rect.width / 2,
    });
  }, []);

  const handleOpenDialog = useCallback(() => {
    setIsDialogOpen(true);
    setPopoverPosition(null);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setSelectedText(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setPopoverPosition(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {popoverPosition && (
        <div
          ref={popoverRef}
          className="absolute z-40 -translate-x-1/2 animate-in fade-in"
          style={{
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
          }}
        >
          <button
            onClick={handleOpenDialog}
            className="flex items-center gap-1.5 rounded-md border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6B6B] shadow-lg transition-colors hover:text-[#1A1A1A]"
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
            Mark as outdated
          </button>
        </div>
      )}
      <FeedbackDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        product={product}
        feature={feature}
        version={version}
        locale={locale}
        type="text"
        selectedText={selectedText ?? undefined}
      />
    </>
  );
}
