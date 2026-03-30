"use client";

import { useState, useCallback, useRef } from "react";

interface InlineEditorProps {
  product: string;
  version: string;
  locale: string;
  slug: string;
  initialMarkdown: string;
  renderedHtml: string;
}

export default function InlineEditor({
  product,
  version,
  locale,
  slug,
  initialMarkdown,
  renderedHtml,
}: InlineEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [editMessage, setEditMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setMarkdown(initialMarkdown);
    setEditMessage("");
    setSaveResult(null);
  }, [initialMarkdown]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setMarkdown(initialMarkdown);
    setEditMessage("");
    setSaveResult(null);
  }, [initialMarkdown]);

  const handleSave = useCallback(async () => {
    if (!editMessage.trim()) return;

    setIsSaving(true);
    setSaveResult(null);

    try {
      const response = await fetch("/api/content/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product,
          version,
          locale,
          slug,
          content: markdown,
          editMessage: editMessage.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSaveResult({ success: true, message: data.message });
        setTimeout(() => {
          setIsEditing(false);
          setSaveResult(null);
          window.location.reload();
        }, 1500);
      } else {
        setSaveResult({
          success: false,
          message: data.error ?? "Failed to save",
        });
      }
    } catch {
      setSaveResult({ success: false, message: "Network error. Try again." });
    } finally {
      setIsSaving(false);
    }
  }, [markdown, editMessage, product, version, locale, slug]);

  const insertMarkdown = useCallback(
    (prefix: string, suffix: string = "") => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = markdown.slice(start, end);
      const replacement = prefix + (selected || "text") + suffix;
      const updated =
        markdown.slice(0, start) + replacement + markdown.slice(end);

      setMarkdown(updated);

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = start + prefix.length + (selected || "text").length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [markdown]
  );

  if (!isEditing) {
    return (
      <div>
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleStartEdit}
            className="inline-flex items-center gap-1.5 rounded border border-[#E8E6E1] bg-white px-3 py-1.5 text-xs text-[#6B6B6B] transition-colors hover:border-[#C8C6C1] hover:text-[#1A1A1A]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Edit
          </button>
        </div>
        <div
          className="prose-featuredocs"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-1 rounded-t border border-[#E8E6E1] bg-[#FAF9F6] px-3 py-2">
        <ToolbarButton
          label="Bold"
          onClick={() => insertMarkdown("**", "**")}
          icon={<span className="text-xs font-bold">B</span>}
        />
        <ToolbarButton
          label="Heading"
          onClick={() => insertMarkdown("## ")}
          icon={<span className="text-xs font-bold">H</span>}
        />
        <ToolbarButton
          label="List"
          onClick={() => insertMarkdown("- ")}
          icon={<span className="text-xs">-</span>}
        />
        <ToolbarButton
          label="Link"
          onClick={() => insertMarkdown("[", "](url)")}
          icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M5 7l2-2M3.5 7.5l-1-1a2.12 2.12 0 010-3l1-1a2.12 2.12 0 013 0M5.5 4.5l1 1a2.12 2.12 0 010 3l-1 1a2.12 2.12 0 01-3 0"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </svg>
          }
        />
        <ToolbarButton
          label="Video"
          onClick={() => insertMarkdown('::video[videos/', '.mp4]{title="Video title"}')}
          icon={
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect
                x="1"
                y="2.5"
                width="10"
                height="7"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1"
              />
              <path d="M5 5v2.5l2-1.25L5 5z" fill="currentColor" />
            </svg>
          }
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="rounded px-3 py-1 text-xs text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !editMessage.trim()}
            className="rounded bg-[#1A1A1A] px-3 py-1 text-xs text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Edit message */}
      <div className="mb-3">
        <input
          type="text"
          value={editMessage}
          onChange={(event) => setEditMessage(event.target.value)}
          placeholder="Describe your change..."
          className="w-full rounded border border-[#E8E6E1] bg-white px-3 py-2 text-xs text-[#1A1A1A] placeholder:text-[#B0B0B0] focus:border-[#6B6B6B] focus:outline-none focus:ring-1 focus:ring-[#6B6B6B]"
        />
      </div>

      {/* Editor and preview side-by-side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium text-[#6B6B6B]">
            Markdown
          </div>
          <textarea
            ref={textareaRef}
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            className="h-[500px] w-full resize-y rounded border border-[#E8E6E1] bg-white p-4 font-mono text-sm text-[#1A1A1A] focus:border-[#6B6B6B] focus:outline-none focus:ring-1 focus:ring-[#6B6B6B]"
            spellCheck={false}
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-[#6B6B6B]">
            Preview
          </div>
          <div className="h-[500px] overflow-y-auto rounded border border-[#E8E6E1] bg-white p-4">
            <div
              className="prose-featuredocs"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        </div>
      </div>

      {/* Save result notification */}
      {saveResult && (
        <div
          className={`mt-3 rounded p-3 text-xs ${
            saveResult.success
              ? "bg-[#E8F5E9] text-[#2E7D32]"
              : "bg-[#FFF3E0] text-[#E65100]"
          }`}
        >
          {saveResult.message}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded text-[#6B6B6B] transition-colors hover:bg-[#E8E6E1] hover:text-[#1A1A1A]"
    >
      {icon}
    </button>
  );
}
