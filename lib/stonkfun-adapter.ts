/**
 * Mainnet adapter boundary.
 *
 * Do not call this from devnet.
 * The live StonkFun launch flow returns an unsigned payment transaction
 * which the creator wallet signs, then submits, followed by status polling.
 *
 * Keep this adapter isolated so the rest of EARLY BIRD is not coupled to
 * a third-party implementation.
 */
export type StonkFunLaunchRequest = {
  publicKey: string;
  quoteMint: string;
  name: string;
  symbol: string;
  mode: "standard" | "reward";
  logo: string;
  devBuySol?: number;
  devBuyPercent?: number;
  website?: string;
  twitter?: string;
  telegram?: string;
};

export function assertMainnetAdapter() {
  if ((process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") !== "mainnet-beta") {
    throw new Error("StonkFun mainnet launch adapter is disabled on devnet.");
  }
}
