import { LaunchpadConfig, LAUNCHPAD_PROGRAM, getPdaLaunchpadConfigId } from "@raydium-io/raydium-sdk-v2";
import { Connection, PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { CONFIG, MAINNET_GENESIS_HASH } from "../../../../lib/config";
import {
  assertPublicKey,
  getPairRegistryEntry,
  StonkFunError
} from "../../../../lib/stonkfun-adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Failure = { verified: false; error: string };

function failure(error: string, status = 422) {
  return NextResponse.json<Failure>({ verified: false, error }, { status });
}

function unsignedInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new StonkFunError(`The StonkFun registry has no valid ${label} claim.`, 502);
  }
  return value;
}

function publicKeyClaim(value: unknown, label: string): PublicKey {
  return new PublicKey(assertPublicKey(value, label));
}

export async function GET(request: NextRequest) {
  try {
    const quoteMint = new PublicKey(
      assertPublicKey(
        request.nextUrl.searchParams.get("quoteMint"),
        "quoteMint"
      )
    );

    if (CONFIG.network !== "mainnet-beta") {
      return failure(
        "Verification is available only when mainnet-beta is explicitly configured.",
        409
      );
    }

    const registry = await getPairRegistryEntry(quoteMint.toBase58());

    if (!registry) {
      return failure(
        "quoteMint is not launchable in the live StonkFun pairs registry.",
        404
      );
    }

    // A platform identity cannot be established merely because a registry says so.
    // Until StonkFun publishes enough identity material to derive and decode its
    // platform account with the SDK, fail closed rather than blessing that claim.
    if (registry.platformId !== undefined) {
      return failure(
        "The registry's StonkFun platform claim cannot yet be independently derived on-chain."
      );
    }

    const configId = publicKeyClaim(
      registry.configId,
      "Launchpad config ID"
    );

    const curveType = unsignedInteger(
      registry.curveType,
      "curveType"
    );

    const index = unsignedInteger(
      registry.index,
      "index"
    );

    const connection = new Connection(CONFIG.rpc, "confirmed");

    if (await connection.getGenesisHash() !== MAINNET_GENESIS_HASH) {
      return failure(
        "The configured RPC is not Solana mainnet-beta.",
        503
      );
    }

    const account = await connection.getAccountInfo(
      configId,
      "confirmed"
    );

    if (!account) {
      return failure(
        "The claimed LaunchpadConfig account does not exist on-chain.",
        502
      );
    }

    if (!account.owner.equals(LAUNCHPAD_PROGRAM)) {
      return failure(
        "The claimed LaunchpadConfig is not owned by the SDK-defined LaunchLab program."
      );
    }

    let decoded: ReturnType<typeof LaunchpadConfig.decode>;

    try {
      decoded = LaunchpadConfig.decode(account.data);
    } catch {
      return failure(
        "The claimed account is not a decodable Raydium LaunchpadConfig."
      );
    }

    if (!decoded.mintB.equals(quoteMint)) {
      return failure(
        "LaunchpadConfig mintB does not equal quoteMint."
      );
    }

    if (
      decoded.curveType !== curveType ||
      decoded.index !== index
    ) {
      return failure(
        "LaunchpadConfig curveType/index do not match the registry claims."
      );
    }

    const expected = getPdaLaunchpadConfigId(
      LAUNCHPAD_PROGRAM,
      decoded.mintB,
      decoded.curveType,
      decoded.index
    ).publicKey;

    if (!expected.equals(configId)) {
      return failure(
        "LaunchpadConfig address does not match its SDK-derived PDA."
      );
    }

    return NextResponse.json({
      verified: true,
      quoteMint: quoteMint.toBase58(),
      configId: configId.toBase58(),
      programId: LAUNCHPAD_PROGRAM.toBase58(),
      curveType: decoded.curveType,
      index: decoded.index,
      genesisHash: MAINNET_GENESIS_HASH
    });
  } catch (error) {
    const status =
      error instanceof StonkFunError ? error.status : 502;

    const message =
      error instanceof Error
        ? error.message
        : "StonkFun configuration verification failed.";

    return failure(message, status);
  }
}