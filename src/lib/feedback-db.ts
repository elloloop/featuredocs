import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { FeedbackItem, FeedbackCreateInput } from "./types";

const DATABASE_DIR = path.join(process.cwd(), ".data");
const DATABASE_PATH = path.join(DATABASE_DIR, "feedback.db");

function getDatabase(): Database.Database {
  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }

  const db = new Database(DATABASE_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product TEXT NOT NULL,
      feature TEXT NOT NULL,
      version TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      type TEXT NOT NULL CHECK(type IN ('text', 'video', 'general')),
      selected_text TEXT,
      video_reference TEXT,
      comment TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'acknowledged', 'fixed', 'dismissed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
  `);

  return db;
}

function rowToFeedbackItem(row: Record<string, unknown>): FeedbackItem {
  return {
    id: row.id as number,
    product: row.product as string,
    feature: row.feature as string,
    version: row.version as string,
    locale: (row.locale as string) ?? "en",
    type: row.type as FeedbackItem["type"],
    selectedText: row.selected_text as string | null,
    videoReference: row.video_reference as string | null,
    comment: row.comment as string,
    email: row.email as string | null,
    status: row.status as FeedbackItem["status"],
    createdAt: row.created_at as string,
    resolvedAt: row.resolved_at as string | null,
  };
}

export function createFeedback(input: FeedbackCreateInput): FeedbackItem {
  const db = getDatabase();
  try {
    const stmt = db.prepare(`
      INSERT INTO feedback (product, feature, version, locale, type, selected_text, video_reference, comment, email)
      VALUES (@product, @feature, @version, @locale, @type, @selectedText, @videoReference, @comment, @email)
    `);

    const result = stmt.run({
      product: input.product,
      feature: input.feature,
      version: input.version,
      locale: input.locale,
      type: input.type,
      selectedText: input.selectedText ?? null,
      videoReference: input.videoReference ?? null,
      comment: input.comment,
      email: input.email ?? null,
    });

    const row = db
      .prepare("SELECT * FROM feedback WHERE id = ?")
      .get(result.lastInsertRowid) as Record<string, unknown>;

    return rowToFeedbackItem(row);
  } finally {
    db.close();
  }
}

export function getFeedbackList(filters?: {
  product?: string;
  status?: string;
  type?: string;
}): FeedbackItem[] {
  const db = getDatabase();
  try {
    const conditions: string[] = [];
    const params: Record<string, string> = {};

    if (filters?.product) {
      conditions.push("product = @product");
      params.product = filters.product;
    }
    if (filters?.status) {
      conditions.push("status = @status");
      params.status = filters.status;
    }
    if (filters?.type) {
      conditions.push("type = @type");
      params.type = filters.type;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `SELECT * FROM feedback ${whereClause} ORDER BY created_at DESC`;

    const rows = db.prepare(query).all(params) as Record<string, unknown>[];
    return rows.map(rowToFeedbackItem);
  } finally {
    db.close();
  }
}

export function updateFeedbackStatus(
  id: number,
  status: FeedbackItem["status"]
): FeedbackItem | null {
  const db = getDatabase();
  try {
    const resolvedAt =
      status === "fixed" || status === "dismissed"
        ? new Date().toISOString()
        : null;

    db.prepare(
      "UPDATE feedback SET status = @status, resolved_at = @resolvedAt WHERE id = @id"
    ).run({ id, status, resolvedAt });

    const row = db
      .prepare("SELECT * FROM feedback WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;

    if (!row) return null;
    return rowToFeedbackItem(row);
  } finally {
    db.close();
  }
}

export function getFeedbackCountForFeature(
  product: string,
  feature: string,
  version: string
): number {
  const db = getDatabase();
  try {
    const row = db
      .prepare(
        "SELECT COUNT(*) as count FROM feedback WHERE product = ? AND feature = ? AND version = ? AND status = 'open'"
      )
      .get(product, feature, version) as { count: number };
    return row.count;
  } finally {
    db.close();
  }
}
