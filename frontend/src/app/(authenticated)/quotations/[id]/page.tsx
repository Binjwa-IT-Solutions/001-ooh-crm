import { redirect } from "next/navigation";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  redirect(`/quotations?step=3&id=${resolvedParams?.id || ""}`);
}
