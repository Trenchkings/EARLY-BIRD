import { NextResponse } from "next/server";
import { getLaunchStatus, StonkFunError } from "../../../../../lib/stonkfun-adapter";
import { launchRecords } from "../../../../../lib/stonkfun-launch-store";

export async function GET(_request: Request, context: { params: Promise<{ launchId: string }> }) {
  try {
    const { launchId } = await context.params;
    if (!launchRecords.has(launchId)) throw new StonkFunError("This launch is unknown or expired.", 404);
    return NextResponse.json(await getLaunchStatus(launchId));
  } catch (error) {
    const status = error instanceof StonkFunError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load launch status." }, { status });
  }
}
