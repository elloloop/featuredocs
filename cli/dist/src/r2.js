import { S3Client, PutObjectCommand, } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
function createS3Client(config) {
    return new S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
}
function getContentType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".md": "text/markdown",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    };
    return types[ext] ?? "application/octet-stream";
}
/**
 * Upload a single file to R2 and return the object key.
 */
export async function uploadFileToR2(config, localPath, objectKey) {
    const client = createS3Client(config);
    const fileContent = fs.readFileSync(localPath);
    const contentType = getContentType(localPath);
    await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: fileContent,
        ContentType: contentType,
    }));
    return objectKey;
}
/**
 * Upload all files in a directory to R2 under a given prefix.
 * Returns a list of uploaded keys.
 */
export async function uploadDirectoryToR2(config, localDir, prefix) {
    const uploadedKeys = [];
    if (!fs.existsSync(localDir)) {
        return uploadedKeys;
    }
    const entries = fs.readdirSync(localDir, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(localDir, entry.name);
        if (entry.isDirectory()) {
            const subKeys = await uploadDirectoryToR2(config, entryPath, `${prefix}/${entry.name}`);
            uploadedKeys.push(...subKeys);
        }
        else if (entry.isFile()) {
            const objectKey = `${prefix}/${entry.name}`;
            await uploadFileToR2(config, entryPath, objectKey);
            uploadedKeys.push(objectKey);
        }
    }
    return uploadedKeys;
}
