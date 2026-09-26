import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { MAINNET_GENESIS_HASH } from "./config";

const PAIRS_URL = "https://www.stonkfun.xyz/api/public/v1/pairs";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TRANSACTION_BYTES = 1_232;
const MAX_PROVIDER_RESPONSE_BYTES = 1_000_000;
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/;
const LAUNCH_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

export type StonkFunPair = {
  mint: string;
  symbol: string;
  name: string;
  category: string;
};

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

export async function assertMainnetRpc() {
  assertMainnetAdapter();
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
  if (!rpc) throw new StonkFunError("A mainnet Solana RPC endpoint is required.", 503);
  try {
    const connection = new Connection(rpc, "confirmed");
    if (await connection.getGenesisHash() !== MAINNET_GENESIS_HASH) throw new StonkFunError("The configured RPC endpoint is not Solana mainnet.", 409);
  } catch (error) {
    if (error instanceof StonkFunError) throw error;
    throw new StonkFunError("The configured mainnet RPC endpoint could not be verified.", 503);
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
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) throw new StonkFunError("StonkFun returned an invalid response.");
    const responseText = await response.text();
    if (responseText.length > MAX_PROVIDER_RESPONSE_BYTES) throw new StonkFunError("StonkFun returned an invalid response.");
    let data: unknown = null;
    try { data = JSON.parse(responseText); } catch { /* validated below */ }
    if (!response.ok) throw new StonkFunError("StonkFun rejected the request.", 502);
    if (data === null) throw new StonkFunError("StonkFun returned an invalid response.");
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
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.hostname === "localhost")) throw new Error();
    return parsed.toString();
  } catch {
    throw new StonkFunError("StonkFun launch service configuration is invalid.", 503);
  }
}

export function assertLaunchId(value: unknown): string {
  if (typeof value !== "string" || !LAUNCH_ID_PATTERN.test(value)) throw new StonkFunError("Launch ID is invalid.", 400);
  return value;
}

function decodeTransaction(value: unknown): Uint8Array {
  if (typeof value !== "string" || !value || value.length > 2_500 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new StonkFunError("Transaction payload is invalid.", 502);
  }
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > MAX_TRANSACTION_BYTES || bytes.toString("base64") !== value) {
    throw new StonkFunError("Transaction payload is invalid.", 502);
  }
  return bytes;
}

export function validatePreparedTransaction(value: unknown, creator: string): string {
  const bytes = decodeTransaction(value);
  try {
    try {
      const transaction = VersionedTransaction.deserialize(bytes);
      const signerCount = transaction.message.header.numRequiredSignatures;
      if (!signerCount || !transaction.message.staticAccountKeys.slice(0, signerCount).some(key => key.toBase58() === creator)) throw new Error();
    } catch {
      const transaction = Transaction.from(bytes);
      if (!transaction.feePayer || !transaction.signatures.some(item => item.publicKey.toBase58() === creator)) throw new Error();
    }
  } catch {
    throw new StonkFunError("StonkFun returned a transaction that cannot be signed by the connected wallet.");
  }
  return value as string;
}

export function validateSignedTransaction(value: unknown, creator?: string): string {
  const bytes = decodeTransaction(value);
  const hasSignature = (signature: Uint8Array | Buffer | null) => Boolean(signature?.some(byte => byte !== 0));
  try {
    try {
      const transaction = VersionedTransaction.deserialize(bytes);
      const signerKeys = transaction.message.staticAccountKeys.slice(0, transaction.message.header.numRequiredSignatures);
      const index = creator ? signerKeys.findIndex(key => key.toBase58() === creator) : 0;
      if (index < 0 || !hasSignature(transaction.signatures[index])) throw new Error();
    } catch {
      const transaction = Transaction.from(bytes);
      const entry = creator ? transaction.signatures.find(item => item.publicKey.toBase58() === creator) : transaction.signatures[0];
      if (!entry || !hasSignature(entry.signature)) throw new Error();
    }
  } catch {
    throw new StonkFunError("The wallet did not return a valid signed transaction.", 400);
  }
  return value as string;
}

function transactionMessage(value: string): string {
  const bytes = decodeTransaction(value);
  try {
    const transaction = VersionedTransaction.deserialize(bytes);
    return Buffer.from(transaction.message.serialize()).toString("base64");
  } catch {
    try {
      return Buffer.from(Transaction.from(bytes).serializeMessage()).toString("base64");
    } catch {
      throw new StonkFunError("Transaction payload is invalid.", 400);
    }
  }
}

export function assertSameTransactionMessage(prepared: string, signed: string) {
  if (transactionMessage(prepared) !== transactionMessage(signed)) {
    throw new StonkFunError("The signed transaction does not match the prepared launch.", 400);
  }
}

export async function getPairs(): Promise<StonkFunPair[]> {
  const payload = await providerFetch(PAIRS_URL);
  const body = record(payload);
  const rows = Array.isArray(payload) ? payload : Array.isArray(body?.data) ? body.data : Array.isArray(body?.pairs) ? body.pairs : null;
  if (!rows || rows.length > 500) throw new StonkFunError("StonkFun returned an invalid quote-pair response.");
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

export async function prepareLaunch(request: StonkFunLaunchRequest): Promise<PreparedLaunch> {
  assertMainnetAdapter();
  const data = record(await providerFetch(providerUrl("STONKFUN_PREPARE_URL"), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request)
  }));
  if (typeof data?.launchId !== "string" || typeof data.transaction !== "string") {
    throw new StonkFunError("StonkFun returned an invalid prepared transaction.");
  }
  return { launchId: assertLaunchId(data.launchId), transaction: validatePreparedTransaction(data.transaction, request.publicKey) };
}

export async function submitLaunch(launchId: string, transaction: string, creator?: string): Promise<SubmittedLaunch> {
  assertMainnetAdapter();
  launchId = assertLaunchId(launchId);
  transaction = validateSignedTransaction(transaction, creator);
  const data = record(await providerFetch(providerUrl("STONKFUN_SUBMIT_URL"), {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ launchId, transaction })
  }));
  if (typeof data?.signature !== "string" || data.signature.length < 64 || data.signature.length > 100 || !BASE58_PATTERN.test(data.signature)) {
    throw new StonkFunError("StonkFun returned an invalid submission response.");
  }
  return { launchId, signature: data.signature };
}

export async function getLaunchStatus(launchId: string): Promise<LaunchStatus> {
  assertMainnetAdapter();
  launchId = assertLaunchId(launchId);
  const base = providerUrl("STONKFUN_STATUS_URL");
  const url = new URL(base);
  url.searchParams.set("launchId", launchId);
  const data = record(await providerFetch(url.toString()));
  if (data?.state !== "pending" && data?.state !== "confirmed" && data?.state !== "failed") {
    throw new StonkFunError("StonkFun returned an invalid launch status.");
  }
  return {
    state: data.state,
    signature: typeof data.signature === "string" && data.signature.length >= 64 && data.signature.length <= 100 && BASE58_PATTERN.test(data.signature) ? data.signature : undefined,
    mint: typeof data.mint === "string" ? assertPublicKey(data.mint, "Created token mint") : undefined,
    error: data.state === "failed" && typeof data.error === "string" ? "The provider reported that the launch failed." : undefined
  };
}
