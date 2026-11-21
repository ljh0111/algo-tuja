// 관심 종목·최근 본 종목: 이 브라우저에만 저장하는 개인 편의 기능 (로그인 없음)
const FAV = "algo:favorites";
const RECENT = "algo:recent";

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}
function write(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // 시크릿 창 등에서 저장이 막혀도 화면은 그대로 동작
  }
}
const pick = (c) => ({ ticker: c.ticker, name: c.name });

export const getFavorites = () => read(FAV);
export const getRecent = () => read(RECENT);
export const isFavorite = (ticker) => read(FAV).some((c) => c.ticker === ticker);

export function toggleFavorite(company) {
  const list = read(FAV);
  const on = !list.some((c) => c.ticker === company.ticker);
  write(FAV, on ? [pick(company), ...list].slice(0, 20) : list.filter((c) => c.ticker !== company.ticker));
  return on;
}

export function addRecent(company) {
  write(RECENT, [pick(company), ...read(RECENT).filter((c) => c.ticker !== company.ticker)].slice(0, 8));
}
