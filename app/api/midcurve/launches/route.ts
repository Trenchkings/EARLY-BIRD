import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMidcurveLaunches,
  saveMidcurveLaunch,
  MidcurveLaunchProvider
} from "../../../../lib/midcurve-launches";

export const dynamic = "force-dynamic";

function getRpcUrl() {
  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

  if (!rpcUrl) {
    throw new Error("Solana RPC URL is not configured.");
  }

  if (
    !rpcUrl.startsWith("http://") &&
    !rpcUrl.startsWith("https://")
  ) {
    throw new Error("Solana RPC URL must use http or https.");
  }

  return rpcUrl;
}

function publicKey(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  return new PublicKey(value.trim()).toBase58();
}

function text(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function GET(request: NextRequest) {
  try {
    const requestedLimit = Number(
      request.nextUrl.searchParams.get("limit") || "24"
    );

    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(100, Math.floor(requestedLimit)))
      : 24;

    const launches = await getMidcurveLaunches(limit);

    return NextResponse.json(
      {
        launches: launches.map(launch => ({
          ...launch,
          createdAt: launch.createdAt.toISOString()
        }))
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("MIDCURVE launch GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load MIDCURVE launches."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const mint = publicKey(body.mint, "Mint");
    const creator = publicKey(body.creator, "Creator");

    const signature = text(body.signature, 200);

    if (!signature) {
      return NextResponse.json(
        { error: "Transaction signature is required." },
        { status: 400 }
      );
    }

    const provider = body.provider as MidcurveLaunchProvider;

    if (provider !== "pumpfun" && provider !== "stonk") {
      return NextResponse.json(
        { error: "Invalid MIDCURVE launch provider." },
        { status: 400 }
      );
    }

    const name = text(body.name, 100);
    const symbol = text(body.symbol, 20).toUpperCase();

    if (!name || !symbol) {
      return NextResponse.json(
        { error: "Token name and symbol are required." },
        { status: 400 }
      );
    }

    /*
     * Verify that the supplied transaction actually exists and
     * reached confirmed/finalized status before adding it to the
     * public MIDCURVE launch registry.
     */
    const connection = new Connection(getRpcUrl(), "confirmed");

    const status = await connection.getSignatureStatus(
      signature,
      {
        searchTransactionHistory: true
      }
    );

    if (!status.value) {
      return NextResponse.json(
        {
          error:
            "Transaction could not be found on Solana."
        },
        { status: 400 }
      );
    }

    if (status.value.err) {
      return NextResponse.json(
        {
          error:
            "Failed Solana transactions cannot be added to MIDCURVE."
        },
        { status: 400 }
      );
    }

    if (
      status.value.confirmationStatus !== "confirmed" &&
      status.value.confirmationStatus !== "finalized"
    ) {
      return NextResponse.json(
        {
          error:
            "Transaction has not reached confirmed status."
        },
        { status: 409 }
      );
    }

    const launch = await saveMidcurveLaunch({
      mint,
      signature,
      provider,
      creator,
      name,
      symbol,
      description: text(body.description, 1000),
      quoteMint: text(body.quoteMint, 100),
      logoUrl: text(body.logoUrl, 2000),
      website: text(body.website, 500),
      xUrl: text(body.xUrl, 500),
      telegramUrl: text(body.telegramUrl, 500)
    });

    return NextResponse.json({
      ok: true,
      launch: {
        ...launch,
        createdAt: launch.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error("MIDCURVE launch POST error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to record MIDCURVE launch."
      },
      { status: 400 }
    );
  }
}
