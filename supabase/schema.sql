-- merge-todos — 계정별 포도 보드 (한 사람당 한 줄)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run

create table if not exists public.merge_boards (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  grapes jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 행 단위 보안: 로그인한 사람은 자기 보드만 보고/만들고/수정
alter table public.merge_boards enable row level security;

drop policy if exists "own board: select" on public.merge_boards;
drop policy if exists "own board: insert" on public.merge_boards;
drop policy if exists "own board: update" on public.merge_boards;

create policy "own board: select" on public.merge_boards
  for select to authenticated using (user_id = auth.uid());
create policy "own board: insert" on public.merge_boards
  for insert to authenticated with check (user_id = auth.uid());
create policy "own board: update" on public.merge_boards
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
