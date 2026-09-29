import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { StonkFunError } from "../../../../lib/stonkfun-adapter";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const launchId = url.searchParams.get("launchId");
    const signature = url.searchParams.get("signature");

    if (!launchId) {
      throw new StonkFunError(
        "Launch ID is required.",
        400
      );
    }

    if (!signature) {
      throw new StonkFunError(
        "Transaction signature is required.",
        400
      );
    }

    // Validate the launch ID as a Solana public key.
    try {
      new PublicKey(launchId);
    } catch {
      throw new StonkFunError(
        "Launch ID is not a valid Solana mint.",
        400
      );
    }

    const rpc =
      process.env.NEXT_PUBLIC_SOLANA_RPC;

    if (!rpc) {
      throw new StonkFunError(
        "Solana RPC is not configured.",
        500
      );
    }

    const connection = new Connection(
      rpc,
      "confirmed"
    );

    const statuses =
      await connection.getSignatureStatuses(
        [signature],
        {
          searchTransactionHistory: true
        }
      );

    const status = statuses.value[0];

    if (!status) {
      return NextResponse.json({
        state: "pending",
        signature,
        mint: launchId
      });
    }

    if (status.err) {
      return NextResponse.json({
        state: "failed",
        signature,
        mint: launchId,
        error:
          "The launch transaction failed on Solana."
      });
    }

    if (
      status.confirmationStatus === "confirmed" ||
      status.confirmationStatus === "finalized"
    ) {
      return NextResponse.json({
        state: "confirmed",
        signature,
        mint: launchId
      });
    }

    return NextResponse.json({
      state: "pending",
      signature,
      mint: launchId
    });
  } catch (error) {
    const status =
      error instanceof StonkFunError
        ? error.status
        : 502;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load launch status."
      },
      { status }
    );
  }
}
