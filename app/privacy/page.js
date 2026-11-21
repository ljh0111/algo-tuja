import Link from "next/link";
import Shell from "@/components/Shell";

export const metadata = { title: "개인정보처리방침 — 알고투자" };

// shortcut: 보호책임자 연락처는 환경변수로 받습니다. 운영자가 정해지면 NEXT_PUBLIC_PRIVACY_CONTACT에 이메일을 넣으세요.
const CONTACT = process.env.NEXT_PUBLIC_PRIVACY_CONTACT;

const SECTIONS = [
  [
    "1. 수집하는 정보",
    "알고투자는 회원가입이 없으며 이름·연락처 같은 개인정보를 직접 받지 않습니다. 즐겨찾기와 최근 본 종목은 이용자의 브라우저(로컬 저장소)에만 저장되고 서버로 보내지 않습니다.",
  ],
  [
    "2. 자동으로 수집되는 정보",
    "서비스 운영 과정에서 접속 기록(IP 주소, 브라우저 종류, 방문 시각 등)이 호스팅 업체(Vercel)의 서버 로그에 남을 수 있습니다. 이 정보는 장애 대응과 보안 목적으로만 쓰입니다.",
  ],
  [
    "3. 광고와 쿠키",
    "이 사이트는 Google 애드센스 광고를 게재할 수 있습니다. Google을 비롯한 제3자 광고 업체는 쿠키를 사용해 이용자가 이 사이트와 다른 사이트를 방문한 기록을 바탕으로 광고를 보여줄 수 있습니다. 맞춤 광고는 Google 광고 설정에서 끌 수 있고, 브라우저 설정에서 쿠키 저장을 거부할 수도 있습니다.",
  ],
  [
    "4. 외부 서비스로 보내는 정보",
    "검색어와 종목 코드는 공시·시세·뉴스를 가져오기 위해 금융감독원 DART, 공공데이터포털, 한국은행 ECOS, FRED, Google 뉴스에 보내질 수 있습니다. AI 설명을 만들 때는 공시·뉴스 내용과 이용자가 입력한 투자 근거가 Anthropic(Claude)에 보내집니다. 투자 근거 입력란에는 개인정보를 적지 마세요.",
  ],
  [
    "5. 보유 기간과 파기",
    "알고투자는 이용자의 개인정보를 따로 저장하지 않습니다. 브라우저에 저장된 즐겨찾기·최근 본 종목은 이용자가 브라우저 데이터를 지우면 바로 삭제됩니다. 호스팅 서버의 접속 기록은 Vercel의 보관 정책에 따라 일정 기간 뒤 자동으로 삭제됩니다.",
  ],
  [
    "6. 이용자의 권리",
    "이용자는 언제든 브라우저 설정에서 저장된 데이터와 쿠키를 지우거나 저장을 거부할 수 있고, Google 광고 설정에서 맞춤 광고를 끌 수 있습니다." + (CONTACT ? " 개인정보와 관련한 열람·정정·삭제 요청은 아래 보호책임자에게 하실 수 있습니다." : ""),
  ],
  [
    "7. 방침의 변경",
    "이 방침이 바뀌면 이 페이지에 알립니다.",
  ],
];


export default function PrivacyPage() {
  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-8 sm:px-6">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-ink">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-ink-faint">시행일: 2026년 11월 22일</p>
        <div className="mt-6 space-y-4">
          {SECTIONS.map(([title, body]) => (
            <section key={title} className="rounded-2xl bg-paper-raised p-5">
              <h2 className="text-[15px] font-bold text-ink">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
            </section>
          ))}
          {CONTACT && (
            <section className="rounded-2xl bg-paper-raised p-5">
              <h2 className="text-[15px] font-bold text-ink">8. 개인정보 보호책임자</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                개인정보 관련 문의는{" "}
                <a href={`mailto:${CONTACT}`} className="font-semibold text-amber underline underline-offset-2">{CONTACT}</a>
                로 보내 주세요.
              </p>
            </section>
          )}
        </div>
        <p className="mt-6 text-sm text-ink-soft">
          Google의 광고 쿠키 사용 방식은{" "}
          <a href="https://policies.google.com/technologies/ads?hl=ko" target="_blank" rel="noopener noreferrer" className="font-semibold text-amber underline underline-offset-2">
            Google 광고 정책
          </a>
          에서, 맞춤 광고 끄기는{" "}
          <a href="https://myadcenter.google.com/?hl=ko" target="_blank" rel="noopener noreferrer" className="font-semibold text-amber underline underline-offset-2">
            내 광고 센터
          </a>
          에서 할 수 있어요.
        </p>
        <Link href="/" className="mt-8 inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft hover:text-ink">← 홈으로</Link>
      </main>
    </Shell>
  );
}
