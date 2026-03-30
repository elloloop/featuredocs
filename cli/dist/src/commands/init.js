import fs from "fs";
import path from "path";
import chalk from "chalk";
import { createInterface } from "readline";
function prompt(question) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
export async function initCommand() {
    const docsDir = path.join(process.cwd(), "docs");
    if (fs.existsSync(docsDir)) {
        console.log(chalk.yellow("docs/ directory already exists. Skipping."));
        return;
    }
    const name = await prompt("Product name: ");
    if (!name) {
        console.log(chalk.red("Product name is required."));
        process.exit(1);
    }
    const tagline = await prompt("Tagline: ");
    // Create directory structure
    fs.mkdirSync(path.join(docsDir, "en"), { recursive: true });
    // Create product.json
    const productJson = {
        name,
        tagline: tagline || "",
        description: "",
        locales: ["en"],
        defaultLocale: "en",
        versions: ["0.1.0"],
        latest: "0.1.0",
    };
    fs.writeFileSync(path.join(docsDir, "product.json"), JSON.stringify(productJson, null, 2) + "\n", "utf-8");
    // Create features.json
    const featuresJson = {
        version: "0.1.0",
        status: "draft",
        features: [],
    };
    fs.writeFileSync(path.join(docsDir, "features.json"), JSON.stringify(featuresJson, null, 2) + "\n", "utf-8");
    console.log("");
    console.log(chalk.green("Initialized featuredocs in docs/"));
    console.log("");
    console.log("Next steps:");
    console.log(`  1. ${chalk.cyan("featuredocs add setup --title \"Getting Started\"")}`);
    console.log(`  2. Edit ${chalk.cyan("docs/en/setup.md")}`);
    console.log(`  3. ${chalk.cyan("featuredocs publish --product " + name.toLowerCase().replace(/\s+/g, "-") + " --version 0.1.0")}`);
    console.log("");
}
