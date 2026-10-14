import { InvoiceForm } from '@/modules/finance/components/InvoiceForm';

export default function NewProformaInvoicePage() {
  return <InvoiceForm defaultType="proforma" isEdit={false} />;
}
