import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getAssetPublicUrl, getPublicBaseUrl } from "@/lib/assets";
import { publishInstagramImage } from "@/lib/instagram-publish";
import { resolveInstagramCredentials } from "@/lib/integrations";

export type ScheduledPostStatus = "scheduled" | "running" | "succeeded" | "failed";

export type ScheduledPost = {
  id: string;
  platform: string;
  content: string;
  assetIds: string[];
  scheduleAt: string;
  status: ScheduledPostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  externalId?: string;
  error?: string;
};

export type ScheduledPostInput = {
  platform: string;
  content: string;
  assetIds: string[];
  scheduleAt: string;
};

const storageDir = process.env.FLOWPOST_DATA_DIR || path.join(process.cwd(), ".flowpost-data");
const storageFile = path.join(storageDir, "scheduled-posts.json");

async function ensureStorageFile() {
  await mkdir(storageDir, { recursive: true });

  try {
    await readFile(storageFile, "utf8");
  } catch {
    await writeFile(storageFile, "[]", "utf8");
  }
}

async function readJobs(): Promise<ScheduledPost[]> {
  await ensureStorageFile();

  const raw = await readFile(storageFile, "utf8");
  const parsed = JSON.parse(raw) as ScheduledPost[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeJobs(jobs: ScheduledPost[]) {
  await ensureStorageFile();
  await writeFile(storageFile, JSON.stringify(jobs, null, 2), "utf8");
}

function createId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function createScheduledPost(input: ScheduledPostInput) {
  const now = new Date().toISOString();
  const job: ScheduledPost = {
    id: createId(),
    platform: input.platform,
    content: input.content,
    assetIds: input.assetIds,
    scheduleAt: input.scheduleAt,
    status: "scheduled",
    createdAt: now,
    updatedAt: now,
  };

  const jobs = await readJobs();
  jobs.push(job);
  await writeJobs(jobs);
  return job;
}

export async function listScheduledPosts() {
  const jobs = await readJobs();
  return jobs.sort((a, b) => a.scheduleAt.localeCompare(b.scheduleAt));
}

export async function runDueScheduledPosts(now = new Date()) {
  const jobs = await readJobs();
  const dueJobs = jobs.filter((job) => job.status === "scheduled" && new Date(job.scheduleAt).getTime() <= now.getTime());

  const results: Array<{ id: string; status: ScheduledPostStatus; error?: string; externalId?: string }> = [];

  for (const job of dueJobs) {
    job.status = "running";
    job.updatedAt = now.toISOString();
    await writeJobs(jobs);

    try {
      if (job.platform !== "instagram") {
        throw new Error(`Unsupported scheduled platform: ${job.platform}`);
      }

      if (job.assetIds.length === 0) {
        throw new Error("Scheduled Instagram posts require assetIds.");
      }

      const credentials = await resolveInstagramCredentials();
      if (!credentials) throw new Error("Connect Instagram first.");

      const assetId = job.assetIds[0];
      if (!assetId) {
        throw new Error("Scheduled Instagram posts require at least one asset.");
      }

      const result = await publishInstagramImage({
        accessToken: credentials.accessToken,
        instagramUserId: credentials.instagramUserId,
        imageUrl: getAssetPublicUrl(assetId, getPublicBaseUrl()),
        caption: job.content,
        graphApiVersion: process.env.META_GRAPH_API_VERSION || "v22.0",
      });

      job.status = "succeeded";
      job.externalId = result.mediaId;
      job.publishedAt = new Date().toISOString();
      job.error = undefined;
      job.updatedAt = new Date().toISOString();
      results.push({ id: job.id, status: job.status, externalId: result.mediaId });
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Publish failed";
      job.updatedAt = new Date().toISOString();
      results.push({ id: job.id, status: job.status, error: job.error });
    }
  }

  await writeJobs(jobs);
  return results;
}
