import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  if (req.cookies.get("silaa_token")) return NextResponse.next();
  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next|favicon.ico).*)"],
};
