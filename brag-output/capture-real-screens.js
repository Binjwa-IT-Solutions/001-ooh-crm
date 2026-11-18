const puppeteer = require('puppeteer');
const jwt = require('jsonwebtoken');

const JWT_SECRET = '4b080b13ca1f6e3c461f65a2afd347891b3e5f4db23db6315a29482acab8b896229b1329c5b1d49395e38a85b3eb0433';

const userPayload = {
  id: "6aca059595b3189512c96ba9",
  name: "Director",
  email: "director@mediaoctus.com",
  role: "admin",
  status: "Active",
  mfaEnabled: true,
  permissions: [
    "users.view","users.create","users.update","leads.view","leads.create","leads.claim","leads.update","leads.assign","leads.log_call",
    "quotations.view","quotations.create","quotations.update","sites.view","sites.manage","bookings.view","bookings.manage","vendors.view",
    "vendors.manage","purchase_orders.view","purchase_orders.manage","campaigns.view","campaigns.manage","tasks.view","tasks.manage",
    "proofs.view","proofs.upload","proofs.approve","finance.view","finance.manage","finance.bank_details","finance.create_payment_in",
    "finance.create_payment_out","finance.view_payments","finance.update_payment","finance.delete_payment","finance.reconcile_payment",
    "finance.view_reports","finance.view_leadership_reports","employees.view","employees.manage","employees.self","employees.sensitive",
    "attendance.self","attendance.view_team","leave.self","leave.manage","holiday.manage","reports.view","candidates.view","candidates.manage",
    "salary.view","salary.create","salary.update","payroll.view","payroll.create","payroll.process","payroll.payslip","audit.view"
  ],
  lastLoginAt: "2026-10-22T06:05:44.589Z",
  createdAt: "2026-10-10T09:29:57.646Z",
  phone: "9140958414",
  designation: "Director",
  gender: null,
  reportingManager: null,
  reportingManagerId: null,
  isProfileComplete: true,
  needsSelfProfile: false,
  employeeId: "6acf22468e3a0fa2140f175d"
};

const token = jwt.sign(
  {
    sub: userPayload.id,
    email: userPayload.email,
    name: userPayload.name,
    role: userPayload.role
  },
  JWT_SECRET,
  { expiresIn: '7d' }
);

async function capture() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1.5 });

  // 1. Visit root to establish domain
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });

  // 2. Inject localStorage and sessionStorage credentials
  await page.evaluate((t, u) => {
    localStorage.setItem('mo.accessToken', t);
    localStorage.setItem('mo.refreshToken', 'mock-refresh-token');
    localStorage.setItem('mo.user', JSON.stringify(u));
    sessionStorage.setItem('mo.profilePromptSkipped.' + u.id, '1');
    sessionStorage.setItem('mo.profilePromptSkipped.6aca059595b3189512c96ba9', '1');
  }, token, userPayload);

  console.log('Injected credentials into localStorage and sessionStorage');

  const targets = [
    { url: 'http://localhost:3000/dashboard', filename: 'composition/assets/screens/screen-dashboard.png', name: 'Dashboard' },
    { url: 'http://localhost:3000/sites', filename: 'composition/assets/screens/screen-sites.png', name: 'Sites / Billboard Inventory' },
    { url: 'http://localhost:3000/quotations', filename: 'composition/assets/screens/screen-quotations.png', name: 'Quotations & Proposals' },
    { url: 'http://localhost:3000/campaigns', filename: 'composition/assets/screens/screen-campaigns.png', name: 'Campaign Execution' },
    { url: 'http://localhost:3000/proofs', filename: 'composition/assets/screens/screen-proofs.png', name: 'Proof of Display' }
  ];

  for (const t of targets) {
    console.log(`Navigating to ${t.name}: ${t.url}`);
    await page.goto(t.url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check if modal exists and dismiss or remove from DOM
    await page.evaluate(() => {
      const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Skip for now'));
      if (skipBtn) {
        skipBtn.click();
      }
      const modal = document.querySelector('[role="dialog"]');
      if (modal) {
        modal.remove();
      }
      const backdrop = document.querySelector('.bg-slate-950\\/70');
      if (backdrop) {
        backdrop.remove();
      }
    });

    // Allow data fetch and UI animations to complete
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: t.filename });
    console.log(`Saved ${t.filename}`);
  }

  await browser.close();
  console.log('Finished capturing all real platform screenshots!');
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
