import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Per-request client that acts as the signed-in dashboard user.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component; middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * The signed-in user, verified locally from the session JWT (asymmetric signing keys),
 * so it costs no round trip to Supabase Auth on each request.
 */
export async function getUser(supabase?: Awaited<ReturnType<typeof createClient>>) {
  const client = supabase ?? (await createClient());
  const { data } = await client.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
}
