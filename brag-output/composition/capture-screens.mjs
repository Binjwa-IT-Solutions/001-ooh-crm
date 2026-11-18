import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from '../../backend/node_modules/mongoose/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screensDir = path.join(__dirname, 'assets', 'screens');

async function run() {
  console.log('[capture] Connecting to MongoDB...');
  await mongoose.connect('mongodb://127.0.0.1:27017/media-octus-crm');
  console.log('[capture] Connected to DB.');

  // Auto-approver interval in background
  const approverInterval = setInterval(async () => {
    try {
      const res = await mongoose.connection.collection('loginapprovals').updateMany(
        { status: 'pending' },
        { $set: { status: 'approved', decidedAt: new Date() } }
      );
      if (res.modifiedCount > 0) {
        console.log(`[auto-approver] Auto-approved ${res.modifiedCount} login request(s)`);
      }
    } catch (e) {
      // ignore
    }
  }, 1000);

  console.log('[capture] Launching Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  try {
    console.log('[capture] Navigating to http://localhost:3000/login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screensDir, 'screen-login.png') });
    console.log('✓ Captured screen-login.png');

    console.log('[capture] Entering credentials...');
    await page.type('input[type="email"]', 'admin@mediaoctus.test');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    console.log('[capture] Waiting for approval or OTP...');
    // Wait up to 10 seconds for the approval to register and auto-approver to approve it
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      // Check if we reached OTP step
      const otpInput = await page.$('#otp-input-0');
      if (otpInput) {
        console.log('[capture] Reached OTP screen!');
        break;
      }
    }

    // Check if OTP needs to be typed
    const otpInput = await page.$('#otp-input-0');
    if (otpInput) {
      // Find latest otp challenge in DB
      const challenge = await mongoose.connection.collection('otpchallenges')
        .find({ email: 'admin@mediaoctus.test', consumedAt: null })
        .sort({ createdAt: -1 })
        .limit(1)
        .next();

      if (challenge && challenge.code) {
        console.log('[capture] Found OTP code in DB:', challenge.code);
        for (let idx = 0; idx < challenge.code.length; idx++) {
          await page.type(`#otp-input-${idx}`, challenge.code[idx]);
        }
      } else {
        console.log('[capture] Checking for dev autofill button...');
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const txt = await page.evaluate(el => el.textContent, btn);
          if (txt && (txt.includes('Verify') || txt.includes('Sign in') || txt.includes('Fill'))) {
            await btn.click();
            break;
          }
        }
      }

      const verifyBtn = await page.$('button[type="submit"]');
      if (verifyBtn) {
        await verifyBtn.click();
        console.log('[capture] Clicked verify button.');
      }
    }

    console.log('[capture] Waiting for dashboard navigation...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3500));

    // If still not on dashboard, try direct goto
    if (!page.url().includes('dashboard')) {
      console.log('[capture] Navigating directly to /dashboard...');
      await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
    }

    console.log('[capture] On page:', page.url());
    await page.screenshot({ path: path.join(screensDir, 'screen-dashboard.png') });
    console.log('✓ Captured screen-dashboard.png');

    // Sites / Billboard Inventory
    console.log('[capture] Navigating to /sites...');
    await page.goto('http://localhost:3000/sites', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(screensDir, 'screen-sites.png') });
    console.log('✓ Captured screen-sites.png');

    // Quotations
    console.log('[capture] Navigating to /quotations...');
    await page.goto('http://localhost:3000/quotations', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(screensDir, 'screen-quotations.png') });
    console.log('✓ Captured screen-quotations.png');

    // Campaigns
    console.log('[capture] Navigating to /campaigns...');
    await page.goto('http://localhost:3000/campaigns', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(screensDir, 'screen-campaigns.png') });
    console.log('✓ Captured screen-campaigns.png');

    // Proofs
    console.log('[capture] Navigating to /proofs...');
    await page.goto('http://localhost:3000/proofs', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(screensDir, 'screen-proofs.png') });
    console.log('✓ Captured screen-proofs.png');

  } catch (err) {
    console.error('[capture] Error:', err);
  } finally {
    clearInterval(approverInterval);
    await browser.close();
    await mongoose.disconnect();
    console.log('[capture] Done!');
  }
}

run();
