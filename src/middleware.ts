import { NextRequest, NextResponse } from "next/server";

// Proteção opcional por usuário/senha (defina BASIC_AUTH_USER e BASIC_AUTH_PASS na Vercel).
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next();

  const h = req.headers.get("authorization");
  if (h?.startsWith("Basic ")) {
    const [u, ...p] = atob(h.slice(6)).split(":");
    if (u === user && p.join(":") === pass) return NextResponse.next();
  }
  return new NextResponse("Autenticação necessária", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Dashboard de Produção"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
