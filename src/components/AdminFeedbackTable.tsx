"use client";

import { useState, useEffect, useCallback } from "react";
import type { FeedbackItem } from "@/lib/types";

export default function AdminFeedbackTable() {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProduct) params.set("product", filterProduct);
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("type", filterType);

      const response = await fetch(`/api/admin/feedback?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setFeedbackItems(data);
      }
    } catch {
      // Silent failure for admin page
    } finally {
      setIsLoading(false);
    }
  }, [filterProduct, filterStatus, filterType]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  async function handleStatusUpdate(id: number, status: string) {
    try {
      const response = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (response.ok) {
        fetchFeedback();
      }
    } catch {
      // Silent failure
    }
  }

  const uniqueProducts = Array.from(
    new Set(feedbackItems.map((item) => item.product))
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <label
            htmlFor="filter-product"
            className="mr-2 text-xs text-[#6B6B6B]"
          >
            Product:
          </label>
          <select
            id="filter-product"
            value={filterProduct}
            onChange={(event) => setFilterProduct(event.target.value)}
            className="rounded border border-[#E8E6E1] bg-white px-2 py-1 text-xs text-[#1A1A1A] focus:border-[#6B6B6B] focus:outline-none"
          >
            <option value="">All</option>
            {uniqueProducts.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-status"
            className="mr-2 text-xs text-[#6B6B6B]"
          >
            Status:
          </label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className="rounded border border-[#E8E6E1] bg-white px-2 py-1 text-xs text-[#1A1A1A] focus:border-[#6B6B6B] focus:outline-none"
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="fixed">Fixed</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-type"
            className="mr-2 text-xs text-[#6B6B6B]"
          >
            Type:
          </label>
          <select
            id="filter-type"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            className="rounded border border-[#E8E6E1] bg-white px-2 py-1 text-xs text-[#1A1A1A] focus:border-[#6B6B6B] focus:outline-none"
          >
            <option value="">All</option>
            <option value="text">Text</option>
            <option value="video">Video</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-[#6B6B6B]">
          Loading feedback...
        </div>
      ) : feedbackItems.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#6B6B6B]">
          No feedback items found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E8E6E1]">
                <th className="pb-3 pr-4 text-xs font-medium text-[#6B6B6B]">
                  Date
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-[#6B6B6B]">
                  Product
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-[#6B6B6B]">
                  Feature
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-[#6B6B6B]">
                  Locale
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-[#6B6B6B]">
                  Type
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-[#6B6B6B]">
                  Content
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-[#6B6B6B]">
                  Status
                </th>
                <th className="pb-3 text-xs font-medium text-[#6B6B6B]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {feedbackItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[#E8E6E1] last:border-0"
                >
                  <td className="py-3 pr-4 text-xs text-[#6B6B6B] whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="py-3 pr-4 text-xs text-[#1A1A1A]">
                    {item.product}
                  </td>
                  <td className="py-3 pr-4 text-xs text-[#1A1A1A]">
                    {item.feature}
                  </td>
                  <td className="py-3 pr-4 text-xs text-[#6B6B6B]">
                    {item.locale}
                  </td>
                  <td className="py-3 pr-4">
                    <TypeBadge type={item.type} />
                  </td>
                  <td className="max-w-xs py-3 pr-4">
                    {item.selectedText && (
                      <p className="mb-1 text-xs italic text-[#6B6B6B] line-clamp-2">
                        &ldquo;{item.selectedText}&rdquo;
                      </p>
                    )}
                    {item.videoReference && (
                      <p className="mb-1 font-mono text-xs text-[#6B6B6B]">
                        {item.videoReference}
                      </p>
                    )}
                    <p className="text-xs text-[#1A1A1A] line-clamp-2">
                      {item.comment}
                    </p>
                    {item.email && (
                      <p className="mt-1 text-xs text-[#B0B0B0]">
                        {item.email}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1">
                      {item.status === "open" && (
                        <>
                          <ActionButton
                            label="Ack"
                            onClick={() =>
                              handleStatusUpdate(item.id, "acknowledged")
                            }
                          />
                          <ActionButton
                            label="Fix"
                            onClick={() =>
                              handleStatusUpdate(item.id, "fixed")
                            }
                          />
                          <ActionButton
                            label="Dismiss"
                            onClick={() =>
                              handleStatusUpdate(item.id, "dismissed")
                            }
                          />
                        </>
                      )}
                      {item.status === "acknowledged" && (
                        <>
                          <ActionButton
                            label="Fix"
                            onClick={() =>
                              handleStatusUpdate(item.id, "fixed")
                            }
                          />
                          <ActionButton
                            label="Dismiss"
                            onClick={() =>
                              handleStatusUpdate(item.id, "dismissed")
                            }
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    text: "bg-[#E3F2FD] text-[#1565C0]",
    video: "bg-[#F3E5F5] text-[#7B1FA2]",
    general: "bg-[#F5F5F5] text-[#616161]",
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] ?? colors.general}`}
    >
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "bg-[#FFF3E0] text-[#E65100]",
    acknowledged: "bg-[#E3F2FD] text-[#1565C0]",
    fixed: "bg-[#E8F5E9] text-[#2E7D32]",
    dismissed: "bg-[#F5F5F5] text-[#9E9E9E]",
  };

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.open}`}
    >
      {status}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded border border-[#E8E6E1] bg-white px-2 py-1 text-xs text-[#6B6B6B] transition-colors hover:border-[#C8C6C1] hover:text-[#1A1A1A]"
    >
      {label}
    </button>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
