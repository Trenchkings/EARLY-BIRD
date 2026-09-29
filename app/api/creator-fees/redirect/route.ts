import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  getCreatorFeeRedirect,
  saveCreatorFeeRedirect
} from "../../../../lib/creator-fee-redirects";

function publicKey(
  value: unknown,
  label: string
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(`${label} is required.`);
  }

  try {
    return new PublicKey(
      value.trim()
    ).toBase58();
  } catch {
    throw new Error(
      `${label} must be a valid Solana wallet address.`
    );
  }
}

export async function POST(request: Request) {
  try {
    const body =
      await request.json().catch(() => null);

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        { error: "Invalid request." },
        { status: 400 }
      );
    }

    const creator = publicKey(
      body.creator,
      "Creator"
    );

    const tokenMint = publicKey(
      body.tokenMint,
      "Token mint"
    );

    const recipient = publicKey(
      body.recipient,
      "Fee recipient"
    );

    const redirect =
      await saveCreatorFeeRedirect(
        creator,
        tokenMint,
        recipient
      );

    return NextResponse.json({
      ok: true,
      redirect
    });
  } catch (error) {
    console.error(
      "CREATOR FEE REDIRECT SAVE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save fee recipient."
      },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const creator = publicKey(
      url.searchParams.get("creator"),
      "Creator"
    );

    const tokenMint = publicKey(
      url.searchParams.get("tokenMint"),
      "Token mint"
    );

    const redirect =
      await getCreatorFeeRedirect(
        creator,
        tokenMint
      );

    if (!redirect) {
      return NextResponse.json(
        {
          error:
            "No fee recipient is registered for this launch."
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      redirect
    });
  } catch (error) {
    console.error(
      "CREATOR FEE REDIRECT READ ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read fee recipient."
      },
      { status: 400 }
    );
  }
}
