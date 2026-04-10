import { expect, test } from "@playwright/test";

const criticalRoutes = [
  "/",
  "/AIAgents",
  "/AICommandCenter",
  "/NexusOpsHub",
  "/AtlasOpsHub",
  "/MaestroOpsHub",
  "/ProspectOpsHub",
  "/SupportSageOpsHub",
  "/CentsibleOpsHub",
  "/SentinelOpsHub",
  "/VeritasOpsHub",
];

test("core routes render without white screen", async ({ page }) => {
  for (const route of criticalRoutes) {
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.trim().length).toBeGreaterThan(20);
  }
});

test("agents page has actionable controls", async ({ page }) => {
  await page.goto("/AIAgents");
  await expect(page.getByText("AI Agent Federation")).toBeVisible();
  const runButtons = page.getByRole("button", { name: /Run|Running|Check|Health|Scan/i });
  await expect(runButtons.first()).toBeVisible();
});
