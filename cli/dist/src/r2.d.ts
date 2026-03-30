export interface R2Config {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
}
/**
 * Upload a single file to R2 and return the object key.
 */
export declare function uploadFileToR2(config: R2Config, localPath: string, objectKey: string): Promise<string>;
/**
 * Upload all files in a directory to R2 under a given prefix.
 * Returns a list of uploaded keys.
 */
export declare function uploadDirectoryToR2(config: R2Config, localDir: string, prefix: string): Promise<string[]>;
