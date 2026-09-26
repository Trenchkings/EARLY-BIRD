import { NextResponse } from "next/server";
import { getPairs, prepareLaunch, StonkFunError, StonkFunLaunchRequest, assertMainnetRpc, assertPublicKey } from "../../../../lib/stonkfun-adapter";
import { validateTokenMetadata } from "../../../../lib/token-metadata";
import { preparationRequests, rememberLaunch } from "../../../../lib/stonkfun-launch-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { requestId?: unknown; launch?: Partial<StonkFunLaunchRequest>; metadata?: unknown } | null;
    if (!body || typeof body.requestId !== "string" || !body.requestId || !body.launch) {
      throw new StonkFunError("A launch and request ID are required.", 400);
    }
    if (!/^[a-f0-9]{64}$/.test(body.requestId)) throw new StonkFunError("Request ID is invalid.", 400);
    await assertMainnetRpc();
    const publicKey = assertPublicKey(body.launch.publicKey, "Creator wallet");
    const quoteMint = assertPublicKey(body.launch.quoteMint, "Quote mint");
    const metadataError = validateTokenMetadata(body.metadata as Record<string, unknown>);
    if (metadataError) throw new StonkFunError(metadataError, 400);
    const pairs = await getPairs();
    if (!pairs.some(pair => pair.mint === quoteMint)) throw new StonkFunError("Select a currently launchable StonkFun quote pair.", 400);
    const launch: StonkFunLaunchRequest = {
      publicKey, quoteMint,
      name: String(body.launch.name || "").trim(), symbol: String(body.launch.symbol || "").trim(),
      description: String(body.launch.description || "").trim(), devBuyAmount: String(body.launch.devBuyAmount || "0"),
      website: typeof body.launch.website === "string" ? body.launch.website : undefined,
      twitter: typeof body.launch.twitter === "string" ? body.launch.twitter : undefined,
      telegram: typeof body.launch.telegram === "string" ? body.launch.telegram : undefined
    };
    const key = `${publicKey}:${body.requestId}`;
    const existing = preparationRequests.get(key);
    if (existing) return NextResponse.json(await existing);
    const result = prepareLaunch(launch).then(prepared => { rememberLaunch(prepared, publicKey); return prepared; });
    preparationRequests.set(key, result);
    result.catch(() => preparationRequests.delete(key));
    return NextResponse.json(await result);
  } catch (error) {
    const status = error instanceof StonkFunError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to prepare launch." }, { status });
  }
}
