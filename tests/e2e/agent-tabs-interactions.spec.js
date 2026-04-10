import { expect, test } from "@playwright/test";

const agentIds = [
  "nexus",
  "maestro",
  "prospect",
  "sentinel",
  "support-sage",
  "centsible",
  "sage",
  "chronos",
  "veritas",
  "inspect",
  "canvas",
  "merchant",
  "pulse",
  "compass",
  "part",
  "atlas",
  "scribe",
];

const tabs = ["overview", "chat", "tools", "integrations", "ops", "dashboard", "workflows", "functions"];

async function gotoStable(page, route) {
  for (let i = 0; i < 2; i += 1) {
    await page.goto(route, { waitUntil: "domcontentloaded", timeout: 90000 });
    const headingCount = await page.getByRole("heading").count();
    if (headingCount > 0) return;
    await page.waitForTimeout(250);
  }
}

async function assertCountWithRetries(page, route, locator, message, attempts = 3) {
  let count = 0;
  for (let i = 0; i < attempts; i += 1) {
    await gotoStable(page, route);
    count = await locator.count();
    if (count > 0) return;
    await page.waitForTimeout(300);
  }
  expect(count, message).toBeGreaterThan(0);
}

async function assertRouteRendered(page, route, id, tab, attempts = 3) {
  let textLen = 0;
  for (let i = 0; i < attempts; i += 1) {
    await gotoStable(page, route);
    textLen = (await page.locator("#root").innerText()).trim().length;
    if (textLen > 120) return;
    await page.waitForTimeout(300);
  }
  expect(textLen, `Route rendered blank on ${id}/${tab}`).toBeGreaterThan(120);
}

for (const agentId of agentIds) {
  test(`agent tabs interactive: ${agentId}`, async ({ page }) => {
    test.setTimeout(90000);
    const jsErrors = [];
    page.on("pageerror", (err) => jsErrors.push(String(err)));

    for (const tab of tabs) {
      const route = tab === "overview" ? `/agents/${agentId}` : `/agents/${agentId}/${tab}`;
      await assertRouteRendered(page, route, agentId, tab);

      if (tab === "chat") {
        await assertCountWithRetries(
          page,
          route,
          page.locator("textarea:visible"),
          `Missing visible chat textarea on ${agentId}/${tab}`
        );
      }

      if (tab === "workflows") {
        await assertCountWithRetries(
          page,
          route,
          page.locator("button:visible").filter({ hasText: /Create/i }),
          `Missing Create button on ${agentId}/${tab}`
        );
      }
    }

    expect(jsErrors, `JS errors found for ${agentId}:\n${jsErrors.join("\n")}`).toEqual([]);
  });
}

