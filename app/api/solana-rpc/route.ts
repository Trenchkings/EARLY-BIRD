import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOLANA_RPC =
  process.env.SOLANA_RPC ||
  process.env.NEXT_PUBLIC_SOLANA_RPC ||
  "https://api.mainnet-beta.solana.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/json"
      }
    });
  } catch (error) {
    console.error("Solana RPC proxy error:", error);

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message:
            error instanceof Error
              ? error.message
              : "Solana RPC proxy failed"
        },
        id: null
      },
      { status: 500 }
    );
  }
}
