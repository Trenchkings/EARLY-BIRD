import { NextRequest, NextResponse } from "next/server";

const STONKFUN = "https://www.stonkfun.xyz";

type StonkPool = {
  pool?: string;
  mint?: string;
  quoteMint?: string;
  quoteSymbol?: string;
  quoteName?: string;
  quoteLogoUrl?: string;
  quoteCategory?: string;

  name?: string;
  symbol?: string;
  imageUrl?: string;

  website?: string;
  twitter?: string;
  telegram?: string;

  marketCapUsd?: number;
  fdvUsd?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  priceUsd?: number;
  priceChange24h?: number;
  peakMarketCapUsd?: number;

  graduationProgress?: number;
  status?: string;
  graduatedAt?: string;
  createdAt?: string;

  launchpad?: string;
  creator?: string;

  isRewardLaunch?: boolean;
  quoteOnlyFees?: boolean;
  transferTaxBps?: number;
};

function absoluteStonkUrl(value?: string) {
  if (!value) return null;

  if (value.startsWith("/")) {
    return `${STONKFUN}${value}`;
  }

  return value;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint } = await context.params;

    if (!mint) {
      return NextResponse.json(
        { error: "Token mint is required." },
        { status: 400 }
      );
    }

    /*
     * Search several pages because platform-pools is paginated.
     * Newly launched EARLY BIRD tokens should normally appear
     * near the newest pools.
     */
    const maxPages = 10;
    const pageSize = 100;

    let found: StonkPool | null = null;
    let graduationMarketCapUsd: number | null = null;

    for (let page = 1; page <= maxPages; page++) {
      const url =
        `${STONKFUN}/api/platform-pools` +
        `?sort=newest&page=${page}&pageSize=${pageSize}`;

      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(
          `StonkFun market API returned ${response.status}.`
        );
      }

      const payload = await response.json();

      if (
        graduationMarketCapUsd === null &&
        typeof payload.graduationMarketCapUsd === "number"
      ) {
        graduationMarketCapUsd = payload.graduationMarketCapUsd;
      }

      const pools: StonkPool[] =
        Array.isArray(payload.pools) ? payload.pools : [];

      found =
        pools.find(
          pool =>
            typeof pool.mint === "string" &&
            pool.mint === mint
        ) ?? null;

      /*
       * StonkFun can expose a featured token separately.
       */
      if (
        !found &&
        payload.featured &&
        typeof payload.featured === "object" &&
        payload.featured.mint === mint
      ) {
        found = payload.featured as StonkPool;
      }

      if (found) break;

      /*
       * Stop if StonkFun says there are no more pages.
       */
      const totalPages = Number(payload?.pagination?.totalPages);

      if (
        Number.isFinite(totalPages) &&
        page >= totalPages
      ) {
        break;
      }
    }

    if (!found) {
      return NextResponse.json(
        {
          error:
            "Token was not found in the recent StonkFun market pools."
        },
        { status: 404 }
      );
    }

    const token = {
      pool: found.pool ?? null,
      mint: found.mint ?? mint,

      name: found.name ?? found.symbol ?? "Unknown token",
      symbol: found.symbol ?? "",

      imageUrl: absoluteStonkUrl(found.imageUrl),

      quote: {
        mint: found.quoteMint ?? null,
        symbol: found.quoteSymbol ?? null,
        name: found.quoteName ?? null,
        logoUrl: absoluteStonkUrl(found.quoteLogoUrl),
        category: found.quoteCategory ?? null
      },

      market: {
        priceUsd: found.priceUsd ?? null,
        marketCapUsd: found.marketCapUsd ?? null,
        fdvUsd: found.fdvUsd ?? null,
        volume24hUsd: found.volume24hUsd ?? null,
        liquidityUsd: found.liquidityUsd ?? null,
        priceChange24h: found.priceChange24h ?? null,
        peakMarketCapUsd: found.peakMarketCapUsd ?? null
      },

      graduation: {
        progress: found.graduationProgress ?? 0,
        targetMarketCapUsd: graduationMarketCapUsd,
        status: found.status ?? null,
        graduatedAt: found.graduatedAt ?? null
      },

      socials: {
        website: found.website ?? null,
        twitter: found.twitter ?? null,
        telegram: found.telegram ?? null
      },

      creator: found.creator ?? null,
      launchpad: found.launchpad ?? null,
      createdAt: found.createdAt ?? null,

      rewards: {
        enabled: found.isRewardLaunch ?? false,
        transferTaxBps: found.transferTaxBps ?? null,
        quoteOnlyFees: found.quoteOnlyFees ?? null
      }
    };

    return NextResponse.json({
      token,
      source: "stonkfun",
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("EARLY BIRD token API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load token."
      },
      { status: 500 }
    );
  }
}
