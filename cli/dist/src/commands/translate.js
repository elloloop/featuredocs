import fs from "fs";
import path from "path";
import chalk from "chalk";
export function translateCommand(options) {
    const docsDir = path.join(process.cwd(), "docs");
    const featuresPath = path.join(docsDir, "features.json");
    const productPath = path.join(docsDir, "product.json");
    if (!fs.existsSync(featuresPath) || !fs.existsSync(productPath)) {
        console.log(chalk.red("docs/ not found. Run 'featuredocs init' first."));
        process.exit(1);
    }
    const { locale } = options;
    // Create locale directory
    const localeDir = path.join(docsDir, locale);
    if (!fs.existsSync(localeDir)) {
        fs.mkdirSync(localeDir, { recursive: true });
    }
    // Read features to create stub files
    const rawFeatures = fs.readFileSync(featuresPath, "utf-8");
    const manifest = JSON.parse(rawFeatures);
    let created = 0;
    for (const feature of manifest.features) {
        const mdPath = path.join(localeDir, `${feature.slug}.md`);
        if (fs.existsSync(mdPath)) {
            continue;
        }
        const enTitle = feature.title.en ?? feature.slug;
        const template = `# ${enTitle}

<!-- Translate this document into ${locale} -->
<!-- Original English version: docs/en/${feature.slug}.md -->
`;
        fs.writeFileSync(mdPath, template, "utf-8");
        created++;
    }
    // Add locale to product.json if not already present
    const rawProduct = fs.readFileSync(productPath, "utf-8");
    const product = JSON.parse(rawProduct);
    if (!product.locales.includes(locale)) {
        product.locales.push(locale);
        fs.writeFileSync(productPath, JSON.stringify(product, null, 2) + "\n", "utf-8");
        console.log(`Added ${chalk.cyan(locale)} to product.json locales.`);
    }
    console.log(chalk.green(`Created ${created} translation stub(s) in docs/${locale}/`));
    console.log(`Translate each file and run ${chalk.cyan("featuredocs publish")}.`);
}
