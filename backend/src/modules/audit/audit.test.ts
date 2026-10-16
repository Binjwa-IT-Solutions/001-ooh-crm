import assert from 'node:assert/strict';
import test from 'node:test';
import { listAuditQuerySchema, entityAuditQuerySchema } from './audit.validator.js';
import { AuditController } from './audit.controller.js';
import { auditService } from '../../core/audit/index.js';

test('listAuditQuerySchema validates and applies defaults', () => {
  const parsed = listAuditQuerySchema.parse({});
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 25);
  assert.equal(parsed.entity, undefined);
  assert.equal(parsed.action, undefined);
});

test('listAuditQuerySchema coerces numbers and validates bounds', () => {
  const parsed = listAuditQuerySchema.parse({
    page: '3',
    pageSize: '50',
    entity: 'quotations',
    action: 'create',
  });
  assert.equal(parsed.page, 3);
  assert.equal(parsed.pageSize, 50);
  assert.equal(parsed.entity, 'quotations');
  assert.equal(parsed.action, 'create');
});

test('listAuditQuerySchema rejects invalid action', () => {
  assert.throws(() => {
    listAuditQuerySchema.parse({ action: 'invalid_action' });
  });
});

test('listAuditQuerySchema rejects invalid actorId format', () => {
  assert.throws(() => {
    listAuditQuerySchema.parse({ actorId: 'not-an-objectid' });
  });
});

test('entityAuditQuerySchema validates limit', () => {
  const parsed = entityAuditQuerySchema.parse({ limit: '10' });
  assert.equal(parsed.limit, 10);
});

test('AuditController.list formats response with pagination meta', async () => {
  const origList = auditService.list;
  try {
    (auditService as any).list = async () => ({
      entries: [
        {
          _id: '64b7f9a1c2d3e4f5a6b7c8d9',
          action: 'create',
          entity: 'leads',
          actorEmail: 'sales@example.com',
          createdAt: new Date('2026-09-29T10:00:00Z'),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });

    let jsonResult: any = null;
    let statusCode: number | null = null;

    const req = {
      query: { entity: 'leads', page: '1', pageSize: '25' },
    } as any;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonResult = data;
      },
    } as any;

    await AuditController.list(req, res);

    assert.equal(statusCode, 200);
    assert.equal(jsonResult.data.length, 1);
    assert.equal(jsonResult.meta.total, 1);
    assert.equal(jsonResult.meta.page, 1);
    assert.equal(jsonResult.meta.totalPages, 1);
  } finally {
    auditService.list = origList;
  }
});

test('AuditController.exportCsv generates CSV with proper headers', async () => {
  const origList = auditService.list;
  try {
    (auditService as any).list = async () => ({
      entries: [
        {
          _id: '64b7f9a1c2d3e4f5a6b7c8d9',
          action: 'update',
          entity: 'quotations',
          entityId: 'QT-101',
          actorEmail: 'admin@mediaoctus.com',
          actorRole: 'admin',
          method: 'PATCH',
          path: '/api/quotations/123',
          statusCode: 200,
          ip: '127.0.0.1',
          createdAt: new Date('2026-09-29T10:00:00Z'),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 1000,
    });

    const headers: Record<string, string> = {};
    let sentBody: string = '';
    let statusCode: number | null = null;

    const req = { query: {} } as any;
    const res = {
      setHeader(key: string, val: string) {
        headers[key] = val;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      send(body: string) {
        sentBody = body;
      },
    } as any;

    await AuditController.exportCsv(req, res);

    assert.equal(statusCode, 200);
    assert.equal(headers['Content-Type'], 'text/csv; charset=utf-8');
    assert.ok(headers['Content-Disposition'].includes('audit_logs_'));
    assert.ok(sentBody.includes('Timestamp (UTC)'));
    assert.ok(sentBody.includes('admin@mediaoctus.com'));
    assert.ok(sentBody.includes('quotations'));
  } finally {
    auditService.list = origList;
  }
});
