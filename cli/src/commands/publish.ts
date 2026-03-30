import fs from "fs";
import path from "path";
import chalk from "chalk";
import { loadConfig } from "../config.js";
import { uploadDirectoryToR2, uploadFileToR2 } from "../r2.js";

interface PublishOptions {
  product: string;
  version: string;
  live?: boolean;
  r2Bucket?: string;
  videosDir?: string;
}

export async function publishCommand(options: PublishOptions): Promise<void> {
  const config = loadConfig();
  const docsDir = path.join(process.cwd(), "docs");
  const featuresPath = path.join(docsDir, "features.json");
  const productPath = path.join(docsDir, "product.json");

  if (!fs.existsSync(featuresPath) || !fs.existsSync(productPath)) {
    console.log(
      chalk.red("docs/ not found. Run 'featuredocs init' first.")
    );
    process.exit(1);
  }

  const { product, version } = options;
  const status = options.live ? "published" : "draft";
  const videosDir =
    options.videosDir ?? path.join(process.cwd(), "demos", "videos", "tablet_trimmed");

  console.log(chalk.bold(`Publishing ${product} v${version} (${status})\n`));

  // Upload videos to R2 if configured
  const r2Config = config.r2;
  const bucket = options.r2Bucket ?? r2Config?.bucket;

  if (r2Config && bucket) {
    const resolvedR2Config = { ...r2Config, bucket };

    if (fs.existsSync(videosDir)) {
      console.log(chalk.cyan("Uploading videos to R2..."));
      const videoPrefix = `${product}/v${version}/videos`;
      const uploadedKeys = await uploadDirectoryToR2(
        resolvedR2Config,
        videosDir,
        videoPrefix
      );
      console.log(`  Uploaded ${uploadedKeys.length} video file(s)`);
    } else {
      console.log(
        chalk.yellow(`Videos directory not found: ${videosDir}. Skipping video upload.`)
      );
    }
  } else {
    console.log(
      chalk.yellow("R2 not configured. Skipping video upload.")
    );
  }

  // Copy content to featuredocs content directory
  const contentDir = config.contentDir;

  if (contentDir) {
    console.log(chalk.cyan("Copying content to featuredocs..."));

    const targetDir = path.join(contentDir, product, `v${version}`);
    fs.mkdirSync(targetDir, { recursive: true });

    // Copy features.json with updated status
    const rawFeatures = fs.readFileSync(featuresPath, "utf-8");
    const manifest = JSON.parse(rawFeatures) as Record<string, unknown>;
    manifest.status = status;
    manifest.version = version;
    fs.writeFileSync(
      path.join(targetDir, "features.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf-8"
    );

    // Copy locale directories
    const entries = fs.readdirSync(docsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules") continue;

      const sourceLocaleDir = path.join(docsDir, entry.name);
      const targetLocaleDir = path.join(targetDir, entry.name);
      fs.mkdirSync(targetLocaleDir, { recursive: true });

      const mdFiles = fs.readdirSync(sourceLocaleDir).filter((f) => f.endsWith(".md"));
      for (const mdFile of mdFiles) {
        fs.copyFileSync(
          path.join(sourceLocaleDir, mdFile),
          path.join(targetLocaleDir, mdFile)
        );
      }
      console.log(`  Copied ${mdFiles.length} file(s) for locale: ${entry.name}`);
    }

    // Ensure product.json exists in the target product directory
    const targetProductJson = path.join(contentDir, product, "product.json");
    if (!fs.existsSync(targetProductJson)) {
      fs.copyFileSync(productPath, targetProductJson);
      console.log("  Created product.json");
    }

    console.log(chalk.green(`\nPublished to: ${targetDir}`));
  } else if (r2Config && bucket) {
    // Upload content files to R2 as well
    const resolvedR2Config = { ...r2Config, bucket };
    console.log(chalk.cyan("Uploading content to R2..."));

    // Upload features.json
    const rawFeatures = fs.readFileSync(featuresPath, "utf-8");
    const manifest = JSON.parse(rawFeatures) as Record<string, unknown>;
    manifest.status = status;
    manifest.version = version;

    const tmpFeaturesPath = path.join(docsDir, ".tmp-features.json");
    fs.writeFileSync(tmpFeaturesPath, JSON.stringify(manifest, null, 2) + "\n");
    await uploadFileToR2(
      resolvedR2Config,
      tmpFeaturesPath,
      `${product}/v${version}/features.json`
    );
    fs.unlinkSync(tmpFeaturesPath);

    // Upload locale directories
    const entries = fs.readdirSync(docsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules") continue;

      const sourceLocaleDir = path.join(docsDir, entry.name);
      const prefix = `${product}/v${version}/${entry.name}`;
      const keys = await uploadDirectoryToR2(resolvedR2Config, sourceLocaleDir, prefix);
      console.log(`  Uploaded ${keys.length} file(s) for locale: ${entry.name}`);
    }

    console.log(chalk.green("\nPublished to R2."));
  } else {
    console.log(
      chalk.yellow(
        "No content destination configured. Set contentDir in .featuredocs.json or R2 credentials."
      )
    );
  }

  console.log("");
  console.log(`Status: ${status === "published" ? chalk.green("published") : chalk.yellow("draft")}`);
  if (status === "draft") {
    console.log(
      `Run with ${chalk.cyan("--live")} to publish immediately.`
    );
  }
}
