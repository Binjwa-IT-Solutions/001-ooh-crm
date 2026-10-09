import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase, disconnectDatabase } from '../core/db/connect.js';
import { Lead } from '../modules/leads/leads.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Robust CSV parser that handles:
 * - RFC 4180 quotes & multiline fields
 * - Commas inside double quotes
 * - Windows / Unix line endings (\r\n vs \n)
 * - UTF-8 BOM
 */
function parseCSV(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').replace(/^sep=,\r?\n/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuote = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isMediaOctus(val: string): boolean {
  const norm = val.toLowerCase().replace(/[\s-_]/g, '');
  return norm.includes('mediaoctus') || norm.includes('octus');
}

async function run() {
  console.log('====================================================');
  console.log('🚀 Media Octus — Justdial Leads CSV Import Script');
  console.log('====================================================\n');

  // 1. Locate CSV file
  const customPath = process.argv[2];
  const candidatePaths = [
    customPath,
    path.resolve(process.cwd(), 'leads.csv'),
    path.resolve(process.cwd(), 'leads_export.csv'),
    path.resolve(__dirname, '../../../leads.csv'),
    path.resolve(__dirname, '../../../leads_export.csv'),
    path.resolve(__dirname, '../../leads.csv'),
  ].filter(Boolean) as string[];

  let csvPath: string | null = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      csvPath = p;
      break;
    }
  }

  if (!csvPath) {
    console.error('❌ Error: Could not find any CSV file to import.');
    console.error('Please place your leads file at: "leads.csv" in the project root or backend folder,');
    console.error('or pass the path directly: npx tsx src/scripts/import-leads-csv.ts <path-to-file.csv>');
    process.exit(1);
  }

  console.log(`📁 Found CSV file: ${csvPath}`);
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(fileContent);

  if (rows.length < 2) {
    console.error('❌ Error: CSV file is empty or only contains headers.');
    process.exit(1);
  }

  const rawHeaders = rows[0];
  const dataRows = rows.slice(1);
  console.log(`📊 Total rows in CSV: ${dataRows.length}`);

  // 2. Map Column Indexes
  const headerMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    headerMap.set(normalizeHeader(h), idx);
  });

  const getCol = (aliases: string[], row: string[]): string => {
    for (const a of aliases) {
      const idx = headerMap.get(normalizeHeader(a));
      if (idx !== undefined && row[idx] !== undefined) {
        return row[idx].trim();
      }
    }
    return '';
  };

  // 3. Connect Database
  await connectDatabase();

  let importedCount = 0;
  let skippedDuplicateCount = 0;
  let skippedInvalidCount = 0;

  console.log('\n⏳ Processing and importing leads into Unclaimed pool...\n');

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];

    // Extract fields using smart aliases
    const rawCompany = getCol(['Company Name', 'company', 'company_name', 'Company'], row);
    const rawContact = getCol(['Primary Contact Person', 'Contact Person', 'contactPerson', 'name', 'Full Name'], row);
    const rawMobile = getCol(['Mobile', 'mobile', 'phone', 'contactNumber', 'Phone', 'Cell'], row);
    const secondaryContact = getCol(['Secondary Contact Person', 'secondaryContactPerson'], row);
    const secondaryDesignation = getCol(['Secondary Designation', 'secondaryDesignation'], row);
    const secondaryMobile = getCol(['Secondary Mobile', 'secondaryMobile'], row);
    const email = getCol(['Email', 'email', 'E-mail'], row);
    const address = getCol(['Company Address', 'address', 'Address'], row);
    const companyLocation = getCol(['Company Location', 'companyLocation', 'location', 'Area', 'area'], row);
    const city = getCol(['City', 'city', 'brancharea'], row);
    const rawSource = getCol(['Source', 'source'], row) || 'JustDial';
    const rawBudget = getCol(['Budget (INR)', 'budget', 'Budget'], row);
    const locationPref = getCol(['Location Preference', 'locationPreference'], row);
    const duration = getCol(['Campaign Duration', 'campaignDuration'], row);
    const category = getCol(['Category', 'category'], row);
    const createdAtStr = getCol(['Created At', 'createdAt', 'date', 'Lead Time'], row);

    // Clean Mobile Number
    const digitsOnly = rawMobile.replace(/\D/g, '');
    const cleanMobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

    if (!cleanMobile || cleanMobile.length < 10) {
      skippedInvalidCount++;
      continue;
    }

    // Duplicate Check in DB
    const existing = await Lead.findOne({ mobile: cleanMobile, deletedAt: null });
    if (existing) {
      skippedDuplicateCount++;
      continue;
    }

    // Clean Contact Person
    const contactPerson = rawContact || 'Prospective Client';

    // 🌟 Clean Company Name Rule:
    // If company is empty, or equals "Media Octus" / "Mediaoctus", replace with actual Contact Person!
    let finalCompany = rawCompany;
    if (!finalCompany || isMediaOctus(finalCompany)) {
      finalCompany = contactPerson;
    }

    // Format budget to Paise if provided
    let budgetPaise: number | undefined;
    if (rawBudget) {
      const num = parseFloat(rawBudget.replace(/[^0-9.]/g, ''));
      if (!isNaN(num) && num > 0) {
        budgetPaise = Math.round(num * 100);
      }
    }

    // Format Created Date if present
    let receivedDate = new Date();
    if (createdAtStr) {
      const parsedD = new Date(createdAtStr);
      if (!isNaN(parsedD.getTime())) {
        receivedDate = parsedD;
      }
    }

    // Insert into Unclaimed pool
    await Lead.create({
      companyName: finalCompany,
      contactPerson,
      mobile: cleanMobile,
      secondaryContactPerson: secondaryContact || undefined,
      secondaryDesignation: secondaryDesignation || undefined,
      secondaryMobile: secondaryMobile ? secondaryMobile.replace(/\D/g, '').slice(-10) : undefined,
      email: email ? email.toLowerCase() : undefined,
      companyAddress: address || undefined,
      companyLocation: companyLocation || undefined,
      city: city || undefined,
      source: 'JustDial',
      status: 'New',
      assignedTo: null,
      claimedBy: null,
      claimedAt: null,
      slaTimerEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
      receivedAt: receivedDate,
      qualification: {
        city: city || undefined,
        budget: budgetPaise,
        locationPreference: locationPref ? (locationPref as any) : undefined,
        campaignDuration: duration || undefined,
        notes: category ? `Category: ${category}` : undefined,
      },
      statusHistory: [
        {
          to: 'New',
          reason: 'Imported via CSV migration script',
          changedAt: receivedDate,
        },
      ],
    });

    importedCount++;
    if (importedCount % 50 === 0 || importedCount === dataRows.length) {
      process.stdout.write(`  ⏳ Progress: ${importedCount} leads imported...\r`);
    }
  }

  await disconnectDatabase();

  console.log('\n\n====================================================');
  console.log('🎉 Import Summary:');
  console.log(`  ✅ Successfully Imported: ${importedCount} leads`);
  console.log(`  ⏭️  Skipped Duplicates:    ${skippedDuplicateCount} leads`);
  console.log(`  ⚠️  Skipped (Invalid No):  ${skippedInvalidCount} leads`);
  console.log('====================================================');
  console.log('All imported leads are now active in the "Unclaimed Leads" pool with clean company names!');
}

run().catch(async (err) => {
  console.error('\n❌ Import script failed:', err);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
