import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

// undefined = 확인 중, null = 로그아웃, User = 로그인
let user: User | null | undefined = undefined;
let started = false;
const listeners = new Set<() => void>();

function set(next: User | null) {
  if (user?.id === next?.id && user !== undefined) return;
  user = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started) return;
  started = true;
  const sb = getSupabase();
  if (!sb) {
    set(null);
    return;
  }
  // Google에서 돌아온 경우 ?code= 교환은 클라이언트가 자동 처리
  sb.auth.getSession().then(({ data }) => set(data.session?.user ?? null));
  sb.auth.onAuthStateChange((_event, session) => set(session?.user ?? null));
}

export function subscribeAuth(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUser() {
  return user;
}

export function useUser() {
  return useSyncExternalStore(subscribeAuth, getUser, () => undefined);
}

export async function signInWithGoogle() {
  await getSupabase()?.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  await getSupabase()?.auth.signOut();
}
