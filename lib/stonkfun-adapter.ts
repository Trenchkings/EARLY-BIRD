import { PublicKey } from "@solana/web3.js";

const PAIRS_URL = "https://www.stonkfun.xyz/api/public/v1/pairs";
const DEFAULT_TIMEOUT_MS = 12_000;

export type StonkFunPair = {
  mint: string;
  symbol: string;
  name: string;
  category: string;
};

export type StonkFunPairRegistryEntry = Record<string, unknown> & { mint: string };

export type StonkFunLaunchRequest = {
  publicKey: string;
  quoteMint: string;
  name: string;
  symbol: string;
  description: string;
  devBuyAmount: string;
  website?: string;
  twitter?: string;
  telegram?: string;
};

export type PreparedLaunch = {
  launchId: string;
  transaction: string;
};

export type SubmittedLaunch = {
  launchId: string;
  signature: string;
};

export type LaunchStatus = {
  state: "pending" | "confirmed" | "failed";
  signature?: string;
  mint?: string;
  error?: string;
};

export class StonkFunError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

export function assertMainnetAdapter() {
  if ((process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") !== "mainnet-beta") {
    throw new StonkFunError("StonkFun launches are available on mainnet only.", 409);
  }
}

export function assertPublicKey(value: unknown, label: string): string {
  if (typeof value !== "string") throw new StonkFunError(`${label} is required.`, 400);
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new StonkFunError(`${label} must be a valid Solana public key.`, 400);
  }
}

async function providerFetch(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const configured = Number(process.env.STONKFUN_TIMEOUT_MS);
  const timeout = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new StonkFunError("StonkFun rejected the request.", 502);
    return data;
  } catch (error) {
    if (error instanceof StonkFunError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new StonkFunError("StonkFun did not respond in time.", 504);
    }
    throw new StonkFunError("StonkFun is temporarily unavailable.", 502);
  } finally {
    clearTimeout(timer);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function providerUrl(name: "STONKFUN_PREPARE_URL" | "STONKFUN_SUBMIT_URL" | "STONKFUN_STATUS_URL"): string {
  const url = process.env[name];
  if (!url) throw new StonkFunError("StonkFun launch service is not configured.", 503);
  return url;
}

function pairRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const body = record(payload);

  if (!body) {
    return [];
  }

  if (Array.isArray(body.pairs)) {
    return body.pairs;
  }

  const data = record(body.data);

  if (data && Array.isArray(data.pairs)) {
    return data.pairs;
  }

  if (Array.isArray(body.data)) {
    return body.data;
  }

  return [];
}
export async function getPairs(): Promise<StonkFunPair[]> {
  const payload = await providerFetch(PAIRS_URL);
  const body = record(payload);
  const rows = pairRows(payload);
  return rows.flatMap((value): StonkFunPair[] => {
    const pair = record(value);
    if (!pair || pair.launchable === false || pair.launchLabReady === false) return [];
    try {
      const mint = assertPublicKey(pair.mint, "Quote mint");
      if (typeof pair.symbol !== "string" || !pair.symbol.trim()) return [];
      return [{
        mint,
        symbol: pair.symbol.trim(),
        name: typeof pair.name === "string" && pair.name.trim() ? pair.name.trim() : pair.symbol.trim(),
        category: typeof pair.category === "string" && pair.category.trim() ? pair.category.trim() : "Other"
      }];
    } catch {
      return [];
    }
  });
}

/** Returns the provider's registry row without treating any of its claims as trusted. */
export async function getPairRegistryEntry(quoteMint: string): Promise<StonkFunPairRegistryEntry | null> {
  const payload = await providerFetch(PAIRS_URL);
  const body = record(payload);
  const rows = pairRows(payload);

  for (const value of rows) {
    const pair = record(value);
    if (!pair || pair.launchable === false || pair.launchLabReady === false) continue;
    try {
      if (assertPublicKey(pair.mint, "Quote mint") === quoteMint) {
        return { ...pair, mint: quoteMint };
      }
    } catch {
      // Malformed registry rows are never eligible.
    }
  }
  return null;
}

export async function prepareLaunch(request: StonkFunLaunchRequest): Promise<PreparedLaunch> {
  assertMainnetAdapter();
  const data = record(await providerFetch(providerUrl("STONKFUN_PREPARE_URL"), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request)
  }));
  if (typeof data?.launchId !== "string" || typeof data.transaction !== "string") {
    throw new StonkFunError("StonkFun returned an invalid prepared transaction.");
  }
  return { launchId: data.launchId, transaction: data.transaction };
}

export async function submitLaunch(launchId: string, transaction: string): Promise<SubmittedLaunch> {
  assertMainnetAdapter();
  const data = record(await providerFetch(providerUrl("STONKFUN_SUBMIT_URL"), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ launchId, transaction })
  }));
  if (typeof data?.signature !== "string") throw new StonkFunError("StonkFun returned an invalid submission response.");
  return { launchId, signature: data.signature };
}

export async function getLaunchStatus(launchId: string): Promise<LaunchStatus> {
  assertMainnetAdapter();
  const base = providerUrl("STONKFUN_STATUS_URL");
  const url = new URL(base);
  url.searchParams.set("launchId", launchId);
  const data = record(await providerFetch(url.toString()));
  if (data?.state !== "pending" && data?.state !== "confirmed" && data?.state !== "failed") {
    throw new StonkFunError("StonkFun returned an invalid launch status.");
  }
  return {
    state: data.state,
    signature: typeof data.signature === "string" ? data.signature : undefined,
    mint: typeof data.mint === "string" ? assertPublicKey(data.mint, "Created token mint") : undefined,
    error: typeof data.error === "string" ? data.error : undefined
  };
}

