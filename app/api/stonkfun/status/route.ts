import { NextResponse } from "next/server";
import { getLaunchStatus, StonkFunError } from "../../../../lib/stonkfun-adapter";

export async function GET(request: Request) {
  try {
    const launchId = new URL(request.url).searchParams.get("launchId");
    if (!launchId) throw new StonkFunError("Launch ID is required.", 400);
    return NextResponse.json(await getLaunchStatus(launchId));
  } catch (error) {
    const status = error instanceof StonkFunError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load launch status." }, { status });
  }
}
