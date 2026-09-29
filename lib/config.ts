export const CONFIG = {
  network: (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as "devnet" | "mainnet-beta",
  rpc: process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com",
  devWallet: "CuvMFjMtApH6DWHUmnutHF5kk5Q18BXZ4jUDKTG6Z3pH3",
  platformFeeBps: 5, // 0.05%
  launchMode: (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") === "mainnet-beta" ? "stonkfun" : "devnet-token-only"
};

export const MAINNET_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";

export const feeForLamports = (lamports: number) =>
  Math.floor(lamports * CONFIG.platformFeeBps / 10_000);
