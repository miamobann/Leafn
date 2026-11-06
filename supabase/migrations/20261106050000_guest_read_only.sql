-- 게스트(포트폴리오 공개용 데모 계정) 읽기 전용.
-- 데모 계정은 auth.users.raw_app_meta_data에 {"demo": true}를 가진다. app_metadata는 service role만 바꿀 수 있어서 사용자가 스스로 풀 수 없다.
-- public 스키마의 모든 테이블에 문장 단위 트리거를 걸어, 데모 계정 세션의 insert · update · delete · truncate를 막는다.
-- security definer 함수(submit_version 등) 안에서 쓰는 경우도 트리거가 걸리므로 같이 막힌다.
-- service role(수집기, AI 분석 결과 저장)은 JWT에 demo가 없어서 영향이 없다. AI 분석 저장은 앱(writeContext)에서 게스트를 먼저 막는다.
-- 이 파일 뒤에 만든 테이블에는 트리거가 없다. 새 테이블을 만들면 아래 create trigger를 같이 넣는다.

create function public.is_demo_user()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'demo')::boolean, false);
$$;

create function public.block_demo_writes()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if public.is_demo_user() then
    raise exception '게스트 모드는 읽기 전용이에요' using errcode = '42501';
  end if;
  return null;
end;
$$;

do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'create trigger zz_block_demo_writes before insert or update or delete or truncate on public.%I for each statement execute function public.block_demo_writes()',
      t.tablename
    );
  end loop;
end;
$$;
