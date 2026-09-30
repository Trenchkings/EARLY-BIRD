import { NextResponse } from "next/server";
import {
  getPairs,
  PumpFunError
} from "../../../../lib/pumpfun-adapter";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      pairs: getPairs()
    });
  } catch (error) {
    const status =
      error instanceof PumpFunError
        ? error.status
        : 502;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Pump.fun pairs."
      },
      { status }
    );
  }
}
