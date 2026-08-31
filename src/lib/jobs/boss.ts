import "server-only";
import { PgBoss } from "pg-boss";

export const QUEUES = {
  schedulerTick: "scheduler.tick",
  indexnowDrain: "indexnow.drain",
  postPublished: "post.published",
  postRelink: "post.relink",
} as const;

const g = globalThis as unknown as { __kbBoss?: PgBoss; __kbBossStarted?: Promise<PgBoss> };

export function getBoss(): PgBoss {
  if (!g.__kbBoss) {
    g.__kbBoss = new PgBoss({ connectionString: process.env.DATABASE_URL, schema: "pgboss", max: 4 });
    g.__kbBoss.on("error", (e: Error) => console.error(JSON.stringify({ level: "error", src: "pg-boss", msg: e.message })));
  }
  return g.__kbBoss;
}

/** Start pg-boss once per process, register queues, cron schedules and workers. */
export function startJobs(): Promise<PgBoss> {
  if (!g.__kbBossStarted) {
    g.__kbBossStarted = (async () => {
      const boss = getBoss();
      await boss.start();
      const { registerWorkers } = await import("./register");
      await registerWorkers(boss);
      console.log(JSON.stringify({ level: "info", src: "pg-boss", msg: "started" }));
      return boss;
    })();
  }
  return g.__kbBossStarted;
}
