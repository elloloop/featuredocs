import fs from "fs";
import path from "path";
const CONFIG_FILENAME = ".featuredocs.json";
/**
 * Load configuration from .featuredocs.json or environment variables.
 * File config takes precedence where available.
 */
export function loadConfig() {
    const configPath = path.join(process.cwd(), CONFIG_FILENAME);
    let fileConfig = {};
    if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf-8");
        fileConfig = JSON.parse(raw);
    }
    const r2File = fileConfig.r2;
    const accountId = r2File?.accountId ?? process.env.FEATUREDOCS_R2_ACCOUNT_ID ?? "";
    const accessKeyId = r2File?.accessKeyId ?? process.env.FEATUREDOCS_R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = r2File?.secretAccessKey ??
        process.env.FEATUREDOCS_R2_SECRET_ACCESS_KEY ??
        "";
    const bucket = r2File?.bucket ?? process.env.FEATUREDOCS_R2_BUCKET ?? "";
    const hasR2 = Boolean(accountId && accessKeyId && secretAccessKey && bucket);
    return {
        r2: hasR2
            ? { accountId, accessKeyId, secretAccessKey, bucket }
            : null,
        contentDir: fileConfig.contentDir ??
            process.env.FEATUREDOCS_CONTENT_DIR ??
            null,
        githubRepo: fileConfig.githubRepo ?? null,
    };
}
