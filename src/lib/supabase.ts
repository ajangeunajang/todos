import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** 환경변수가 없으면 로그인 기능 없이 로컬 저장만 사용 */
export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** 브라우저에서만 생성 (세션은 localStorage에 저장, Google 로그인은 PKCE 흐름) */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || typeof window === "undefined") return null;
  client ??= createClient(url!, key!, { auth: { flowType: "pkce" } });
  return client;
}
