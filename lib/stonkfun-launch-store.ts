import type { PreparedLaunch } from "./stonkfun-adapter";

type LaunchRecord = PreparedLaunch & { creator: string; createdAt: number };

const globalStore = globalThis as typeof globalThis & {
  __earlyBirdLaunches?: Map<string, LaunchRecord>;
  __earlyBirdRequests?: Map<string, Promise<PreparedLaunch>>;
  __earlyBirdSubmissions?: Map<string, Promise<{ launchId: string; signature: string }>>;
};

export const launchRecords = globalStore.__earlyBirdLaunches ??= new Map();
export const preparationRequests = globalStore.__earlyBirdRequests ??= new Map();
export const submissionRequests = globalStore.__earlyBirdSubmissions ??= new Map();

export function rememberLaunch(result: PreparedLaunch, creator: string) {
  const now = Date.now();
  for (const [id, record] of launchRecords) if (now - record.createdAt > 30 * 60_000) launchRecords.delete(id);
  launchRecords.set(result.launchId, { ...result, creator, createdAt: now });
}
