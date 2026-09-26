import { NextResponse } from "next/server";
import { CONFIG } from "../../../lib/config";

export async function POST() {
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