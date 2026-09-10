import assert from 'node:assert/strict';
import test from 'node:test';

import { Lead } from './leads.model.js';
import { LeadsService } from './leads.service.js';
import { leadQualificationSchema } from './leads.validator.js';

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


