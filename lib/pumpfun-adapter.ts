import { PublicKey } from "@solana/web3.js";

export const PUMP_PROGRAM_ID =
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

export const WRAPPED_SOL_MINT =
  "So11111111111111111111111111111111111111112";

export const USDC_MINT =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type PumpPair = {
  mint: string;
  symbol: string;
  name: string;
  category: "native" | "stable" | "custom";
  launchable: boolean;
};

export class PumpFunError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "PumpFunError";
  }
}

export function assertPublicKey(
  value: unknown,
  label: string
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PumpFunError(`${label} is required.`, 400);
  }

  try {
    return new PublicKey(value.trim()).toBase58();
  } catch {
    throw new PumpFunError(
      `${label} must be a valid Solana public key.`,
      400
    );
  }
}

export function getPairs(): PumpPair[] {
  return [
    {
      mint: WRAPPED_SOL_MINT,
      symbol: "SOL",
      name: "Solana",
      category: "native",
      launchable: true
    },
    {
      mint: USDC_MINT,
      symbol: "USDC",
      name: "USD Coin",
      category: "stable",
      launchable: true
    }
  ];
}
