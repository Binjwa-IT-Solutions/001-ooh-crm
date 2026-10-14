import { redirect } from 'next/navigation';

export default function LegacyPaymentsOutPage() {
  redirect('/finance/payments-out');
}
