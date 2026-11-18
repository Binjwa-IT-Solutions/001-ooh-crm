import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCandidateSchema,
  listCandidatesSchema,
  updateCandidateSchema,
  interviewRoundInputSchema,
} from './candidates.validator.js';

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

test('updating candidate details fields passes validation', () => {
  const result = updateCandidateSchema.parse({
    name: 'Tarun Singh',
    email: 'tarun@gmail.com',
    mobile: '9876543210',
    position: 'Full Stack Engineer',
    interviewDate: new Date().toISOString(),
  });
  assert.equal(result.name, 'Tarun Singh');
  assert.equal(result.position, 'Full Stack Engineer');
});

test('list query supports resume filter and pagination', () => {
  const result = listCandidatesSchema.parse({
    page: '2',
    pageSize: '10',
    resume: 'available',
  });
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 10);
  assert.equal(result.resume, 'available');
});

test('interview round input passes validation', () => {
  const round = interviewRoundInputSchema.parse({
    roundNumber: 2,
    roundName: 'Technical Round 2',
    interviewDate: new Date().toISOString(),
    interviewedBy: '507f1f77bcf86cd799439011',
    notes: 'Strong knowledge in React and Node.js',
    status: 'Passed',
  });
  assert.equal(round.roundNumber, 2);
  assert.equal(round.roundName, 'Technical Round 2');
  assert.equal(round.status, 'Passed');
});

test('updating candidate with multiple interview rounds passes validation', () => {
  const result = updateCandidateSchema.parse({
    interviewRounds: [
      {
        roundNumber: 1,
        roundName: 'Round 1 - Screening',
        interviewDate: new Date().toISOString(),
        interviewedBy: '507f1f77bcf86cd799439011',
        notes: 'Good communication',
        status: 'Completed',
      },
      {
        roundNumber: 2,
        roundName: 'Round 2 - Live Coding',
        interviewDate: new Date().toISOString(),
        interviewedBy: '507f1f77bcf86cd799439012',
        notes: 'Solved algorithmic challenges cleanly',
        status: 'Passed',
      },
    ],
  });
  assert.equal(result.interviewRounds?.length, 2);
  assert.equal(result.interviewRounds?.[1].roundName, 'Round 2 - Live Coding');
});
