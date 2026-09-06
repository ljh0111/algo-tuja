import Shell from "@/components/Shell";
import CompanyView from "@/components/CompanyView";

export default function Page({ params }) {
  return (
    <Shell>
      <CompanyView ticker={params.ticker} />
    </Shell>
  );
}
