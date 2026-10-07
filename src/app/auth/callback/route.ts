import { NextResponse } from "next/server";

/** OAuth is paused; send stale callbacks back to the email/password flow. */
export function GET(request: Request) {
  const login = new URL("/login", request.url);
  login.searchParams.set("auth", "deferred");
  return NextResponse.redirect(login);
}
