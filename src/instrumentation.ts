export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if ((process.env.ROLE ?? "app") !== "app") return;
  if (process.env.RUN_JOBS === "0") return;
  if (process.env.NODE_ENV === "production" && process.env.AUTO_MIGRATE !== "0") {
    const { runMigrations } = await import("@/lib/db/migrate");
    await runMigrations(); // throws → server fails to start → deploy.sh health check fails → rollback
  }
  const { bootstrapAdmin } = await import("@/lib/auth/bootstrap");
  await bootstrapAdmin().catch((e) => console.error(JSON.stringify({ level: "error", src: "bootstrap", msg: e instanceof Error ? e.message : String(e) })));
  const { startJobs } = await import("@/lib/jobs/boss");
  startJobs().catch((e) => console.error(JSON.stringify({ level: "error", src: "jobs", msg: "failed to start", err: e instanceof Error ? e.message : String(e) })));
}
