import assert from 'node:assert/strict';
import test from 'node:test';

import { Lead } from './leads.model.js';
import { LeadsService } from './leads.service.js';
import { leadQualificationSchema, listLeadsSchema, uploadLeadDocumentSchema } from './leads.validator.js';

const FAKE_USER_CTX = { user: { id: '64b7f9a1c2d3e4f5a6b7c8d9', role: 'sales' } } as any;

function withPatchedModel(patches: Partial<typeof Lead>, fn: () => Promise<void>) {
  const originals: Partial<Record<string, any>> = {};
  for (const k of Object.keys(patches)) {
    // @ts-expect-error testing mock
    originals[k] = (Lead as any)[k];
    // @ts-expect-error testing mock
    (Lead as any)[k] = (patches as any)[k];
  }

  return fn().finally(() => {
    for (const k of Object.keys(patches)) {
      // @ts-expect-error testing mock
      (Lead as any)[k] = originals[k];
    }
  });
}

test('same source + same mobile within 24h -> duplicate', async () => {
  const now = new Date();
  const previous = { mobile: '9998887776', source: 'Website', createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000) };

  await withPatchedModel(
    {
      findOne: (query: any) => {
        if (
          query.mobile === previous.mobile &&
          query.source === previous.source &&
          previous.createdAt >= query.createdAt.$gte
        ) {
          return { exec: async () => previous };
        }
        return { exec: async () => null };
      },
      create: async (payload: any) => payload,
    },
    async () => {
      const data = { companyName: 'X', contactPerson: 'Y', mobile: previous.mobile, city: 'Mumbai', source: previous.source };
      const created = await LeadsService.createLead(data, FAKE_USER_CTX);
      assert.equal(created.status, 'Duplicate');
      assert.ok(created.receivedAt instanceof Date, 'receivedAt should be a Date');
    },
  );
});

test('same source + same mobile after 24h -> New', async () => {
  await withPatchedModel(
    {
      findOne: () => ({ exec: async () => null }),
      create: async (payload: any) => payload,
    },
    async () => {
      const data = { companyName: 'A', contactPerson: 'B', mobile: '9998887775', city: 'Delhi', source: 'Website' };
      const created = await LeadsService.createLead(data, FAKE_USER_CTX);
      assert.equal(created.status, 'New');
      assert.ok(created.receivedAt instanceof Date, 'receivedAt should be a Date');
    },
  );
});

test('status transition map rejects invalid jump (New -> Won)', async () => {
  const mockLead: any = {
    _id: '64b7f9a1c2d3e4f5a6b7c8d9',
    status: 'New',
    save: async function () { return this; },
    populate: async function () { return this; },
  };

  await withPatchedModel(
    {
      findOne: () => ({
        populate: async () => mockLead,
        exec: async () => mockLead,
      }),
    },
    async () => {
      const origGetLead = LeadsService.getLead;
      LeadsService.getLead = async () => mockLead;
      try {
        let thrown = false;
        try {
          await LeadsService.changeStatus('64b7f9a1c2d3e4f5a6b7c8d9', { status: 'Won' }, FAKE_USER_CTX);
        } catch (err: any) {
          thrown = true;
          assert.ok(/Invalid status transition/.test(err.message));
        }
        assert.ok(thrown, 'Expected invalid status transition error');
      } finally {
        LeadsService.getLead = origGetLead;
      }
    },
  );
});

test('moving to Qualified requires budget, city and campaignDuration', async () => {
  const mockLead: any = {
    _id: '64b7f9a1c2d3e4f5a6b7c8d9',
    status: 'Interested',
    city: '',
    qualification: { city: '', budget: undefined, campaignDuration: '' },
    save: async function () { return this; },
    populate: async function () { return this; },
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => mockLead;
  try {
    let thrown = false;
    try {
      await LeadsService.changeStatus('64b7f9a1c2d3e4f5a6b7c8d9', { status: 'Qualified' }, FAKE_USER_CTX);
    } catch (err: any) {
      thrown = true;
      assert.ok(/budget, city and duration/.test(err.message));
    }
    assert.ok(thrown, 'Expected qualification gate error');
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('moving to Lost requires a lostReason', async () => {
  const mockLead: any = {
    _id: '64b7f9a1c2d3e4f5a6b7c8d9',
    status: 'Contacted',
    qualification: {},
    save: async function () { return this; },
    populate: async function () { return this; },
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => mockLead;
  try {
    let thrown = false;
    try {
      await LeadsService.changeStatus('64b7f9a1c2d3e4f5a6b7c8d9', { status: 'Lost', lostReason: '' }, FAKE_USER_CTX);
    } catch (err: any) {
      thrown = true;
      assert.ok(/reason/.test(err.message));
    }
    assert.ok(thrown, 'Expected lostReason validation error');
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('budget in Rupees converts to integer Paise at boundary', () => {
  const parsed = leadQualificationSchema.parse({
    budget: 1500.5,
  });
  assert.equal(parsed.budget, 150050);
});

test('logFollowUpLead records followUpType, reason, and nextActionDate', async () => {
  const nextDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const mockLead: any = {
    _id: '64b7f9a1c2d3e4f5a6b7c8d9',
    status: 'Contacted',
    callLogs: [],
    save: async function () { return this; },
    populate: async function () { return this; },
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => mockLead;
  try {
    const updated = await LeadsService.logFollowUpLead(
      '64b7f9a1c2d3e4f5a6b7c8d9',
      {
        followUpType: 'Meeting',
        reason: 'Quotation Review',
        remarks: 'Met with client in Bandra office',
        nextActionDate: nextDate,
      },
      FAKE_USER_CTX,
    );

    assert.equal(updated.callLogs.length, 1);
    assert.equal(updated.callLogs[0].followUpType, 'Meeting');
    assert.equal(updated.callLogs[0].reason, 'Quotation Review');
    assert.equal(updated.callLogs[0].remarks, 'Met with client in Bandra office');
    assert.equal(updated.nextActionDate, nextDate);
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('logFollowUpLead auto-clears nextActionDate when empty or omitted (Option 1)', async () => {
  const oldPastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const mockLead: any = {
    _id: '64b7f9a1c2d3e4f5a6b7c8d9',
    status: 'Contacted',
    nextActionDate: oldPastDate,
    callLogs: [],
    save: async function () { return this; },
    populate: async function () { return this; },
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => mockLead;
  try {
    const updated = await LeadsService.logFollowUpLead(
      '64b7f9a1c2d3e4f5a6b7c8d9',
      {
        followUpType: 'Call',
        reason: 'General Follow-up',
        remarks: 'Client spoke, no immediate next action scheduled',
        // nextActionDate omitted
      },
      FAKE_USER_CTX,
    );

    assert.equal(updated.callLogs.length, 1);
    assert.equal(updated.nextActionDate, null);
    assert.equal(updated.callLogs[0].nextActionDate, null);
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('managerApproveLead records approval and remarks', async () => {
  const mockLead: any = {
    _id: '64b7f9a1c2d3e4f5a6b7c8d9',
    status: 'Interested',
    statusHistory: [],
    save: async function () { return this; },
    populate: async function () { return this; },
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => mockLead;
  try {
    const updated = await LeadsService.managerApproveLead(
      '64b7f9a1c2d3e4f5a6b7c8d9',
      {
        approved: true,
        remarks: 'Approved for proposal discount',
      },
      FAKE_USER_CTX,
    );

    assert.equal(updated.managerApproval.approved, true);
    assert.equal(updated.managerApproval.remarks, 'Approved for proposal discount');
    assert.ok(updated.managerApproval.approvedAt instanceof Date);
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('intakeLead parses and sanitizes JustDial payload and starts SLA', async () => {
  await withPatchedModel(
    {
      findOne: () => ({ exec: async () => null }),
      create: async (payload: any) => payload,
    },
    async () => {
      const jdPayload = {
        leadid: 'JD-2026-984210',
        lead_type: 'FRESH',
        name: 'Amitabh Sharma',
        mobile: '+91 98260-12345',
        email: 'AMITABH@GMAIL.COM',
        category: 'Outdoor Hoarding Advertising',
        city: 'Indore',
        area: 'Vijay Nagar',
        pincode: '452010',
      };

      const created: any = await LeadsService.intakeLead('JustDial', jdPayload);

      assert.equal(created.status, 'New');
      assert.equal(created.source, 'JustDial');
      assert.equal(created.mobile, '9826012345'); // Sanitized to 10 digits
      assert.equal(created.contactPerson, 'Amitabh Sharma');
      assert.equal(created.companyName, 'Amitabh Sharma');
      assert.equal(created.email, 'amitabh@gmail.com');
      assert.equal(created.city, 'Indore');
      assert.ok(created.qualification?.notes?.includes('JD Lead ID: JD-2026-984210'));
      assert.ok(created.qualification?.notes?.includes('Category: Outdoor Hoarding Advertising'));
      assert.ok(created.qualification?.notes?.includes('Area: Vijay Nagar'));
      assert.ok(created.slaTimerEnd instanceof Date, '24h SLA timer should be set');
      assert.deepEqual(created.rawPayload, jdPayload);
    },
  );
});

test('intakeLead detects duplicate JustDial lead within 24h', async () => {
  const now = new Date();
  const previous = {
    mobile: '9826012345',
    source: 'JustDial',
    createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
  };

  await withPatchedModel(
    {
      findOne: (query: any) => {
        if (
          query.mobile === previous.mobile &&
          query.source === previous.source &&
          previous.createdAt >= query.createdAt.$gte
        ) {
          return { exec: async () => previous };
        }
        return { exec: async () => null };
      },
      create: async (payload: any) => payload,
    },
    async () => {
      const jdPayload = {
        leadid: 'JD-2026-999999',
        name: 'Amitabh Sharma',
        mobile: '9826012345',
        category: 'Billboard',
      };

      const created: any = await LeadsService.intakeLead('JustDial', jdPayload);

      assert.equal(created.status, 'Duplicate');
      assert.equal(created.source, 'JustDial');
      assert.equal(created.slaTimerEnd, undefined, 'Duplicate lead should not start SLA');
      assert.equal(created.statusHistory[0].reason, 'Duplicate within 24h');
    },
  );
});

test('intakeLead parses structured email payload and starts SLA', async () => {
  await withPatchedModel(
    {
      findOne: () => ({ exec: async () => null }),
      create: async (payload: any) => payload,
    },
    async () => {
      const emailPayload = {
        from: 'Web Inquiries <noreply@mediaoctus.com>',
        subject: 'New Website Inquiry',
        text: 'Name: Rajesh Agrawal\nPhone: +91 98930 11223\nCity: Bhopal\nMessage: Need hoarding on MP Nagar',
      };

      const created: any = await LeadsService.intakeLead('Email', emailPayload);

      assert.equal(created.status, 'New');
      assert.equal(created.source, 'Email');
      assert.equal(created.contactPerson, 'Rajesh Agrawal');
      assert.equal(created.mobile, '9893011223');
      assert.equal(created.city, 'Bhopal');
      assert.ok(created.qualification?.notes?.includes('Need hoarding on MP Nagar'));
      assert.ok(created.slaTimerEnd instanceof Date, 'SLA timer must be activated');
    },
  );
});

test('intakeLead parses unstructured free-text email and extracts phone via regex', async () => {
  await withPatchedModel(
    {
      findOne: () => ({ exec: async () => null }),
      create: async (payload: any) => payload,
    },
    async () => {
      const emailPayload = {
        from: 'Pooja Mehta <pooja.mehta@gmail.com>',
        subject: 'Rate card inquiry',
        text: 'Hello team, please share quotation for billboards on Ring Road. You can reach me at 9826198765.',
      };

      const created: any = await LeadsService.intakeLead('Email', emailPayload);

      assert.equal(created.status, 'New');
      assert.equal(created.source, 'Email');
      assert.equal(created.contactPerson, 'Pooja Mehta');
      assert.equal(created.email, 'pooja.mehta@gmail.com');
      assert.equal(created.mobile, '9826198765');
      assert.ok(created.qualification?.notes?.includes('Rate card inquiry'));
      assert.ok(created.slaTimerEnd instanceof Date);
    },
  );
});

test('intakeLead parses website payload with separate firstName, lastName and comments', async () => {
  await withPatchedModel(
    {
      findOne: () => ({ exec: async () => null }),
      create: async (payload: any) => payload,
    },
    async () => {
      const webPayload = {
        firstName: 'Rohan',
        lastName: 'Patel',
        phone: '+91 98250 12345',
        email: 'rohan.patel@example.com',
        comments: 'Need 3 hoardings on SG Highway for 1 month',
      };

      const created: any = await LeadsService.intakeLead('Website', webPayload);

      assert.equal(created.status, 'New');
      assert.equal(created.source, 'Website');
      assert.equal(created.contactPerson, 'Rohan Patel');
      assert.equal(created.mobile, '9825012345');
      assert.equal(created.email, 'rohan.patel@example.com');
      assert.equal(created.qualification?.notes, 'Need 3 hoardings on SG Highway for 1 month');
      assert.ok(created.slaTimerEnd instanceof Date);
    },
  );
});

test('changeStatus transitions New lead to Rejected and records reason', async () => {
  const fakeLead: any = {
    _id: '6a87e4b4c93947ba317108aa',
    status: 'New',
    statusHistory: [],
    save: async () => fakeLead,
    populate: async () => fakeLead,
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => fakeLead;

  try {
    const res = await LeadsService.changeStatus(
      '6a87e4b4c93947ba317108aa',
      { status: 'Rejected', lostReason: 'Spam / Fake Number' },
      { user: { id: '6a87e4b4c93947ba31710801', role: 'sales_agent' } } as any,
    );

    assert.equal(res.status, 'Rejected');
    assert.equal(res.statusHistory[0].to, 'Rejected');
    assert.equal(res.statusHistory[0].reason, 'Spam / Fake Number');
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('changeStatus allows restoring Rejected lead back to New and clears assignedTo', async () => {
  const fakeLead: any = {
    _id: '6a87e4b4c93947ba317108aa',
    status: 'Rejected',
    assignedTo: '6a87e4b4c93947ba31710802',
    claimedBy: '6a87e4b4c93947ba31710802',
    statusHistory: [],
    save: async () => fakeLead,
    populate: async () => fakeLead,
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => fakeLead;

  try {
    const res = await LeadsService.changeStatus(
      '6a87e4b4c93947ba317108aa',
      { status: 'New' },
      { user: { id: '6a87e4b4c93947ba31710801', role: 'sales_agent' } } as any,
    );

    assert.equal(res.status, 'New');
    assert.equal(res.assignedTo, undefined);
    assert.equal(res.claimedBy, undefined);
    assert.equal(res.statusHistory[0].to, 'New');
    assert.equal(res.statusHistory[0].reason, 'Restored to Unclaimed pool');
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('changeStatus auto-clears nextActionDate when transitioning to terminal status (Won, Lost, Rejected)', async () => {
  const fakeLead: any = {
    _id: '6a87e4b4c93947ba317108aa',
    status: 'Negotiation',
    nextActionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    statusHistory: [],
    save: async () => fakeLead,
    populate: async () => fakeLead,
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => fakeLead;

  try {
    const resWon = await LeadsService.changeStatus(
      '6a87e4b4c93947ba317108aa',
      { status: 'Won' },
      { user: { id: '6a87e4b4c93947ba31710801', role: 'admin' } } as any,
    );
    assert.equal(resWon.status, 'Won');
    assert.equal(resWon.nextActionDate, null);

    fakeLead.status = 'Interested';
    fakeLead.nextActionDate = new Date();
    const resLost = await LeadsService.changeStatus(
      '6a87e4b4c93947ba317108aa',
      { status: 'Lost', lostReason: 'Budget mismatch' },
      { user: { id: '6a87e4b4c93947ba31710801', role: 'admin' } } as any,
    );
    assert.equal(resLost.status, 'Lost');
    assert.equal(resLost.nextActionDate, null);
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('changeStatus allows Contacted -> Rejected and records firstResponseAt on Contacted', async () => {
  const fakeLead: any = {
    _id: '6a87e4b4c93947ba317108aa',
    status: 'New',
    firstResponseAt: null,
    statusHistory: [],
    save: async () => fakeLead,
    populate: async () => fakeLead,
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => fakeLead;

  try {
    const resContacted = await LeadsService.changeStatus(
      '6a87e4b4c93947ba317108aa',
      { status: 'Contacted' },
      { user: { id: '6a87e4b4c93947ba31710801', role: 'sales_agent' } } as any,
    );
    assert.equal(resContacted.status, 'Contacted');
    assert.ok(resContacted.firstResponseAt instanceof Date, 'firstResponseAt should be set on Contacted');

    const resRejected = await LeadsService.changeStatus(
      '6a87e4b4c93947ba317108aa',
      { status: 'Rejected', lostReason: 'Wrong number/junk inquiry' },
      { user: { id: '6a87e4b4c93947ba31710801', role: 'sales_agent' } } as any,
    );
    assert.equal(resRejected.status, 'Rejected');
    assert.equal(resRejected.qualification?.lostReason, 'Wrong number/junk inquiry');
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('createLead normalizes formatted mobile number to clean 10-digits for duplicate detection', async () => {
  const now = new Date();
  const previous = { mobile: '9876543210', source: 'Manual', createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) };

  await withPatchedModel(
    {
      findOne: (query: any) => {
        if (query.mobile === '9876543210' && query.source === 'Manual') {
          return { exec: async () => previous };
        }
        return { exec: async () => null };
      },
      create: async (payload: any) => payload,
    },
    async () => {
      const data = {
        companyName: 'New Brand',
        contactPerson: 'Varun',
        mobile: '+91 98765 43210', // formatted with country code and spaces
        source: 'Manual',
      };
      const created = await LeadsService.createLead(data, FAKE_USER_CTX);
      assert.equal(created.status, 'Duplicate');
      assert.equal(data.mobile, '9876543210', 'mobile should be normalized to 10 digits');
    },
  );
});

test('getActivity returns combined chronological activities with follow-up logs', async () => {
  const fakeLead: any = {
    _id: '6a87e4b4c93947ba317108aa',
    status: 'Contacted',
    statusHistory: [
      { from: 'New', to: 'Contacted', changedAt: new Date('2026-09-10T10:00:00Z'), reason: 'First Call' },
    ],
    callLogs: [
      { followUpType: 'Call', remarks: 'Client requested proposal', createdAt: new Date('2026-09-11T10:00:00Z') },
    ],
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => fakeLead;

  try {
    const res = await LeadsService.getActivity(
      '6a87e4b4c93947ba317108aa',
      { user: { id: '6a87e4b4c93947ba31710801', role: 'admin' } } as any,
    );

    assert(Array.isArray(res.activities));
    assert(res.activities.length >= 2);
    assert.equal(res.activities[0].type, 'follow_up');
    assert.equal(res.activities[0].remarks, 'Client requested proposal');
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('createLead supports secondary concern person, designations, and company address/location', async () => {
  await withPatchedModel(
    {
      findOne: () => ({ exec: async () => null }),
      create: async (payload: any) => payload,
    },
    async () => {
      const data = {
        source: 'Manual' as const,
        companyName: 'Acme Corp Pvt Ltd',
        companyAddress: 'Tower B, 7th Floor, Cyber City',
        companyLocation: 'DLF Phase 2',
        city: 'Gurugram',
        contactPerson: 'Vikram Malhotra',
        designation: 'VP Marketing',
        mobile: '9811122233',
        secondaryContactPerson: 'Ritu Sharma',
        secondaryDesignation: 'Media Planner',
        secondaryMobile: '9811144455',
      };

      const created: any = await LeadsService.createLead(data, FAKE_USER_CTX);

      assert.equal(created.companyName, 'Acme Corp Pvt Ltd');
      assert.equal(created.companyAddress, 'Tower B, 7th Floor, Cyber City');
      assert.equal(created.companyLocation, 'DLF Phase 2');
      assert.equal(created.city, 'Gurugram');
      assert.equal(created.contactPerson, 'Vikram Malhotra');
      assert.equal(created.designation, 'VP Marketing');
      assert.equal(created.mobile, '9811122233');
      assert.equal(created.secondaryContactPerson, 'Ritu Sharma');
      assert.equal(created.secondaryDesignation, 'Media Planner');
      assert.equal(created.secondaryMobile, '9811144455');
      assert.equal(created.status, 'New');
    },
  );
});

test('logFollowUpLead records contactedPerson and updates lead profile fields during call', async () => {
  const fakeLead: any = {
    _id: '6a87e4b4c93947ba317108bb',
    status: 'Contacted',
    contactPerson: 'Samyak Jain',
    mobile: '9876543210',
    callLogs: [],
    qualification: {},
    save: async () => fakeLead,
    populate: async () => fakeLead,
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => fakeLead;

  try {
    const res = await LeadsService.logFollowUpLead(
      '6a87e4b4c93947ba317108bb',
      {
        followUpType: 'Call',
        contactedPerson: 'Samyak Jain (Marketing Director)',
        remarks: 'Client agreed to 3-month campaign on Ring Road',
        budget: 45000000,
        email: 'samyak@client.com',
        companyAddress: 'Suite 402, Trade Tower',
        companyLocation: 'BKC',
        secondaryContactPerson: 'Amit Verma',
        secondaryDesignation: 'Media Planner',
        secondaryMobile: '9123456789',
      },
      FAKE_USER_CTX,
    );

    assert.equal(res.callLogs?.length, 1);
    assert.equal(res.callLogs?.[0].contactedPerson, 'Samyak Jain (Marketing Director)');
    assert.equal(res.qualification?.budget, 45000000);
    assert.equal(res.email, 'samyak@client.com');
    assert.equal(res.companyAddress, 'Suite 402, Trade Tower');
    assert.equal(res.companyLocation, 'BKC');
    assert.equal(res.secondaryContactPerson, 'Amit Verma');
    assert.equal(res.secondaryDesignation, 'Media Planner');
    assert.equal(res.secondaryMobile, '9123456789');
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('logFollowUpLead validates loggedAt cannot exceed 1 day past or be in future', async () => {
  const fakeLead: any = {
    _id: '6a87e4b4c93947ba317108bb',
    status: 'New',
    contactPerson: 'Rahul Roy',
    callLogs: [],
    save: async () => fakeLead,
    populate: async () => fakeLead,
  };

  const origGetLead = LeadsService.getLead;
  LeadsService.getLead = async () => fakeLead;

  try {
    // 1. Valid backdate (start of yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(14, 0, 0, 0);

    const res = await LeadsService.logFollowUpLead(
      '6a87e4b4c93947ba317108bb',
      {
        followUpType: 'Call',
        reason: 'Initial Connect',
        remarks: 'Spoke with Rahul',
        loggedAt: yesterday,
      },
      FAKE_USER_CTX,
    );

    assert.equal(res.callLogs?.length, 1);
    assert.equal(res.callLogs?.[0].createdAt.getTime(), yesterday.getTime());
    assert.equal(res.firstResponseAt?.getTime(), yesterday.getTime());

    // 2. Future date should be rejected
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await assert.rejects(
      async () => {
        await LeadsService.logFollowUpLead(
          '6a87e4b4c93947ba317108bb',
          {
            followUpType: 'Call',
            reason: 'Future test',
            remarks: 'Should fail',
            loggedAt: futureDate,
          },
          FAKE_USER_CTX,
        );
      },
      /cannot be in the future/i,
    );

    // 3. Older than 1 day (e.g. 3 days ago) should be rejected
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    await assert.rejects(
      async () => {
        await LeadsService.logFollowUpLead(
          '6a87e4b4c93947ba317108bb',
          {
            followUpType: 'Call',
            reason: 'Old test',
            remarks: 'Should fail',
            loggedAt: threeDaysAgo,
          },
          FAKE_USER_CTX,
        );
      },
      /cannot be backdated more than 1 day/i,
    );
  } finally {
    LeadsService.getLead = origGetLead;
  }
});

test('listLeadsSchema validates overdueOnly, sortBy, and sortDir', () => {
  const parsed = listLeadsSchema.parse({
    overdueOnly: 'true',
    sortBy: 'nextActionDate',
    sortDir: 'asc',
  });
  assert.equal(parsed.overdueOnly, true);
  assert.equal(parsed.sortBy, 'nextActionDate');
  assert.equal(parsed.sortDir, 'asc');
});

test('uploadLeadDocumentSchema validates documentType, title, and notes', () => {
  const parsed = uploadLeadDocumentSchema.parse({
    documentType: 'Purchase Order (PO)',
    title: 'PO #1042 - Ring Road Hoardings',
    notes: 'Signed and stamped by client',
  });
  assert.equal(parsed.documentType, 'Purchase Order (PO)');
  assert.equal(parsed.title, 'PO #1042 - Ring Road Hoardings');
  assert.equal(parsed.notes, 'Signed and stamped by client');

  assert.throws(() => {
    uploadLeadDocumentSchema.parse({
      documentType: 'InvalidType' as any,
      title: 'Doc',
    });
  });

  assert.throws(() => {
    uploadLeadDocumentSchema.parse({
      documentType: 'PAN Card',
      title: '   ',
    });
  });
});

test('releaseBreachedClaimedLeads auto-releases leads claimed > 24h ago with no action back to unclaimed pool', async () => {
  const origFind = Lead.find;
  const now = new Date();
  const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000);

  let savedCount = 0;
  const mockBreachedLead: any = {
    _id: '64b7f9a1c2d3e4f5a6b7c8d1',
    companyName: 'Breached Corp',
    status: 'New',
    claimedBy: '64b7f9a1c2d3e4f5a6b7c801',
    assignedTo: '64b7f9a1c2d3e4f5a6b7c801',
    claimedAt: thirtyHoursAgo,
    slaTimerEnd: new Date(thirtyHoursAgo.getTime() + 24 * 60 * 60 * 1000),
    firstResponseAt: null,
    callLogs: [],
    statusHistory: [],
    save: async function () {
      savedCount++;
      return this;
    },
  };

  (Lead as any).find = () => ({
    exec: async () => [mockBreachedLead],
  });

  try {
    const released = await LeadsService.releaseBreachedClaimedLeads();
    assert.equal(released, 1);
    assert.equal(savedCount, 1);
    assert.equal(mockBreachedLead.claimedBy, null);
    assert.equal(mockBreachedLead.assignedTo, null);
    assert.equal(mockBreachedLead.claimedAt, null);
    assert.equal(mockBreachedLead.slaTimerEnd, null);
    assert.equal(mockBreachedLead.status, 'New');
    assert.equal(mockBreachedLead.statusHistory.length, 1);
    assert.match(mockBreachedLead.statusHistory[0].reason, /Auto-released to Unclaimed pool/);
  } finally {
    Lead.find = origFind;
  }
});

test('releaseBreachedClaimedLeads does NOT release leads that have call logs or firstResponseAt', async () => {
  const origFind = Lead.find;
  const now = new Date();
  const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000);

  const mockActiveLead: any = {
    _id: '64b7f9a1c2d3e4f5a6b7c8d2',
    companyName: 'Active Corp',
    status: 'New',
    claimedBy: '64b7f9a1c2d3e4f5a6b7c801',
    assignedTo: '64b7f9a1c2d3e4f5a6b7c801',
    claimedAt: thirtyHoursAgo,
    slaTimerEnd: new Date(thirtyHoursAgo.getTime() + 24 * 60 * 60 * 1000),
    firstResponseAt: null,
    callLogs: [{ followUpType: 'Call', createdAt: new Date() }],
    statusHistory: [],
    save: async function () { return this; },
  };

  (Lead as any).find = () => ({
    exec: async () => [mockActiveLead],
  });

  try {
    const released = await LeadsService.releaseBreachedClaimedLeads();
    assert.equal(released, 0);
    assert.ok(mockActiveLead.claimedBy !== null);
  } finally {
    Lead.find = origFind;
  }
});

test('getLeadStats returns active, overdue, unclaimed, and won metrics', async () => {
  const origCount = Lead.countDocuments;
  const origAggregate = Lead.aggregate;

  (Lead as any).countDocuments = async (query: any) => {
    if (query.nextActionDate) return 3;
    if (query.status === 'New' && query.assignedTo === null) return 2;
    return 15;
  };

  (Lead as any).aggregate = async () => [
    { _id: null, count: 5, totalRevenue: 15000000 },
  ];

  try {
    const stats = await LeadsService.getLeadStats(FAKE_USER_CTX);
    assert.equal(stats.totalActive, 15);
    assert.equal(stats.overdueCount, 3);
    assert.equal(stats.unclaimedCount, 2);
    assert.equal(stats.wonCount, 5);
    assert.equal(stats.wonRevenue, 15000000);
  } finally {
    Lead.countDocuments = origCount;
    Lead.aggregate = origAggregate;
  }
});





