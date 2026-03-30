import fs from "fs";
import path from "path";
import chalk from "chalk";

export function statusCommand(): void {
  const docsDir = path.join(process.cwd(), "docs");
  const featuresPath = path.join(docsDir, "features.json");
  const productPath = path.join(docsDir, "product.json");

  if (!fs.existsSync(featuresPath) || !fs.existsSync(productPath)) {
    console.log(
      chalk.red("docs/ not found. Run 'featuredocs init' first.")
    );
    process.exit(1);
  }

  const rawFeatures = fs.readFileSync(featuresPath, "utf-8");
  const manifest = JSON.parse(rawFeatures) as {
    version: string;
    status: string;
    features: Array<{
      slug: string;
      title: Record<string, string>;
      video: string | null;
    }>;
  };

  const rawProduct = fs.readFileSync(productPath, "utf-8");
  const product = JSON.parse(rawProduct) as {
    name: string;
    locales: string[];
  };

  console.log(chalk.bold(`${product.name} v${manifest.version}`));
  console.log(`Status: ${manifest.status === "published" ? chalk.green("published") : chalk.yellow(manifest.status)}`);
  console.log("");

  // Detect video directories
  const videosDir = path.join(process.cwd(), "demos", "videos", "tablet_trimmed");
  const videoFiles = new Set<string>();
  if (fs.existsSync(videosDir)) {
    const files = fs.readdirSync(videosDir);
    for (const f of files) {
      videoFiles.add(f);
    }
  }

  // Build table header
  const locales = product.locales;
  const localeHeaders = locales.map((l) => l.padEnd(4)).join(" ");
  const header = `${"Feature".padEnd(24)} ${localeHeaders} Video`;
  console.log(chalk.dim(header));
  console.log(chalk.dim("-".repeat(header.length)));

  // Build table rows
  for (const feature of manifest.features) {
    const name = feature.slug.padEnd(24);

    const localeCols = locales
      .map((locale) => {
        const mdPath = path.join(docsDir, locale, `${feature.slug}.md`);
        const exists = fs.existsSync(mdPath);
        return exists
          ? chalk.green("Y".padEnd(4))
          : chalk.red("N".padEnd(4));
      })
      .join(" ");

    const hasVideo = feature.video ? videoFiles.has(feature.video) : false;
    const videoCol = feature.video
      ? hasVideo
        ? chalk.green("Y")
        : chalk.red("N")
      : chalk.dim("-");

    console.log(`${name} ${localeCols} ${videoCol}`);
  }

  console.log("");
  console.log(
    `${manifest.features.length} feature(s), ${locales.length} locale(s)`
  );
}
