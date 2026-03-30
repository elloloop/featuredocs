interface PublishOptions {
    product: string;
    version: string;
    live?: boolean;
    r2Bucket?: string;
    videosDir?: string;
}
export declare function publishCommand(options: PublishOptions): Promise<void>;
export {};
