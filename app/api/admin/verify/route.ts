import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { CONFIG } from "../../../../lib/config";

export async function POST(req: Request) {
  try {
    const { wallet, message, signature } = await req.json();
    if (wallet !== CONFIG.devWallet) return NextResponse.json({ok:false}, {status:403});
    const pk = new PublicKey(wallet).toBytes();
    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      Buffer.from(signature, "base64"),
      pk
    );
    if (!ok) return NextResponse.json({ok:false}, {status:401});
    return NextResponse.json({ok:true});
  } catch {
    return NextResponse.json({ok:false}, {status:400});
  }
}