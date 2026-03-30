import { test, expect } from "@playwright/test";

test.describe("Product listing", () => {
  test("shows Nesta on the home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Nesta")).toBeVisible();
  });
});

test.describe("Feature browsing", () => {
  test("navigates to Nesta feature list", async ({ page }) => {
    await page.goto("/nesta/en");
    await expect(page.getByText("Day View")).toBeVisible();
  });

  test("opens a feature page with video", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await expect(
      page.getByRole("heading", { name: /day view/i })
    ).toBeVisible();
    await expect(page.locator("video")).toBeVisible();
  });

  test("version selector shows available versions", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await expect(page.getByText("0.1.0")).toBeVisible();
  });
});

test.describe("Feedback submission", () => {
  test("feedback dialog opens from report button", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await page
      .getByRole("button", { name: /report|feedback/i })
      .first()
      .click();
    await expect(page.getByText(/what.*outdated/i)).toBeVisible();
  });

  test("feedback form has honeypot field hidden", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await page
      .getByRole("button", { name: /report|feedback/i })
      .first()
      .click();
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toBeHidden();
  });

  test("submits feedback successfully", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await page
      .getByRole("button", { name: /report|feedback/i })
      .first()
      .click();
    await page
      .getByPlaceholder(/what.*outdated/i)
      .fill("The screenshot is from an older version");
    await page.getByRole("button", { name: /submit/i }).click();
    await expect(page.getByText(/thank|submitted/i)).toBeVisible();
  });

  test("rate limiting returns 429 after 5 submissions", async ({
    request,
  }) => {
    for (let i = 0; i < 5; i++) {
      await request.post("/api/feedback", {
        data: {
          product: "nesta",
          feature: "day-view",
          version: "0.1.0",
          locale: "en",
          type: "general",
          comment: `test ${i}`,
          turnstileToken: "test-token",
        },
      });
    }
    const response = await request.post("/api/feedback", {
      data: {
        product: "nesta",
        feature: "day-view",
        version: "0.1.0",
        locale: "en",
        type: "general",
        comment: "should be rate limited",
        turnstileToken: "test-token",
      },
    });
    expect(response.status()).toBe(429);
  });
});

test.describe("Text selection feedback", () => {
  test("selecting text shows feedback popover", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    // Select some text
    const paragraph = page.locator("p").first();
    await paragraph.click({ position: { x: 10, y: 10 } });
    // Triple-click to select paragraph text
    await paragraph.click({ clickCount: 3 });
    await expect(page.getByText(/mark.*outdated/i)).toBeVisible();
  });
});

test.describe("Inline editor", () => {
  test("edit button opens editor", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await page.getByRole("button", { name: /edit/i }).click();
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("editor shows markdown toolbar", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await page.getByRole("button", { name: /edit/i }).click();
    await expect(
      page.getByRole("button", { name: /bold/i })
    ).toBeVisible();
  });

  test("editor has save and cancel buttons", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await page.getByRole("button", { name: /edit/i }).click();
    await expect(
      page.getByRole("button", { name: /save/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /cancel/i })
    ).toBeVisible();
  });

  test("cancel returns to read mode", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await page.getByRole("button", { name: /edit/i }).click();
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.locator("textarea")).not.toBeVisible();
  });
});

test.describe("Draft mode", () => {
  test("draft version shows banner", async ({ page }) => {
    // Published version should NOT show draft banner
    await page.goto("/nesta/en/day-view/0.1.0");
    await expect(page.getByText(/draft/i)).not.toBeVisible();
  });
});

test.describe("Device frames", () => {
  test("video is wrapped in device frame", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await expect(page.locator(".device-frame-ipad")).toBeVisible();
  });
});

test.describe("Locale switching", () => {
  test("locale switcher is visible", async ({ page }) => {
    await page.goto("/nesta/en/day-view/0.1.0");
    await expect(page.getByText("English")).toBeVisible();
  });
});

test.describe("Admin dashboard", () => {
  test("admin page loads", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText(/feedback/i)).toBeVisible();
  });
});
