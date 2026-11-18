import { redirect } from "next/navigation";

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const params = await searchParams;
  const leadIdQuery = params?.leadId ? `&leadId=${params.leadId}` : "";
  redirect(`/quotations?step=2${leadIdQuery}`);
}
