import { NextResponse } from "next/server";
import { assertSameTransactionMessage, submitLaunch, StonkFunError } from "../../../../lib/stonkfun-adapter";
import { launchRecords, submissionRequests } from "../../../../lib/stonkfun-launch-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { launchId?: unknown; transaction?: unknown } | null;
    if (!body || typeof body.launchId !== "string" || !body.launchId || typeof body.transaction !== "string" || !body.transaction) {
      throw new StonkFunError("Launch ID and signed transaction are required.", 400);
    }
    const record = launchRecords.get(body.launchId);
    if (!record) throw new StonkFunError("This prepared launch is missing or expired. Prepare it again before signing.", 409);
    assertSameTransactionMessage(record.transaction, body.transaction);
    const existing = submissionRequests.get(body.launchId);
    if (existing) return NextResponse.json(await existing);
    const result = submitLaunch(body.launchId, body.transaction, record.creator);
    submissionRequests.set(body.launchId, result);
    result.catch(() => submissionRequests.delete(body.launchId as string));
    return NextResponse.json(await result);
  } catch (error) {
    const status = error instanceof StonkFunError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit launch." }, { status });
  }
}
