import { NextResponse } from "next/server";
import {
  submitLaunch,
  StonkFunError
} from "../../../../lib/stonkfun-adapter";

const submissions = new Map<
  string,
  Promise<{ launchId: string; signature: string; mint?: string; pool?: string }>
>();

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      launchId?: unknown;
      transaction?: unknown;
      fundingTransaction?: unknown;
    } | null;

    if (
      !body ||
      typeof body.launchId !== "string" ||
      !body.launchId ||
      typeof body.transaction !== "string" ||
      !body.transaction
    ) {
      throw new StonkFunError(
        "Launch ID and signed transaction are required.",
        400
      );
    }

    const fundingTransaction =
      typeof body.fundingTransaction === "string" &&
      body.fundingTransaction
        ? body.fundingTransaction
        : undefined;

    const key = fundingTransaction
      ? `${body.launchId}:funded`
      : body.launchId;

    const existing = submissions.get(key);

    if (existing) {
      return NextResponse.json(await existing);
    }

    const result = submitLaunch(
      body.launchId,
      body.transaction,
      fundingTransaction
    );

    submissions.set(key, result);

    result.catch(() => {
      submissions.delete(key);
    });

    return NextResponse.json(await result);
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
            : "Unable to submit launch."
      },
      { status }
    );
  }
}

