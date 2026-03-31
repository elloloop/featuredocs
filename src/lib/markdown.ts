import { marked } from "marked";

const DEFAULT_VIDEO_BASE_URL =
  "https://pub-3466d7fda9d2473fa97dfd33cd3e0c1e.r2.dev";

/**
 * Build the full video URL from a filename and product slug.
 * Pattern: ${baseUrl}/${product}/videos/${filename}
 */
function buildVideoUrl(product: string, filename: string): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_VIDEO_BASE_URL ?? DEFAULT_VIDEO_BASE_URL;

  // Strip any leading path components (e.g. "videos/") from the filename
  const cleanFilename = filename.replace(/^videos\//, "");

  return `${baseUrl}/${product}/videos/${cleanFilename}`;
}

/**
 * Process ::video[filename] directives in markdown.
 * Replaces them with HTML video elements before passing to marked.
 */
function processVideoDirectives(markdown: string, product: string): string {
  // Match ::video[path]{attributes} or ::video[path]
  return markdown.replace(
    /::video\[([^\]]+)\](?:\{[^}]*\})?/g,
    (_match, filePath: string) => {
      const videoUrl = buildVideoUrl(product, filePath);
      return [
        '<div class="my-6">',
        `  <video controls playsinline preload="metadata" class="w-full rounded-lg border border-[#E8E6E1]">`,
        `    <source src="${videoUrl}" type="video/mp4" />`,
        "    Your browser does not support the video tag.",
        "  </video>",
        "</div>",
      ].join("\n");
    },
  );
}

/**
 * Render markdown to HTML.
 * Handles ::video directives and standard markdown via marked.
 */
export function renderMarkdown(markdown: string, product: string): string {
  const processed = processVideoDirectives(markdown, product);

  const html = marked.parse(processed, {
    async: false,
    gfm: true,
    breaks: false,
  }) as string;

  return html;
}
