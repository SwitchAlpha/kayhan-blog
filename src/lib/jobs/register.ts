import "server-only";
import type { PgBoss } from "pg-boss";
import { QUEUES } from "./boss";
import { schedulerTick } from "./handlers/scheduler";
import { drainIndexNow } from "@/lib/indexnow/submit";
import { postPublishedJob, postRelinkJob } from "./handlers/linking";

const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ level: "info", src: "jobs", msg, ...extra }));

export async function registerWorkers(boss: PgBoss) {
  const common = { retryLimit: 5, retryBackoff: true, retryDelay: 30, expireInSeconds: 600 };
  for (const name of Object.values(QUEUES)) await boss.createQueue(name, common);

  // Cron: every minute publish due scheduled posts; every 2 minutes drain the IndexNow queue.
  await boss.schedule(QUEUES.schedulerTick, "* * * * *", null, { tz: process.env.TZ ?? "Europe/Istanbul" });
  await boss.schedule(QUEUES.indexnowDrain, "*/2 * * * *", null, { tz: process.env.TZ ?? "Europe/Istanbul" });

  await boss.work(QUEUES.schedulerTick, { batchSize: 1 }, async () => {
    const r = await schedulerTick();
    if (r.published.length) log("scheduled posts published", { ids: r.published });
  });
  await boss.work(QUEUES.indexnowDrain, { batchSize: 1 }, async () => {
    const r = await drainIndexNow();
    if (r.submitted || r.status) log("indexnow drain", r);
  });
  await boss.work(QUEUES.postPublished, { batchSize: 1 }, async ([job]: { data: unknown }[]) => {
    const r = await postPublishedJob((job.data as { localeId: string }).localeId);
    log("post.published pipeline", { data: job.data, ...r });
  });
  await boss.work(QUEUES.postRelink, { batchSize: 1 }, async ([job]: { data: unknown }[]) => {
    const r = await postRelinkJob((job.data as { localeId: string }).localeId);
    log("post.relink", { data: job.data, ...r });
  });
}
