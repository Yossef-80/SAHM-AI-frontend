import { NextRequest, NextResponse } from "next/server";

/** Exchange a Supabase access token with FastAPI from the Next server. */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE;

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: { message: "Missing Supabase access token." } }, { status: 401 });
  }
  if (!apiBase) {
    return NextResponse.json({ error: { message: "Application API is not configured." } }, { status: 503 });
  }

  try {
    const response = await fetch(`${apiBase.replace(/\/$/, "")}/auth/supabase-exchange`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
      cache: "no-store",
    });
    const body = await response.text();
    const headers = new Headers({
      "Content-Type": response.headers.get("content-type") ?? "application/json",
    });
    for (const name of ["retry-after", "x-ratelimit-limit", "x-ratelimit-remaining", "x-request-id"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new NextResponse(body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("Backend Supabase session exchange failed:", error);
    return NextResponse.json(
      { error: { message: "Unable to connect to the application server. Check that the backend is running." } },
      { status: 502 },
    );
  }
}
