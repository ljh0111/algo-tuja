// 애드센스 심사·수익 보호용 ads.txt. 게시자 ID(NEXT_PUBLIC_ADSENSE_CLIENT)가 있을 때만 내보냅니다.
export const dynamic = "force-static";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT; // 예: ca-pub-1234567890123456
  if (!client) return new Response("Not found", { status: 404 });
  const pub = client.replace(/^ca-/, "");
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
