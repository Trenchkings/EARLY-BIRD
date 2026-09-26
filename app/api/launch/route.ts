import { NextResponse } from "next/server";
import { CONFIG } from "../../../lib/config";
import { TokenMetadata, validateTokenMetadata } from "../../../lib/token-metadata";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { metadata?: TokenMetadata } | null;
  const validationError = body?.metadata ? validateTokenMetadata(body.metadata) : "Launch metadata is required.";
  if (validationError) return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  if (CONFIG.network !== "mainnet-beta") {
    return NextResponse.json({
      ok: false,
      error: "StonkFun launch integration is disabled on devnet. Use the wallet devnet token flow for testing."
    }, { status: 409 });
  }
  return NextResponse.json({
    ok: false,
    error: "Mainnet StonkFun adapter not enabled in this MVP."
  }, { status: 501 });
}
