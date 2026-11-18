/**
 * The company's own details shown on printable documents (invoices, quotations,
 * purchase orders). Keep in sync with backend/src/config/company.ts.
 */
export const COMPANY = {
  name: 'Media Octus',
  addressLines: ['Gargi Aura Building, 420-C, Dewas Naka, Scheme No 114', 'Indore, Madhya Pradesh 452010'],
  address: 'Gargi Aura Building, 420-C, Dewas Naka, Scheme No 114, Indore, Madhya Pradesh 452010',
  state: 'Madhya Pradesh',
} as const;

/** Default GST place of supply when none is entered (the company's own state). */
export const DEFAULT_PLACE_OF_SUPPLY = 'Madhya Pradesh (23)';

/** GST state codes — the first two digits of a GSTIN. */
const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
};

/** "23ABCDE1234F1Z5" → "Madhya Pradesh (23)"; null when the GSTIN doesn't start with a known state code. */
export function placeOfSupplyFromGstin(gstin?: string | null): string | null {
  const code = gstin?.trim().slice(0, 2);
  return code && GST_STATES[code] ? `${GST_STATES[code]} (${code})` : null;
}
