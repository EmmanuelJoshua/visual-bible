// quick framing checks: node capture/stills.mjs '<json array of {name, pose, year?}>'
import { launch, openExplore, clock, jumpTo, setUI, fullBleed } from "./lib.mjs";
const list = JSON.parse(process.argv[2]);
const { ctx, page } = await launch({ width: 1920, height: 1920, profile: ".cache/profile" });
await openExplore(page, process.argv[3] ?? "?journey=paul-1");
await page.waitForTimeout(4500); // the opening flight
await setUI(page, "none"); await fullBleed(page);
await clock.start(page);
for (const s of list) {
  if (s.year !== undefined) await page.evaluate((y) => window.__stage.setYear(y), s.year);
  await jumpTo(page, s.pose);
  await clock.run(page, s.settle ?? 2500);
  await page.screenshot({ path: `.cache/stills/${s.name}.jpg`, type: "jpeg", quality: 70, scale: "css" });
  console.log("still", s.name);
}
await ctx.close();
