import fs from "fs";
import path from "path";
import chalk from "chalk";
export function addCommand(slug, options) {
    const docsDir = path.join(process.cwd(), "docs");
    const featuresPath = path.join(docsDir, "features.json");
    if (!fs.existsSync(featuresPath)) {
        console.log(chalk.red("features.json not found. Run 'featuredocs init' first."));
        process.exit(1);
    }
    const raw = fs.readFileSync(featuresPath, "utf-8");
    const manifest = JSON.parse(raw);
    // Check for duplicate
    if (manifest.features.some((f) => f.slug === slug)) {
        console.log(chalk.yellow(`Feature "${slug}" already exists.`));
        return;
    }
    // Add the feature entry
    manifest.features.push({
        slug,
        title: { en: options.title },
        summary: { en: "" },
        device: "ipad",
        orientation: "portrait",
        video: null,
    });
    fs.writeFileSync(featuresPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
    // Create markdown file
    const enDir = path.join(docsDir, "en");
    if (!fs.existsSync(enDir)) {
        fs.mkdirSync(enDir, { recursive: true });
    }
    const markdownPath = path.join(enDir, `${slug}.md`);
    const template = `# ${options.title}

<!-- Write your feature documentation here -->

## Overview

Describe what this feature does and why it matters.

## How It Works

Step-by-step guide for using this feature.

1. First step
2. Second step
3. Third step
`;
    fs.writeFileSync(markdownPath, template, "utf-8");
    console.log(chalk.green(`Added feature: ${slug}`));
    console.log(`  Created ${chalk.cyan(`docs/en/${slug}.md`)} — edit it and run ${chalk.cyan("featuredocs publish")}`);
}
