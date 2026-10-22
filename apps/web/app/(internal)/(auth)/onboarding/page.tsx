import { Input } from "@/components/ui/input";
import { StepFormTemplate } from "@/components/templates";

export default function OnboardingPage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">워크스페이스 시작</h1>
      <StepFormTemplate step={1} total={2} nextHref="/" nextLabel="시작하기">
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-medium">새 워크스페이스 만들기</p>
            <Input placeholder="팀 이름" />
          </div>
          <div className="space-y-2">
            <p className="font-medium">초대 코드로 참여</p>
            <Input placeholder="초대 코드" />
          </div>
        </div>
      </StepFormTemplate>
    </>
  );
}
