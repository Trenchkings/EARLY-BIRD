import { NextRequest, NextResponse } from "next/server";

const STONKFUN = "https://www.stonkfun.xyz";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const sort = searchParams.get("sort") || "newest";
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || "50";

    const url =
      `${STONKFUN}/api/platform-pools` +
      `?sort=${encodeURIComponent(sort)}` +
      `&page=${encodeURIComponent(page)}` +
      `&pageSize=${encodeURIComponent(pageSize)}`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(
        `StonkFun market API returned ${response.status}.`
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("EARLY BIRD market API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load market data."
      },
      { status: 500 }
    );
  }
}
