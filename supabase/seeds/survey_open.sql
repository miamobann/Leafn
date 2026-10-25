-- 공개 설문(G) 열기: 테스트 워크스페이스에 공개 링크 /survey 가 저장할 설문 한 개를 만든다. 마이그레이션이 아니다 (자동 실행되지 않음)
--
-- 왜 필요한가: 공개 설문 화면(apps/web/app/(public)/survey/_lib/submit.ts)은 public_slug = 'leafn'인 열린 설문에 응답을 저장한다.
--   이 행이 없으면 응답자는 결과를 보지만 아무것도 저장되지 않는다.
--   public_slug는 전체에서 하나라서, 한 워크스페이스만 'leafn' 설문을 가질 수 있다.
--
-- 실행 방법 (DB 관리자)
--   1. 20261023030815_survey.sql 마이그레이션이 적용된 뒤에 실행한다
--   2. 아래 PUT_INVITE_CODE_HERE를 테스트 워크스페이스의 참여 코드로 바꾼다 (설정 화면 또는 workspaces.invite_code)
--   3. Supabase SQL Editor(또는 psql)에서 파일 전체를 실행한다. 다시 실행해도 응답은 지우지 않는다
--
-- 문항은 apps/web/lib/mock/survey.ts와 같다 (집계 화면이 문항 이름표를 이 행에서 읽는다)
-- 닫기: update public.surveys set is_open = false where public_slug = 'leafn';

begin;

create temp table _ws on commit drop as
select w.id as workspace_id from public.workspaces w
where w.invite_code = upper(btrim('PUT_INVITE_CODE_HERE'));

do $$
begin
  if (select count(*) from _ws) <> 1 then
    raise exception '참여 코드에 맞는 워크스페이스가 없습니다. PUT_INVITE_CODE_HERE를 바꿨는지 확인하세요';
  end if;
  if exists (select 1 from public.surveys s where s.public_slug = 'leafn' and s.workspace_id <> (select workspace_id from _ws)) then
    raise exception '다른 워크스페이스가 이미 leafn 설문을 쓰고 있습니다';
  end if;
end;
$$;

insert into public.surveys (workspace_id, public_slug, title_ja, questions, is_open)
select w.workspace_id, 'leafn', '肌タイプ診断',
  '[{"id":"age","text_ja":"年齢をご選択ください。","options":[{"value":"under18","label_ja":"17歳以下","is_under18":true},{"value":"18-19","label_ja":"18〜19歳"},{"value":"20s","label_ja":"20代"},{"value":"30s","label_ja":"30代"},{"value":"40s","label_ja":"40代"},{"value":"50plus","label_ja":"50代以上"}]},{"id":"after_wash","text_ja":"洗顔後、何もつけずに30分たつと、顔はどう感じますか？","options":[{"value":"all_tight","label_ja":"顔全体がつっぱり、笑ったり表情を動かしたりすると気になる","score":{"d":3}},{"value":"part_tight","label_ja":"頬や口元など一部だけつっぱる","score":{"d":2}},{"value":"brief_tight","label_ja":"はじめは少しつっぱるが、すぐに気にならなくなる","score":{"d":1}},{"value":"none","label_ja":"つっぱり感はない"}]},{"id":"t_zone","text_ja":"朝の洗顔から4〜5時間たったころ、おでこと鼻（Tゾーン）を指でさわるとどうですか？","options":[{"value":"oily_visible","label_ja":"指に皮脂がつき、テカリが目に見える","score":{"t":3}},{"value":"oily_little","label_ja":"指に皮脂が少しつく","score":{"t":2}},{"value":"glow","label_ja":"ツヤはあるが、指にはつかない","score":{"t":1}},{"value":"dry","label_ja":"さらっとしている、または乾燥している"}]},{"id":"cheek","text_ja":"同じころ（洗顔から4〜5時間後）、頬を指でさわるとどうですか？","options":[{"value":"oily","label_ja":"指に皮脂がつく","score":{"c":3}},{"value":"moist","label_ja":"しっとりしてなめらか","score":{"c":1}},{"value":"smooth","label_ja":"さらっとしていて、つっぱらない"},{"value":"rough","label_ja":"ごわつく、または角質がざらつく","score":{"d":2}}]},{"id":"pores","text_ja":"鏡から30cmほど離れて見たとき、毛穴が見えるのはどこですか？","options":[{"value":"cheek","label_ja":"鼻だけでなく頬まで見える","score":{"c":2}},{"value":"nose","label_ja":"鼻とそのまわりだけ見える","score":{"t":1}},{"value":"none","label_ja":"ほとんど見えない"}]},{"id":"moisturizer","text_ja":"エアコンの効いた室内や冬に、保湿剤を塗ったあとの肌はどうですか？","options":[{"value":"tight_again","label_ja":"塗っても数時間でまたつっぱる、または粉をふく","score":{"d":3}},{"value":"fine","label_ja":"塗れば一日中気にならない","score":{"d":1}},{"value":"no_need","label_ja":"保湿剤を塗らなくても気にならない"}]},{"id":"blotting","text_ja":"1日にあぶらとり紙やティッシュで顔の皮脂をおさえる回数は？","options":[{"value":"2plus","label_ja":"2回以上","score":{"t":2}},{"value":"1","label_ja":"1回","score":{"t":1}},{"value":"0","label_ja":"おさえない（必要がない）"}]},{"id":"new_product","text_ja":"新しい基礎化粧品（化粧水・クリームなど）を初めて使ったとき、ヒリヒリ・赤み・かゆみが出たことはありますか？","options":[{"value":"always","label_ja":"新しい製品を使うたびにほとんど出る","score":{"s":3}},{"value":"this_year","label_ja":"この1年で2回以上出た","score":{"s":2}},{"value":"long_ago","label_ja":"1年以上前に1〜2回あった","score":{"s":1}},{"value":"never","label_ja":"一度もない"}]},{"id":"triggers","text_ja":"肌が赤くなったり、かゆくなったりしたことがある場面をすべてお選びください。","multi":true,"count_score":{"key":"s","max":2},"options":[{"value":"season","label_ja":"季節の変わり目"},{"value":"pollen","label_ja":"花粉の時期"},{"value":"mask","label_ja":"マスクを長時間つけたとき"},{"value":"sun","label_ja":"日差しを浴びたあと"},{"value":"sweat","label_ja":"汗をかいたあと"},{"value":"none","label_ja":"あてはまらない","is_none":true}]},{"id":"concerns","text_ja":"気になる肌の悩みをお選びください。","multi":true,"options":[{"value":"dryness","label_ja":"乾燥・つっぱり"},{"value":"shine","label_ja":"テカリ・毛穴"},{"value":"acne","label_ja":"ニキビ・肌あれ"},{"value":"dullness","label_ja":"くすみ"},{"value":"redness","label_ja":"赤み・刺激"},{"value":"firmness","label_ja":"ハリ・小じわ"},{"value":"other","label_ja":"その他（自由記入）","is_other":true}]}]'::jsonb
  true
from _ws w
on conflict (public_slug) do update set questions = excluded.questions, is_open = true;

-- 확인: 열린 설문 1개
select id, public_slug, is_open, jsonb_array_length(questions) as questions from public.surveys where public_slug = 'leafn';

commit;
