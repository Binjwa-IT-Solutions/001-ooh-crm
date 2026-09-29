import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { Site } from '../modules/sites/site.model.js';
import Campaign from '../modules/campaigns/campaign.model.js';

/**
 * Fix campaign by adding a valid site
 */
async function fixCampaign() {
  await mongoose.connect(config.mongoUri);

  try {
    console.log('\n📍 Fetching all valid sites...\n');

    // Get all valid sites
    const sites = await Site.find().select('_id code city type').lean();

    if (sites.length === 0) {
      console.log('❌ No sites found in database!');
      console.log('Please create a site first before creating campaigns.\n');
      return;
    }

    console.log('✅ Available sites:\n');
    sites.forEach((site: any, idx) => {
      console.log(`  ${idx + 1}. ${site.mediaPlanNo || site.code} - ${site.city} (${site.mediaType || site.type})`);
      console.log(`     ID: ${site._id}`);
    });

    // Get the first site
    const firstSite: any = sites[0];
    console.log(
      `\n🔧 Fixing campaign MO-C-2026-0001 with site: ${firstSite.mediaPlanNo || firstSite.code}...\n`,
    );

    // Update the campaign
    const result = await Campaign.updateOne(
      { campaignCode: 'MO-C-2026-0001' },
      { siteIds: [firstSite._id] },
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Campaign fixed successfully!');
      console.log(`   Site added: ${firstSite.mediaPlanNo || firstSite.code} (${firstSite.city})\n`);
    } else {
      console.log('⚠️  Campaign not found or already up to date.\n');
    }
  } finally {
    await mongoose.connection.close();
  }
}

fixCampaign().catch((err) => {
  console.error('❌ Failed to fix campaign:', err.message);
  process.exit(1);
});
