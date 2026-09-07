import assert from 'node:assert/strict';
import test from 'node:test';
import { createCandidateSchema, listCandidatesSchema, updateCandidateSchema } from './candidates.validator.js';

const validCandidate = {
  name: 'Rukmini Desai',
  email: 'rukmini@mediaoctus.test',
  mobile: '9876543210',
  position: 'Software Engineer',
  interviewDate: new Date().toISOString(),
};

test('a valid candidate passes validation', () => {
  const result = createCandidateSchema.parse(validCandidate);
  assert.equal(result.name, 'Rukmini Desai');
  assert.equal(result.status, 'Scheduled');
});

test('mobile must be a valid Indian number', () => {
  assert.throws(() => createCandidateSchema.parse({ ...validCandidate, mobile: '12345' }), /10-digit/);
});

test('status must be a known enum', () => {
  assert.throws(() => updateCandidateSchema.parse({ status: 'Unknown' }), /Invalid enum value/);
});

test('a partial update is allowed but an empty one is not', () => {
  assert.doesNotThrow(() => updateCandidateSchema.parse({ status: 'Selected' }));
  assert.throws(() => updateCandidateSchema.parse({}), /Nothing to update/);
});
