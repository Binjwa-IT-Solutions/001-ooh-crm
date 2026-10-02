import { redirect } from "next/navigation";

export default function NewPurchaseOrderPage() {
  redirect("/purchase-orders?step=2");
}
