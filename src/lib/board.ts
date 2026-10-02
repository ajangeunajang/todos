import type { Grape } from "@/app/page";
import { getSupabase } from "@/lib/supabase";

/*
 * 포도 보드 저장소
 * - 로그아웃: 이 브라우저의 localStorage
 * - 로그인: Supabase `merge_boards` 테이블 (한 사람당 한 줄) → 어느 기기에서든 같은 보드
 *   처음 로그인할 때 이 브라우저에 있던 보드는 계정 보드에 합침
 */
export interface Board {
  grapes: Grape[];
  score: number;
}

const STORAGE_KEY = "grapes";
const SCORE_KEY = "grapes-score";

// The starter grape every fresh board gets; it was never earned, so it isn't carried into an account.
export const DEFAULT_GRAPE_PREFIX = "default-";

export function readLocalBoard(): Board {
  try {
    const grapes: Grape[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return { grapes, score: Number(localStorage.getItem(SCORE_KEY)) || 0 };
  } catch {
    return { grapes: [], score: 0 };
  }
}

export function writeLocalBoard(board: Board) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board.grapes));
    localStorage.setItem(SCORE_KEY, String(board.score));
  } catch {
    // 저장 실패는 무시 (시크릿 모드 등)
  }
}

export function clearLocalBoard() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCORE_KEY);
  } catch {}
}

/** Local progress worth moving into an account: anything beyond the untouched starter grape. */
function localProgress(local: Board): Board {
  return { grapes: local.grapes.filter((g) => !g.id.startsWith(DEFAULT_GRAPE_PREFIX)), score: local.score };
}

/** Account board plus whatever this browser had; the caller saves it back. null = load failed. */
export async function loadAccountBoard(userId: string): Promise<{ board: Board; changed: boolean } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("merge_boards").select("grapes, score").eq("user_id", userId).maybeSingle();
  if (error) {
    console.error("보드 불러오기 실패", error);
    return null;
  }
  const remote: Board = data ? { grapes: data.grapes as Grape[], score: data.score } : { grapes: [], score: 0 };
  const local = localProgress(readLocalBoard());
  const known = new Set(remote.grapes.map((g) => g.id));
  const extra = local.grapes.filter((g) => !known.has(g.id));
  const changed = !data || extra.length > 0 || local.score > 0;
  return { board: { grapes: [...remote.grapes, ...extra], score: remote.score + local.score }, changed };
}

export async function saveAccountBoard(userId: string, board: Board) {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb
    .from("merge_boards")
    .upsert({ user_id: userId, grapes: board.grapes, score: board.score, updated_at: new Date().toISOString() });
  if (error) console.error("보드 저장 실패", error);
  return !error;
}
