import fs from "fs";
import path from "path";

export interface FeaturedocsConfig {
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  } | null;
  contentDir: string | null;
  githubRepo: string | null;
}

const CONFIG_FILENAME = ".featuredocs.json";

/**
 * Load configuration from .featuredocs.json or environment variables.
 * File config takes precedence where available.
 */
export function loadConfig(): FeaturedocsConfig {
  const configPath = path.join(process.cwd(), CONFIG_FILENAME);
  let fileConfig: Record<string, unknown> = {};

  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, "utf-8");
    fileConfig = JSON.parse(raw) as Record<string, unknown>;
  }

  const r2File = fileConfig.r2 as Record<string, string> | undefined;

  const accountId =
    r2File?.accountId ?? process.env.FEATUREDOCS_R2_ACCOUNT_ID ?? "";
  const accessKeyId =
    r2File?.accessKeyId ?? process.env.FEATUREDOCS_R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey =
    r2File?.secretAccessKey ??
    process.env.FEATUREDOCS_R2_SECRET_ACCESS_KEY ??
    "";
  const bucket =
    r2File?.bucket ?? process.env.FEATUREDOCS_R2_BUCKET ?? "";

  const hasR2 = Boolean(accountId && accessKeyId && secretAccessKey && bucket);

  return {
    r2: hasR2
      ? { accountId, accessKeyId, secretAccessKey, bucket }
      : null,
    contentDir:
      (fileConfig.contentDir as string) ??
      process.env.FEATUREDOCS_CONTENT_DIR ??
      null,
    githubRepo: (fileConfig.githubRepo as string) ?? null,
  };
}
