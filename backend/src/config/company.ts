/**
 * The company's own details, printed on every document (quotations, invoices,
 * payslips, purchase orders). Change them here — not in the PDF templates.
 */
export const COMPANY = {
  name: 'Media Octus',
  /** Registered office, split into lines for document headers. */
  addressLines: ['Gargi Aura Building, 420-C, Dewas Naka, Scheme No 114', 'Indore, Madhya Pradesh 452010'],
  /** Same address on one line. */
  address: 'Gargi Aura Building, 420-C, Dewas Naka, Scheme No 114, Indore, Madhya Pradesh 452010',
  state: 'Madhya Pradesh',
  /** Default GST place of supply when none is entered. */
  defaultPlaceOfSupply: 'Madhya Pradesh (23)',
} as const;
