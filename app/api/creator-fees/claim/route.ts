import { NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
  LAUNCHPAD_PROGRAM,
  claimCreatorFee,
  getPdaCreatorFeeVaultAuth,
  getPdaCreatorVault
} from "@raydium-io/raydium-sdk-v2";
import { CONFIG } from "../../../../lib/config";
import { getCreatorFeeRedirect } from "../../../../lib/creator-fee-redirects";

function parsePublicKey(value: unknown, label: string): PublicKey {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  try {
    return new PublicKey(value.trim());
  } catch {
    throw new Error(`${label} must be a valid Solana address.`);
  }
}

export async function POST(request: Request) {
  try {
    if (CONFIG.network !== "mainnet-beta") {
      return NextResponse.json(
        { error: "Creator fee claiming is available on mainnet only." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const creator = parsePublicKey(body.creator, "Creator wallet");
    const tokenMint = parsePublicKey(body.tokenMint, "Token mint");

    // The persisted launch redirect is the source of truth. Do not trust a
    // recipient supplied by the client when preparing a fee claim.
    const redirect = await getCreatorFeeRedirect(
      creator.toBase58(),
      tokenMint.toBase58()
    );

    if (!redirect) {
      return NextResponse.json(
        { error: "No fee recipient is registered for this launch." },
        { status: 404 }
      );
    }

    const recipient = parsePublicKey(redirect.recipient, "Stored recipient wallet");

    // Standard SOL LaunchLab launches use WSOL as mint B.
    const mintB = NATIVE_MINT;
    const mintProgramB = TOKEN_PROGRAM_ID;

    const creatorClaimFeeAuth =
      getPdaCreatorFeeVaultAuth(LAUNCHPAD_PROGRAM).publicKey;

    const creatorClaimFeeVault =
      getPdaCreatorVault(LAUNCHPAD_PROGRAM, creator, mintB).publicKey;

    const recipientTokenAccount = getAssociatedTokenAddressSync(
      mintB,
      recipient,
      false,
      mintProgramB,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const connection = new Connection(CONFIG.rpc, "confirmed");
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction({
      feePayer: creator,
      blockhash,
      lastValidBlockHeight
    });

    transaction.add(
      createAssociatedTokenAccountIdempotentInstruction(
        creator,
        recipientTokenAccount,
        recipient,
        mintB,
        mintProgramB,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    transaction.add(
      claimCreatorFee(
        LAUNCHPAD_PROGRAM,
        creator,
        creatorClaimFeeAuth,
        creatorClaimFeeVault,
        recipientTokenAccount,
        mintB,
        mintProgramB
      )
    );

    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    return NextResponse.json({
      transaction: serialized.toString("base64"),
      creator: creator.toBase58(),
      tokenMint: tokenMint.toBase58(),
      recipient: recipient.toBase58(),
      recipientTokenAccount: recipientTokenAccount.toBase58(),
      creatorFeeVault: creatorClaimFeeVault.toBase58(),
      mintB: mintB.toBase58(),
      blockhash,
      lastValidBlockHeight
    });
  } catch (error) {
    console.error("MIDCURVE CREATOR FEE CLAIM ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare creator fee claim."
      },
      { status: 400 }
    );
  }
}
