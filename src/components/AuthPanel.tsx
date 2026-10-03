"use client";

import { signInWithGoogle, signOut, useUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

/** Google 로그인 / 로그인한 계정 — eunas calendar 와 같은 스타일 */
export default function AuthPanel() {
  const user = useUser();

  // 환경변수가 없으면 로그인 없이 이 브라우저에만 저장
  if (!isSupabaseConfigured) return null;

  if (user === undefined) return <div className="h-9" aria-hidden />;

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        className="flex h-9 items-center justify-center bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-700"
      >
        Sign in with Google
        <GoogleLogo className="ml-1.5 size-3.5" />
      </button>
    );
  }

  const name = (user.user_metadata.full_name as string | undefined) ?? user.email;

  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border border-zinc-900 px-3 py-2 text-sm">
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-semibold">{name}</span>
        {name !== user.email && <span className="truncate text-xs text-zinc-500">{user.email}</span>}
      </div>
      <button
        onClick={signOut}
        className="shrink-0 border-b border-dotted border-current pb-px text-zinc-500 hover:text-zinc-900"
      >
        Sign out
      </button>
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
