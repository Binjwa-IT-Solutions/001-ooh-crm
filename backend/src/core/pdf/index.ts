import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

/**
 * PDF GENERATION SCAFFOLD.
 *
 * Quotations (B2), purchase orders (C4) and reports all render through here, so
 * every document a client receives looks like it came from the same company.
 *
 *   const buffer = await renderPdf({
 *     title: 'Quotation',
 *     reference: quote.quoteNumber,
 *     meta: [['Client', lead.companyName], ['Valid until', formatDate(quote.validUntil)]],
 *     build: (doc) => {
 *       lineItemsTable(doc, { columns, rows, totals: [['Total', quote.total]] });
 *     },
 *   });
 *
 * Then hand the buffer to `fileService.saveBuffer()`, or stream it to the client.
 */

export interface PdfBrand {
  companyName: string;
  addressLines: string[];
  email?: string;
  phone?: string;
  gstin?: string;
}

/** Replace with the client's real details once branding is signed off. */
export const DEFAULT_BRAND: PdfBrand = {
  companyName: 'Media Octus',
  addressLines: ['Mumbai, Maharashtra', 'India'],
  email: 'hello@mediaoctus.com',
};

const PAGE_MARGIN = 48;
const INK = '#0f172a';
const MUTED = '#64748b';
const RULE = '#e2e8f0';

/**
 * Formats integer paise for a document. Money is stored in paise everywhere;
 * this is one of the few places it becomes rupees, and it happens at render
 * time — never inside a calculation.
 */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return `INR ${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface RenderPdfOptions {
  title: string;
  /** Document number, e.g. MO-Q-2026-0001. */
  reference?: string;
  /** Key/value pairs rendered under the title. */
  meta?: Array<[string, string]>;
  brand?: PdfBrand;
  /** Draws the body. The header is already rendered when this runs. */
  build: (doc: PDFKit.PDFDocument) => void;
}

/** Renders a document and resolves with the finished PDF as a Buffer. */
export function renderPdf(options: RenderPdfOptions): Promise<Buffer> {
  const brand = options.brand ?? DEFAULT_BRAND;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      // Required so the footer can revisit earlier pages and number them.
      bufferPages: true,
      info: { Title: options.title, Author: brand.companyName },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawHeader(doc, brand, options);
      options.build(doc);
      drawFooterOnEveryPage(doc, brand);
      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function drawHeader(doc: PDFKit.PDFDocument, brand: PdfBrand, options: RenderPdfOptions) {
  doc.fillColor(INK).fontSize(16).font('Helvetica-Bold').text(brand.companyName);

  doc.fontSize(8).font('Helvetica').fillColor(MUTED);
  for (const line of brand.addressLines) doc.text(line);
  if (brand.email) doc.text(brand.email);
  if (brand.phone) doc.text(brand.phone);
  if (brand.gstin) doc.text(`GSTIN: ${brand.gstin}`);

  doc.moveDown(1.2);
  doc.fillColor(INK).fontSize(20).font('Helvetica-Bold').text(options.title.toUpperCase());

  if (options.reference) {
    doc.fontSize(10).font('Helvetica').fillColor(MUTED).text(options.reference);
  }

  if (options.meta?.length) {
    doc.moveDown(0.8);
    doc.fontSize(9);
    for (const [label, value] of options.meta) {
      doc.fillColor(MUTED).text(`${label}: `, { continued: true }).fillColor(INK).text(value);
    }
  }

  doc.moveDown(0.8);
  horizontalRule(doc);
  doc.moveDown(0.8);
}

/** A full-width divider at the current vertical position. */
export function horizontalRule(doc: PDFKit.PDFDocument) {
  const y = doc.y;
  doc
    .strokeColor(RULE)
    .lineWidth(1)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke();
}

export interface TableColumn {
  header: string;
  /** Share of the available width. Widths should sum to roughly 1. */
  width: number;
  align?: 'left' | 'right';
}

/**
 * A line-items table with an optional totals block — the shape quotations and
 * purchase orders both need.
 */
export function lineItemsTable(
  doc: PDFKit.PDFDocument,
  params: {
    columns: TableColumn[];
    rows: string[][];
    /** Label plus an amount in **paise**. */
    totals?: Array<[string, number]>;
  },
) {
  const usableWidth = doc.page.width - PAGE_MARGIN * 2;
  const positions: number[] = [];
  let cursor = PAGE_MARGIN;

  for (const column of params.columns) {
    positions.push(cursor);
    cursor += column.width * usableWidth;
  }

  // Header row
  doc.fontSize(8).font('Helvetica-Bold').fillColor(MUTED);
  const headerY = doc.y;
  params.columns.forEach((column, index) => {
    doc.text(column.header.toUpperCase(), positions[index], headerY, {
      width: column.width * usableWidth - 8,
      align: column.align ?? 'left',
    });
  });

  doc.y = headerY + 14;
  horizontalRule(doc);
  doc.moveDown(0.5);

  // Body rows
  doc.font('Helvetica').fontSize(9).fillColor(INK);
  for (const row of params.rows) {
    // Break the page before a row runs off the bottom.
    if (doc.y > doc.page.height - 120) doc.addPage();

    const rowY = doc.y;
    let tallest = 0;

    params.columns.forEach((column, index) => {
      const width = column.width * usableWidth - 8;
      const text = row[index] ?? '';
      doc.text(text, positions[index], rowY, { width, align: column.align ?? 'left' });
      tallest = Math.max(tallest, doc.heightOfString(text, { width }));
    });

    doc.y = rowY + tallest + 6;
  }

  if (params.totals?.length) {
    doc.moveDown(0.5);
    horizontalRule(doc);
    doc.moveDown(0.5);

    for (const [label, amountPaise] of params.totals) {
      const y = doc.y;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED)
        .text(label, PAGE_MARGIN, y, { width: usableWidth - 130, align: 'right' });
      doc
        .font('Helvetica-Bold')
        .fillColor(INK)
        .text(formatPaise(amountPaise), PAGE_MARGIN + usableWidth - 130, y, {
          width: 130,
          align: 'right',
        });
      doc.y = y + 14;
    }
  }
}

/** A simple two-column key/value block, for document metadata sections. */
export function keyValueBlock(doc: PDFKit.PDFDocument, rows: Array<[string, string]>) {
  const usableWidth = doc.page.width - PAGE_MARGIN * 2;

  for (const [label, value] of rows) {
    const y = doc.y;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(label, PAGE_MARGIN, y, { width: usableWidth * 0.3 });
    doc
      .fillColor(INK)
      .text(value, PAGE_MARGIN + usableWidth * 0.3, y, { width: usableWidth * 0.7 });
    doc.y = y + 14;
  }
}

function drawFooterOnEveryPage(doc: PDFKit.PDFDocument, brand: PdfBrand, margin = PAGE_MARGIN) {
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    const oldBottomMargin = doc.page.margins.bottom;
    // Set bottom margin to 0 temporarily so writing footer text does NOT trigger PDFKit auto-pagination
    doc.page.margins.bottom = 0;

    const y = doc.page.height - 24;
    const width = doc.page.width - margin * 2;

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        `${brand.companyName} · generated ${new Date().toLocaleDateString('en-IN')}`,
        margin,
        y,
        { width, align: 'left', lineBreak: false },
      )
      .text(`Page ${i - range.start + 1} of ${range.count}`, margin, y, {
        width,
        align: 'right',
        lineBreak: false,
      });

    doc.page.margins.bottom = oldBottomMargin;
  }
}

/* ==========================================================================
   MYBILLBOOK / VYAPAR STYLE ENTERPRISE QUOTATION PDF RENDERER
   ========================================================================== */

export interface QuotationLineItem {
  index: number;
  siteCode?: string;
  location?: string;
  mediaType?: string;
  dimensions?: string; // e.g. "20ft x 10ft (200 sq.ft)"
  dates: string; // e.g. "01/10/2026 - 31/10/2026"
  days: number;
  ratePerDay: number; // in paise
  discountPercent?: number;
  taxPercent?: number;
  amount: number; // in paise
}

export interface QuotationBillBookPdfOptions {
  quotationNumber: string;
  date: Date | string;
  validUntil: Date | string;
  status: string;
  seller?: {
    companyName?: string;
    tagline?: string;
    addressLines?: string[];
    gstin?: string;
    pan?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  client: {
    companyName: string;
    contactPerson?: string;
    address?: string;
    city?: string;
    state?: string;
    email?: string;
    phone?: string;
    gstin?: string;
  };
  items: QuotationLineItem[];
  pricing: {
    grossTotal?: number; // paise
    discountTotal?: number; // paise
    subtotal: number; // paise
    taxRate?: number; // 0.18
    isInterState?: boolean;
    taxAmount: number; // paise
    grandTotal: number; // paise
  };
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    ifsc?: string;
    branch?: string;
    upiId?: string;
  };
  terms?: string[];
  signature?: {
    image?: string;
    signatoryName?: string;
    signatoryDesignation?: string;
  };
}

/**
 * Converts a numeric rupee value into Indian English words (Lakhs, Crores, Thousands).
 */
export function numberToIndianWords(amountRupees: number): string {
  if (!amountRupees || amountRupees <= 0) return 'Zero Rupees Only';

  const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const double = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return single[n];
    const tens = double[Math.floor(n / 10)];
    const units = single[n % 10];
    return units ? `${tens} ${units}` : tens;
  }

  function convertThreeDigits(n: number): string {
    let s = '';
    const hundreds = Math.floor(n / 100);
    const rem = n % 100;
    if (hundreds > 0) {
      s += `${single[hundreds]} Hundred`;
      if (rem > 0) s += ' ';
    }
    if (rem > 0) {
      s += convertTwoDigits(rem);
    }
    return s;
  }

  const integerPart = Math.floor(amountRupees);
  const paisePart = Math.round((amountRupees - integerPart) * 100);

  let num = integerPart;
  const parts: string[] = [];

  const crores = Math.floor(num / 10000000);
  num %= 10000000;
  if (crores > 0) parts.push(`${convertTwoDigits(crores)} Crore`);

  const lakhs = Math.floor(num / 100000);
  num %= 100000;
  if (lakhs > 0) parts.push(`${convertTwoDigits(lakhs)} Lakh`);

  const thousands = Math.floor(num / 1000);
  num %= 1000;
  if (thousands > 0) parts.push(`${convertTwoDigits(thousands)} Thousand`);

  if (num > 0) parts.push(convertThreeDigits(num));

  let words = parts.join(' ').trim() + ' Rupees';
  if (paisePart > 0) {
    words += ` and ${convertTwoDigits(paisePart)} Paise`;
  }
  return words + ' Only';
}

function formatDateInd(d: Date | string | undefined | null): string {
  if (!d) return '-';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '-';
  return dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Renders a high-finish, myBillBook / Vyapar-style Quotation PDF document.
 */
export function renderQuotationBillBookPdf(options: QuotationBillBookPdfOptions): Promise<Buffer> {
  const BRAND_BURGUNDY = '#6A1B21';
  const BRAND_DARK = '#0F172A';
  const BRAND_MUTED = '#475569';
  const BRAND_LIGHT_MUTED = '#64748B';
  const BORDER_COLOR = '#E2E8F0';
  const CARD_BG = '#F8FAFC';

  const seller = {
    companyName: options.seller?.companyName || 'Media Octus',
    addressLines: options.seller?.addressLines || [
      '4th floor Gargi Aura Building near Scheme no114',
      'Indore, Madhya Pradesh 452010',
    ],
    gstin: options.seller?.gstin || '23DRHPS3516P1ZZ',
    pan: options.seller?.pan || 'DRHPS3516P',
    email: options.seller?.email || 'mediaoctus005@gmail.com',
    phone: options.seller?.phone || '',
    website: options.seller?.website || 'www.mediaoctus.com',
  };

  const client = {
    companyName: options.client?.companyName || 'Valued Client',
    contactPerson: options.client?.contactPerson || '-',
    address: options.client?.address || '-',
    city: options.client?.city || '',
    state: options.client?.state || '',
    email: options.client?.email || '-',
    phone: options.client?.phone || '-',
    gstin: options.client?.gstin || 'Unregistered',
  };

  const bank = {
    bankName: options.bankDetails?.bankName || 'HDFC Bank',
    accountName: options.bankDetails?.accountName || 'Media Octus Private Limited',
    accountNumber: options.bankDetails?.accountNumber || '50200012345678',
    ifsc: options.bankDetails?.ifsc || 'HDFC0001234',
    branch: options.bankDetails?.branch || 'Vijay Nagar, Indore',
    upiId: options.bankDetails?.upiId || 'mediaoctus@hdfcbank',
  };

  const terms = (options.terms && options.terms.length > 0) ? options.terms : [
    'Gst applicable .',
    'for any query please feel free to call or message any time .',
    '100%Payment in Advance.',
    'please visit https://www.mediaoctus.com.',
  ];

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      bufferPages: true,
      info: {
        Title: `Quotation ${options.quotationNumber} - ${client.companyName}`,
        Author: seller.companyName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const pageMargin = 36;
      const usableWidth = doc.page.width - pageMargin * 2; // ~523px

      // 1. Top Decorative Brand Accent Line
      doc.rect(0, 0, doc.page.width, 5).fill(BRAND_BURGUNDY);

      // 2. Header Area
      let logoLoaded = false;
      const possibleLogos = [
        path.resolve(process.cwd(), 'src/assets/logo.png'),
        path.resolve(process.cwd(), 'dist/assets/logo.png'),
        path.resolve(process.cwd(), '../frontend/public/logo.png'),
        path.resolve(process.cwd(), 'public/logo.png'),
      ];

      for (const logoPath of possibleLogos) {
        if (fs.existsSync(logoPath)) {
          try {
            doc.image(logoPath, pageMargin, 20, { fit: [140, 48] });
            logoLoaded = true;
            break;
          } catch {
            // fallback
          }
        }
      }

      if (!logoLoaded) {
        doc.fontSize(18).font('Helvetica-Bold').fillColor(BRAND_BURGUNDY).text('MEDIA OCTUS', pageMargin, 20);
        doc.fontSize(8).font('Helvetica').fillColor(BRAND_LIGHT_MUTED).text('Outdoor Media & Advertising Solutions', pageMargin, 42);
      }

      // Seller Tagline / Subtitle under Logo
      doc.fontSize(8).font('Helvetica').fillColor(BRAND_LIGHT_MUTED).text(
        'Outdoor Media & Advertising Solutions',
        pageMargin,
        74,
        { width: 280 },
      );

      // Right Side: Quotation Title & Metadata Box
      const rightX = doc.page.width - pageMargin - 210;
      doc.fontSize(22).font('Helvetica-Bold').fillColor(BRAND_BURGUNDY).text('QUOTATION', rightX, 18, {
        width: 210,
        align: 'right',
      });

      // Quote Number Badge Box
      doc.roundedRect(rightX + 40, 46, 170, 20, 4).fillAndStroke('#FDF2F2', '#FECACA');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#8B2424').text(
        `Quote #: ${options.quotationNumber}`,
        rightX + 40,
        51,
        { width: 170, align: 'center' },
      );

      // Quote Date & Validity lines
      const metaY = 72;
      doc.fontSize(8).font('Helvetica').fillColor(BRAND_MUTED);
      doc.text(`Quote Date: ${formatDateInd(options.date)}`, rightX, metaY, { width: 210, align: 'right' });
      doc.text(`Valid Until: ${formatDateInd(options.validUntil)}`, rightX, metaY + 11, { width: 210, align: 'right' });
      const statusText = (options.status || 'Draft').toUpperCase();
      doc.text(`Status: ${statusText}`, rightX, metaY + 22, { width: 210, align: 'right' });

      // Horizontal Divider
      doc.strokeColor(BORDER_COLOR).lineWidth(0.75).moveTo(pageMargin, 108).lineTo(doc.page.width - pageMargin, 108).stroke();

      // 3. Two-Column Information Cards: Billed By vs Billed To
      const cardY = 114;
      const cardHeight = 72;
      const cardWidth = (usableWidth - 12) / 2;

      // Card 1: Billed By (Real Media Octus Details)
      doc.roundedRect(pageMargin, cardY, cardWidth, cardHeight, 5).fillAndStroke(CARD_BG, BORDER_COLOR);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(BRAND_BURGUNDY).text('BILLED BY (SUPPLIER)', pageMargin + 10, cardY + 8);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND_DARK).text(seller.companyName, pageMargin + 10, cardY + 20, { width: cardWidth - 20 });
      doc.fontSize(7.5).font('Helvetica').fillColor(BRAND_MUTED);
      doc.text(seller.addressLines.join(', '), pageMargin + 10, cardY + 33, { width: cardWidth - 20 });
      doc.text(`GSTIN: ${seller.gstin} · Email: ${seller.email}`, pageMargin + 10, cardY + 54, { width: cardWidth - 20 });

      // Card 2: Billed To
      const clientCardX = pageMargin + cardWidth + 12;
      doc.roundedRect(clientCardX, cardY, cardWidth, cardHeight, 5).fillAndStroke(CARD_BG, BORDER_COLOR);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(BRAND_BURGUNDY).text('BILLED TO (CLIENT)', clientCardX + 10, cardY + 8);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(BRAND_DARK).text(client.companyName, clientCardX + 10, cardY + 20, { width: cardWidth - 20 });
      doc.fontSize(7.5).font('Helvetica').fillColor(BRAND_MUTED);
      doc.text(`Contact: ${client.contactPerson}`, clientCardX + 10, cardY + 34, { width: cardWidth - 20 });
      doc.text(`Phone: ${client.phone} · Email: ${client.email}`, clientCardX + 10, cardY + 45, { width: cardWidth - 20 });
      const clientLoc = [client.city, client.state].filter(Boolean).join(', ') || client.address;
      doc.text(`Location: ${clientLoc} · GSTIN: ${client.gstin}`, clientCardX + 10, cardY + 56, { width: cardWidth - 20 });

      // 4. Line Items Table (With DISC and TAX columns)
      let tableY = 194;
      const col = {
        idx: { x: pageMargin + 4, w: 16 },
        site: { x: pageMargin + 24, w: 130 },
        dim: { x: pageMargin + 158, w: 66 },
        period: { x: pageMargin + 228, w: 78 },
        days: { x: pageMargin + 310, w: 24 },
        rate: { x: pageMargin + 338, w: 42 },
        disc: { x: pageMargin + 384, w: 34 },
        tax: { x: pageMargin + 422, w: 32 },
        total: { x: pageMargin + 458, w: 60 },
      };

      // Table Header Row
      doc.rect(pageMargin, tableY, usableWidth, 20).fill(BRAND_BURGUNDY);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text('#', col.idx.x, tableY + 5, { width: col.idx.w, align: 'center' });
      doc.text('MEDIA SITE & LOCATION', col.site.x, tableY + 5, { width: col.site.w, align: 'left' });
      doc.text('SIZE / TYPE', col.dim.x, tableY + 5, { width: col.dim.w, align: 'left' });
      doc.text('DISPLAY DURATION', col.period.x, tableY + 5, { width: col.period.w, align: 'center' });
      doc.text('DAYS', col.days.x, tableY + 5, { width: col.days.w, align: 'center' });
      doc.text('RATE/DAY', col.rate.x, tableY + 5, { width: col.rate.w, align: 'right' });
      doc.text('DISC', col.disc.x, tableY + 5, { width: col.disc.w, align: 'center' });
      doc.text('TAX', col.tax.x, tableY + 5, { width: col.tax.w, align: 'center' });
      doc.text('AMOUNT', col.total.x, tableY + 5, { width: col.total.w, align: 'right' });

      tableY += 20;

      // Table Body Rows
      doc.fontSize(8);
      for (const [i, item] of options.items.entries()) {
        const rowHeight = 26;

        // Check if page overflow
        if (tableY + rowHeight > doc.page.height - 180) {
          doc.addPage();
          doc.rect(0, 0, doc.page.width, 5).fill(BRAND_BURGUNDY);
          tableY = 40;

          // Reprint table header on new page
          doc.rect(pageMargin, tableY, usableWidth, 20).fill(BRAND_BURGUNDY);
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#FFFFFF');
          doc.text('#', col.idx.x, tableY + 5, { width: col.idx.w, align: 'center' });
          doc.text('MEDIA SITE & LOCATION', col.site.x, tableY + 5, { width: col.site.w, align: 'left' });
          doc.text('SIZE / TYPE', col.dim.x, tableY + 5, { width: col.dim.w, align: 'left' });
          doc.text('DISPLAY DURATION', col.period.x, tableY + 5, { width: col.period.w, align: 'center' });
          doc.text('DAYS', col.days.x, tableY + 5, { width: col.days.w, align: 'center' });
          doc.text('RATE/DAY', col.rate.x, tableY + 5, { width: col.rate.w, align: 'right' });
          doc.text('DISC', col.disc.x, tableY + 5, { width: col.disc.w, align: 'center' });
          doc.text('TAX', col.tax.x, tableY + 5, { width: col.tax.w, align: 'center' });
          doc.text('AMOUNT', col.total.x, tableY + 5, { width: col.total.w, align: 'right' });
          tableY += 20;
        }

        // Alternating row background
        if (i % 2 === 1) {
          doc.rect(pageMargin, tableY, usableWidth, rowHeight).fill('#FDFBFB');
        }

        // Text cells
        doc.fillColor(BRAND_MUTED).font('Helvetica').text(String(i + 1), col.idx.x, tableY + 7, { width: col.idx.w, align: 'center' });

        // Site details
        const siteTitle = item.siteCode ? `${item.siteCode} - ${item.location || 'OOH Site'}` : (item.location || 'Outdoor Hoarding');
        doc.fillColor(BRAND_DARK).font('Helvetica-Bold').text(siteTitle, col.site.x, tableY + 7, { width: col.site.w, ellipsis: true });

        // Dimensions / Type
        const dimStr = item.dimensions || item.mediaType || 'Standard Display';
        doc.fillColor(BRAND_MUTED).font('Helvetica').text(dimStr, col.dim.x, tableY + 7, { width: col.dim.w, ellipsis: true });

        // Dates
        doc.text(item.dates, col.period.x, tableY + 7, { width: col.period.w, align: 'center' });

        // Days
        doc.text(String(item.days), col.days.x, tableY + 7, { width: col.days.w, align: 'center' });

        // Rate
        const rateFormatted = `Rs. ${(item.ratePerDay / 100).toLocaleString('en-IN')}`;
        doc.text(rateFormatted, col.rate.x, tableY + 7, { width: col.rate.w, align: 'right' });

        // Disc
        const discText = (item.discountPercent !== undefined && item.discountPercent > 0) ? `${item.discountPercent}%` : '-';
        doc.fillColor(item.discountPercent ? '#059669' : BRAND_MUTED).font('Helvetica').text(discText, col.disc.x, tableY + 7, { width: col.disc.w, align: 'center' });

        // Tax
        const taxText = item.taxPercent !== undefined ? `${item.taxPercent}%` : '18%';
        doc.fillColor(BRAND_MUTED).font('Helvetica').text(taxText, col.tax.x, tableY + 7, { width: col.tax.w, align: 'center' });

        // Amount
        const amountFormatted = `Rs. ${(item.amount / 100).toLocaleString('en-IN')}`;
        doc.fillColor(BRAND_DARK).font('Helvetica-Bold').text(amountFormatted, col.total.x, tableY + 7, { width: col.total.w, align: 'right' });

        // Bottom border
        doc.strokeColor(BORDER_COLOR).lineWidth(0.5).moveTo(pageMargin, tableY + rowHeight).lineTo(pageMargin + usableWidth, tableY + rowHeight).stroke();

        tableY += rowHeight;
      }

      // 5. Totals & Terms Section
      let summaryY = tableY + 12;

      // Check if summary fits on page
      if (summaryY + 180 > doc.page.height - 36) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, 5).fill(BRAND_BURGUNDY);
        summaryY = 40;
      }

      const leftBlockWidth = 285;
      const rightBlockWidth = 226;
      const rightBlockX = doc.page.width - pageMargin - rightBlockWidth;

      // Left Box: Bank Details
      doc.roundedRect(pageMargin, summaryY, leftBlockWidth, 76, 5).fillAndStroke(CARD_BG, BORDER_COLOR);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(BRAND_BURGUNDY).text('BANK DETAILS FOR NEFT / RTGS / UPI', pageMargin + 10, summaryY + 8);
      doc.fontSize(7.5).font('Helvetica').fillColor(BRAND_DARK);
      doc.text(`Bank Name: ${bank.bankName} · Branch: ${bank.branch}`, pageMargin + 10, summaryY + 22);
      doc.text(`A/c Name: ${bank.accountName}`, pageMargin + 10, summaryY + 34);
      doc.text(`Account No: ${bank.accountNumber}`, pageMargin + 10, summaryY + 46);
      doc.text(`IFSC Code: ${bank.ifsc} · UPI ID: ${bank.upiId}`, pageMargin + 10, summaryY + 58);

      // Right Box: Totals Summary
      const taxRate = options.pricing.taxRate ?? 0.18;
      const subtotalRupees = options.pricing.subtotal / 100;
      const taxRupees = options.pricing.taxAmount / 100;
      const grandTotalRupees = options.pricing.grandTotal / 100;
      const isInterState = options.pricing.isInterState ?? false;

      let totalsCursor = summaryY;
      doc.fontSize(8.5).font('Helvetica').fillColor(BRAND_MUTED);

      // Gross Total & Discount breakdown (if discount applied)
      const grossRupees = options.pricing.grossTotal ? options.pricing.grossTotal / 100 : 0;
      const discountRupees = options.pricing.discountTotal ? options.pricing.discountTotal / 100 : 0;

      if (discountRupees > 0 && grossRupees > 0) {
        doc.font('Helvetica').fillColor(BRAND_MUTED).text('Gross Total:', rightBlockX, totalsCursor);
        doc.font('Helvetica-Bold').fillColor(BRAND_DARK).text(
          `Rs. ${grossRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          rightBlockX,
          totalsCursor,
          { width: rightBlockWidth, align: 'right' },
        );
        totalsCursor += 13;

        doc.font('Helvetica').fillColor('#059669').text('Total Discount:', rightBlockX, totalsCursor);
        doc.font('Helvetica-Bold').fillColor('#059669').text(
          `- Rs. ${discountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          rightBlockX,
          totalsCursor,
          { width: rightBlockWidth, align: 'right' },
        );
        totalsCursor += 13;
      }

      // Taxable Subtotal
      doc.font('Helvetica').fillColor(BRAND_MUTED).text('Taxable Subtotal:', rightBlockX, totalsCursor);
      doc.font('Helvetica-Bold').fillColor(BRAND_DARK).text(
        `Rs. ${subtotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        rightBlockX,
        totalsCursor,
        { width: rightBlockWidth, align: 'right' },
      );
      totalsCursor += 14;

      // Tax breakdown
      if (!isInterState) {
        const halfTax = (taxRupees / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        doc.font('Helvetica').fillColor(BRAND_MUTED).text(`CGST (${(taxRate * 50).toFixed(0)}%):`, rightBlockX, totalsCursor);
        doc.font('Helvetica').fillColor(BRAND_DARK).text(`Rs. ${halfTax}`, rightBlockX, totalsCursor, { width: rightBlockWidth, align: 'right' });
        totalsCursor += 13;

        doc.font('Helvetica').fillColor(BRAND_MUTED).text(`SGST (${(taxRate * 50).toFixed(0)}%):`, rightBlockX, totalsCursor);
        doc.font('Helvetica').fillColor(BRAND_DARK).text(`Rs. ${halfTax}`, rightBlockX, totalsCursor, { width: rightBlockWidth, align: 'right' });
        totalsCursor += 14;
      } else {
        doc.font('Helvetica').fillColor(BRAND_MUTED).text(`IGST (${(taxRate * 100).toFixed(0)}%):`, rightBlockX, totalsCursor);
        doc.font('Helvetica').fillColor(BRAND_DARK).text(
          `Rs. ${taxRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          rightBlockX,
          totalsCursor,
          { width: rightBlockWidth, align: 'right' },
        );
        totalsCursor += 14;
      }

      // Grand Total Highlight Banner
      doc.roundedRect(rightBlockX, totalsCursor, rightBlockWidth, 24, 4).fill(BRAND_BURGUNDY);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#FFFFFF').text('GRAND TOTAL:', rightBlockX + 10, totalsCursor + 7);
      doc.text(
        `Rs. ${grandTotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        rightBlockX,
        totalsCursor + 7,
        { width: rightBlockWidth - 10, align: 'right' },
      );

      // Amount in Words below totals
      totalsCursor += 28;
      const wordsText = numberToIndianWords(grandTotalRupees);
      doc.fontSize(7).font('Helvetica-Oblique').fillColor(BRAND_MUTED).text(
        wordsText,
        rightBlockX,
        totalsCursor,
        { width: rightBlockWidth, align: 'right' },
      );

      // Terms & Conditions (Left side below bank)
      const termsY = summaryY + 85;
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(BRAND_BURGUNDY).text('TERMS & CONDITIONS:', pageMargin, termsY);
      doc.fontSize(6.5).font('Helvetica').fillColor(BRAND_MUTED);
      let tY = termsY + 11;
      for (const [idx, term] of terms.entries()) {
        doc.text(`${idx + 1}. ${term}`, pageMargin, tY, { width: leftBlockWidth + 10 });
        tY += 10;
      }

      // Authorized Signatory (Right side below words)
      const signY = totalsCursor + 20;
      const signBoxX = rightBlockX + 30;
      const signBoxWidth = rightBlockWidth - 30;
      const signBoxHeight = 52;
      doc.roundedRect(signBoxX, signY, signBoxWidth, signBoxHeight, 4).stroke(BORDER_COLOR);
      doc.fontSize(7).font('Helvetica-Bold').fillColor(BRAND_DARK).text(
        `For ${seller.companyName}`,
        signBoxX,
        signY + 5,
        { width: signBoxWidth, align: 'center' },
      );

      let imageRendered = false;
      if (options.signature?.image) {
        try {
          let sigBuf: Buffer | null = null;
          const sigStr = options.signature.image;
          if (sigStr.startsWith('data:image/')) {
            const base64Data = sigStr.replace(/^data:image\/\w+;base64,/, '');
            sigBuf = Buffer.from(base64Data, 'base64');
          } else if (fs.existsSync(sigStr)) {
            sigBuf = fs.readFileSync(sigStr);
          }
          if (sigBuf) {
            const imgWidth = 72;
            const imgHeight = 24;
            const imgX = signBoxX + (signBoxWidth - imgWidth) / 2;
            const imgY = signY + 14;
            doc.image(sigBuf, imgX, imgY, { fit: [imgWidth, imgHeight], align: 'center' });
            imageRendered = true;
          }
        } catch {
          // ignore error and render text fallback
        }
      }

      const sigName = options.signature?.signatoryName;
      const sigDesignation = options.signature?.signatoryDesignation || 'Authorized Signatory';
      const sigText = sigName ? `${sigName} (${sigDesignation})` : `(${sigDesignation})`;

      doc.fontSize(6.5).font('Helvetica').fillColor(BRAND_LIGHT_MUTED).text(
        sigText,
        signBoxX,
        signY + (imageRendered ? 39 : 36),
        { width: signBoxWidth, align: 'center' },
      );

      // 6. Draw Footer on Every Page
      drawFooterOnEveryPage(doc, seller, pageMargin);

      doc.end();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

