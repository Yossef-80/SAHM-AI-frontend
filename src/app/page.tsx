import { AskAiHero } from "@/components/home/ask-ai-hero";
import { Capabilities } from "@/components/home/capabilities";
import { ActiveCampaigns } from "@/components/home/active-campaigns";
import { NeedsAttention } from "@/components/home/needs-attention";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <AskAiHero />
      <Capabilities />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ActiveCampaigns />
        </div>
        <div className="lg:col-span-2">
          <NeedsAttention />
        </div>
      </div>
    </div>
  );
}
