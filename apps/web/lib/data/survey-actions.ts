"use server";

// 공개 설문(G)의 쓰기 함수 (Server Action). 로그인 없이 anon 키로 부르고, RLS가 열린 설문에만 넣게 막는다.
// 18세 미만은 답을 받지 않고 참여 수만 올린다 (record_survey_minor)
import { createClient } from "@/lib/supabase/server";
import { SurveySession } from "@/lib/schemas/survey";
import { buildSurveyResponse } from "@/lib/survey/response";
import { getSurveyQuestions } from "./index";
import { isSupabaseConfigured } from "./workspace";

// /survey 공개 링크가 가리키는 설문. surveys에 이 slug로 열린(is_open) 행이 있어야 저장된다
const SURVEY_SLUG = "leafn";

export type SaveResult = { saved: boolean };

export async function submitSurveyResponse(input: SurveySession): Promise<SaveResult> {
  const session = SurveySession.safeParse(input);
  if (!session.success) return { saved: false };
  const built = buildSurveyResponse(await getSurveyQuestions(), session.data, new Date());
  if (built.kind !== "adult") {
    if (built.kind === "invalid") console.warn(`설문 응답을 저장하지 않음: ${built.reason}`);
    return { saved: false };
  }
  if (!isSupabaseConfigured()) return { saved: false };

  const supabase = await createClient();
  const { data: survey, error: findError } = await supabase
    .from("surveys")
    .select("id, workspace_id")
    .eq("public_slug", SURVEY_SLUG)
    .eq("is_open", true)
    .maybeSingle();
  if (findError || !survey) {
    console.error(`열린 설문(${SURVEY_SLUG})을 찾지 못함: ${findError?.message ?? "행 없음"}`);
    return { saved: false };
  }
  // 익명은 survey_responses를 읽을 수 없으므로 insert 결과를 돌려받지 않는다 (.select() 금지)
  const { error } = await supabase.from("survey_responses").insert({ ...built.row, workspace_id: survey.workspace_id, survey_id: survey.id });
  if (error) {
    console.error(`설문 응답 저장 실패: ${error.message}`);
    return { saved: false };
  }
  return { saved: true };
}

export async function recordSurveyMinor(): Promise<SaveResult> {
  if (!isSupabaseConfigured()) return { saved: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_survey_minor", { p_slug: SURVEY_SLUG });
  if (error) {
    console.error(`18세 미만 참여 수 기록 실패: ${error.message}`);
    return { saved: false };
  }
  return { saved: true };
}
