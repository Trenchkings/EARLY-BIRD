import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAIRS_URL =
  "https://www.stonkfun.xyz/api/public/v1/pairs";

export async function GET() {
  try {
    const response = await fetch(PAIRS_URL, {
      cache: "no-store"
    });

    const payload: unknown =
      await response.json().catch(() => null);

    const body =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : null;

    const data =
      body?.data &&
      typeof body.data === "object" &&
      !Array.isArray(body.data)
        ? body.data as Record<string, unknown>
        : null;

    return NextResponse.json({
      upstreamStatus: response.status,
      upstreamOk: response.ok,

      payloadType:
        Array.isArray(payload)
          ? "array"
          : payload === null
            ? "null"
            : typeof payload,

      topLevelKeys:
        body ? Object.keys(body) : [],

      topLevelArrayLength:
        Array.isArray(payload)
          ? payload.length
          : null,

      pairsIsArray:
        Array.isArray(body?.pairs),

      pairsLength:
        Array.isArray(body?.pairs)
          ? body.pairs.length
          : null,

      dataType:
        Array.isArray(body?.data)
          ? "array"
          : body?.data === null
            ? "null"
            : typeof body?.data,

      dataKeys:
        data ? Object.keys(data) : [],

      dataPairsIsArray:
        Array.isArray(data?.pairs),

      dataPairsLength:
        Array.isArray(data?.pairs)
          ? data.pairs.length
          : null
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Debug request failed."
      },
      { status: 500 }
    );
  }
}
