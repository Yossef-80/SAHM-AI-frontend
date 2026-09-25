import { CampaignDetail } from "@/components/campaigns/detail/campaign-detail";

export default function CampaignPage({ params }: { params: { id: string } }) {
  return <CampaignDetail id={params.id} />;
}
