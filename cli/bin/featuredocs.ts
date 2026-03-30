#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "../src/commands/init.js";
import { addCommand } from "../src/commands/add.js";
import { publishCommand } from "../src/commands/publish.js";
import { translateCommand } from "../src/commands/translate.js";
import { statusCommand } from "../src/commands/status.js";

const program = new Command();

program
  .name("featuredocs")
  .description("CLI tool for managing featuredocs content")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold docs/ directory for a product")
  .action(async () => {
    await initCommand();
  });

program
  .command("add")
  .description("Add a new feature doc")
  .argument("<slug>", "Feature slug (e.g., day-view)")
  .requiredOption("--title <title>", "Feature title")
  .action((slug: string, options: { title: string }) => {
    addCommand(slug, options);
  });

program
  .command("publish")
  .description("Publish docs and videos to R2 / content directory")
  .requiredOption("--product <name>", "Product name")
  .requiredOption("--version <ver>", "Version (e.g., 0.1.0)")
  .option("--live", "Set status to published (default: draft)")
  .option("--r2-bucket <bucket>", "Override R2 bucket name")
  .option("--videos-dir <dir>", "Path to videos directory")
  .action(async (options: {
    product: string;
    version: string;
    live?: boolean;
    r2Bucket?: string;
    videosDir?: string;
  }) => {
    await publishCommand(options);
  });

program
  .command("translate")
  .description("Scaffold empty locale translation files")
  .requiredOption("--locale <code>", "Locale code (e.g., es, fr)")
  .action((options: { locale: string }) => {
    translateCommand(options);
  });

program
  .command("status")
  .description("Show docs completion status")
  .action(() => {
    statusCommand();
  });

program.parse();
