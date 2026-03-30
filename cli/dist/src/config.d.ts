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
/**
 * Load configuration from .featuredocs.json or environment variables.
 * File config takes precedence where available.
 */
export declare function loadConfig(): FeaturedocsConfig;
