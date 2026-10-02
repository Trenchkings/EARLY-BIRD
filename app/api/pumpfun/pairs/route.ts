import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { OnlinePumpSdk } from "@pump-fun/pump-sdk";

import { CONFIG } from "../../../../lib/config";
import { resolvePumpQuoteMetadataBulk } from "../../../../lib/pumpfun-quote-metadata";
import {
  getPairs,
  PumpFunError,
  WRAPPED_SOL_MINT,
  USDC_MINT
} from "../../../../lib/pumpfun-adapter";

export const dynamic = "force-dynamic";

type ApiPair = {
  mint: string;
  symbol: string;
  name: string;
  category: "native" | "stable" | "crypto" | "stock" | "etf" | "custom";
  launchable: boolean;
  logoUrl?: string;
};

type CachedPairs = {
  expiresAt: number;
  pairs: ApiPair[];
  supportedCount: number;
};

let cache: CachedPairs | null = null;

const CACHE_MS = 15 * 60 * 1000;

export async function GET() {
  try {
    if (cache && cache.expiresAt > Date.now()) {
      return NextResponse.json({
        pairs: cache.pairs,
        cached: true,
        supportedCount: cache.supportedCount
      });
    }

    const connection = new Connection(
      CONFIG.rpc,
      "confirmed"
    );

    const onlinePump = new OnlinePumpSdk(connection);

    /*
     * Pump.fun is the authority for which quote mints
     * are currently supported.
     *
     * IMPORTANT:
     * Do not individually request metadata for every mint here.
     * Pump currently exposes a large number of quote assets and
     * doing that causes public/shared RPC rate limiting.
     */
    const supported =
      await onlinePump.fetchSupportedQuoteMints();

    const knownPairs = new Map(
      getPairs().map(pair => [pair.mint, pair])
    );

    const unknownMints =
      supported
        .map(pair => pair.mint.toBase58())
        .filter(mint =>
          !knownPairs.has(mint) &&
          mint !== WRAPPED_SOL_MINT &&
          mint !== USDC_MINT
        );

    const metadataByMint =
      await resolvePumpQuoteMetadataBulk(
        CONFIG.rpc,
        unknownMints
      );

    const pairs: ApiPair[] =
      supported.map(supportedPair => {
        const mint =
          supportedPair.mint.toBase58();

        const known =
          knownPairs.get(mint);

        if (known) {
          return known;
        }

        if (mint === WRAPPED_SOL_MINT) {
          return {
            mint,
            symbol: "SOL",
            name: "Solana",
            category: "native",
            launchable: true,
            logoUrl: "/pair-logos/sol.svg"
          };
        }

        if (mint === USDC_MINT) {
          return {
            mint,
            symbol: "USDC",
            name: "USD Coin",
            category: "stable",
            launchable: true,
            logoUrl: "/pair-logos/usdc.svg"
          };
        }

        const metadata =
          metadataByMint.get(mint);

        return {
          mint,
          symbol:
            metadata?.symbol ||
            `${mint.slice(0, 4)}...${mint.slice(-4)}`,
          name:
            metadata?.name ||
            "Pump.fun supported quote",
          category: "custom",
          launchable: true,
          ...(metadata?.logoUrl
            ? {
                logoUrl: metadata.logoUrl
              }
            : {})
        };
      });
    pairs.sort((a, b) => {
      if (a.mint === WRAPPED_SOL_MINT) return -1;
      if (b.mint === WRAPPED_SOL_MINT) return 1;

      if (a.mint === USDC_MINT) return -1;
      if (b.mint === USDC_MINT) return 1;

      const aKnown =
        a.name !== "Pump.fun supported quote";

      const bKnown =
        b.name !== "Pump.fun supported quote";

      if (aKnown !== bKnown) {
        return aKnown ? -1 : 1;
      }

      return a.symbol.localeCompare(b.symbol);
    });

    cache = {
      pairs,
      supportedCount: supported.length,
      expiresAt: Date.now() + CACHE_MS
    };

    return NextResponse.json({
      pairs,
      cached: false,
      supportedCount: supported.length
    });
  } catch (error) {
    console.error("PUMPFUN PAIRS ERROR:", error);

    const status =
      error instanceof PumpFunError
        ? error.status
        : 502;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Pump.fun pairs."
      },
      { status }
    );
  }
}
