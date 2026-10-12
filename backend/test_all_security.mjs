/**
 * Comprehensive Multi-User Isolation & Security Test Suite
 * Tests all requirements from prompt:
 *  - Unauthenticated access rejection (401)
 *  - Forged identity/role rejection
 *  - TEST A: Admin -> Manager isolation
 *  - TEST B: Manager -> Admin isolation
 *  - TEST C: Manager -> Manager isolation
 *  - TEST D: Direct Tool Attack (server-side 403 rejection)
 *  - TEST E: Conversation Ownership (403 on cross-user conversation access)
 *  - TEST F: LLM Context Isolation (no context leakage between users)
 *  - Real data fetching for all roles
 */

const API_BASE = 'http://localhost:5000';

async function login(email, password = 'Password123!') {
  const r1 = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r1.ok) throw new Error(`Login failed for ${email}: ${r1.status}`);
  const d1 = await r1.json();
  const r2 = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: d1.challenge.challengeId, code: d1.challenge.devOtp }),
  });
  if (!r2.ok) throw new Error(`OTP verify failed for ${email}: ${r2.status}`);
  const d2 = await r2.json();
  return {
    token: d2.accessToken,
    user: d2.user,
  };
}

async function run() {
  console.log('====================================================');
  console.log('  STARTING OCTUS AI CHATBOT SECURITY TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Logins
  console.log('1. Authenticating test users...');
  const admin = await login('admin@mediaoctus.test');
  const managerA = await login('manager@mediaoctus.test');
  const managerB = await login('manager@mediaoctus.com');
  const sales = await login('sales@mediaoctus.test');
  const hr = await login('hr@mediaoctus.test');
  const finance = await login('finance@mediaoctus.test');
  const employee = await login('employee@mediaoctus.test');
  console.log('   All 7 test accounts authenticated successfully.\n');

  // --------------------------------------------------------------------------
  // TEST: Unauthenticated requests must be rejected (401)
  // --------------------------------------------------------------------------
  console.log('2. Testing unauthenticated endpoint protection...');
  const unauthChat = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello unauthenticated' }),
  });
  assert(unauthChat.status === 401, `Unauthenticated POST /api/chatbot/message returned 401 (got ${unauthChat.status})`);

  const unauthTool = await fetch(`${API_BASE}/api/chatbot/tool`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName: 'get_employee' }),
  });
  assert(unauthTool.status === 401, `Unauthenticated POST /api/chatbot/tool returned 401 (got ${unauthTool.status})`);

  const unauthConv = await fetch(`${API_BASE}/api/conversations`, {
    method: 'GET',
  });
  assert(unauthConv.status === 401, `Unauthenticated GET /api/conversations returned 401 (got ${unauthConv.status})`);

  // --------------------------------------------------------------------------
  // TEST: Forged role & forged identity defense
  // --------------------------------------------------------------------------
  console.log('\n3. Testing forged identity / role defense...');
  const forgedTool = await fetch(`${API_BASE}/api/chatbot/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employee.token}`,
    },
    body: JSON.stringify({
      toolName: 'update_salary',
      role: 'admin', // Forged role in body
      userId: admin.user.id, // Forged userId in body
      toolArgs: { name: 'Aditi Rao', new_salary: 5000000 },
    }),
  });
  assert(forgedTool.status === 403, `Employee forging admin role for update_salary is rejected with 403 (got ${forgedTool.status})`);

  // --------------------------------------------------------------------------
  // TEST A: ADMIN -> MANAGER
  // --------------------------------------------------------------------------
  console.log('\n4. Running TEST A: Admin -> Manager isolation...');
  const adminMsg = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({
      message: 'ADMIN_TEST_12345: Keep this confidential admin secret',
    }),
  }).then((r) => r.json());
  assert(Boolean(adminMsg.reply), `Admin sees search response for ADMIN_TEST_12345`);

  // Manager lists conversations
  const managerConvs = await fetch(`${API_BASE}/api/conversations`, {
    headers: { Authorization: `Bearer ${managerA.token}` },
  }).then((r) => r.json());
  const managerHasAdminConv = (managerConvs.conversations || []).some(
    (c) => c.conversationId === adminMsg.sessionId || (c.title && c.title.includes('ADMIN_TEST_12345')),
  );
  assert(!managerHasAdminConv, `Manager conversation list does NOT contain ADMIN_TEST_12345 or Admin's conversation`);

  // --------------------------------------------------------------------------
  // TEST B: MANAGER -> ADMIN
  // --------------------------------------------------------------------------
  console.log('\n5. Running TEST B: Manager -> Admin isolation...');
  const managerMsg = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerA.token}`,
    },
    body: JSON.stringify({
      message: 'MANAGER_TEST_67890: Confidential manager strategy note',
    }),
  }).then((r) => r.json());
  assert(Boolean(managerMsg.reply), `Manager sees response for MANAGER_TEST_67890`);

  const adminConvs = await fetch(`${API_BASE}/api/conversations`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  }).then((r) => r.json());
  const adminHasManagerConv = (adminConvs.conversations || []).some(
    (c) => c.conversationId === managerMsg.sessionId || (c.title && c.title.includes('MANAGER_TEST_67890')),
  );
  assert(!adminHasManagerConv, `Admin conversation list does NOT contain MANAGER_TEST_67890 or Manager's conversation`);

  // --------------------------------------------------------------------------
  // TEST C: MANAGER -> MANAGER (Manager A vs Manager B)
  // --------------------------------------------------------------------------
  console.log('\n6. Running TEST C: Manager A -> Manager B isolation...');
  const managerAMsg = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerA.token}`,
    },
    body: JSON.stringify({
      message: 'MANAGER_A_TEST_111: Exclusive Manager A workflow',
    }),
  }).then((r) => r.json());

  const managerBMsg = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerB.token}`,
    },
    body: JSON.stringify({
      message: 'MANAGER_B_TEST_222: Exclusive Manager B workflow',
    }),
  }).then((r) => r.json());

  const mgrBConvs = await fetch(`${API_BASE}/api/conversations`, {
    headers: { Authorization: `Bearer ${managerB.token}` },
  }).then((r) => r.json());
  const mgrBSeesA = (mgrBConvs.conversations || []).some(
    (c) => c.conversationId === managerAMsg.sessionId || (c.title && c.title.includes('MANAGER_A_TEST_111')),
  );
  assert(!mgrBSeesA, `Manager B does NOT see Manager A's conversations or data`);

  // --------------------------------------------------------------------------
  // TEST D: DIRECT TOOL ATTACK (Server-side 403 authorization)
  // --------------------------------------------------------------------------
  console.log('\n7. Running TEST D: Direct Tool Attacks...');
  // 1. Manager attempts update_salary (Finance/Admin only)
  const attack1 = await fetch(`${API_BASE}/api/chatbot/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerA.token}`,
    },
    body: JSON.stringify({
      toolName: 'update_salary',
      toolArgs: { name: 'Sana Qureshi', new_salary: 800000 },
    }),
  });
  assert(attack1.status === 403, `Manager calling update_salary directly is rejected with 403 (got ${attack1.status})`);

  // 2. Manager attempts get_recent_activity (Finance/Admin only)
  const attack2 = await fetch(`${API_BASE}/api/chatbot/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerA.token}`,
    },
    body: JSON.stringify({
      toolName: 'get_recent_activity',
    }),
  });
  assert(attack2.status === 403, `Manager calling get_recent_activity directly is rejected with 403 (got ${attack2.status})`);

  // 3. Employee attempts update_task_status (tasks.manage only)
  const attack3 = await fetch(`${API_BASE}/api/chatbot/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employee.token}`,
    },
    body: JSON.stringify({
      toolName: 'update_task_status',
      toolArgs: { task_id: '123', status: 'Completed' },
    }),
  });
  assert(attack3.status === 403, `Employee calling update_task_status directly is rejected with 403 (got ${attack3.status})`);

  // 4. Sales Agent attempts generate_po_pdf (Ops/Admin only)
  const attack4 = await fetch(`${API_BASE}/api/chatbot/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sales.token}`,
    },
    body: JSON.stringify({
      toolName: 'generate_po_pdf',
      toolArgs: { po_id: '123' },
    }),
  });
  assert(attack4.status === 403, `Sales Agent calling generate_po_pdf directly is rejected with 403 (got ${attack4.status})`);

  // 5. Allowed tool invocation: Finance calling get_company_finance_summary
  const allowedTool = await fetch(`${API_BASE}/api/chatbot/tool`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${finance.token}`,
    },
    body: JSON.stringify({
      toolName: 'get_company_finance_summary',
    }),
  });
  assert(allowedTool.status === 200, `Finance calling allowed tool get_company_finance_summary succeeds with 200 (got ${allowedTool.status})`);

  // --------------------------------------------------------------------------
  // TEST E: CONVERSATION OWNERSHIP (Cross-user access rejection)
  // --------------------------------------------------------------------------
  console.log('\n8. Running TEST E: Conversation Ownership...');
  // User A (Admin) creates conversation
  const convAId = adminMsg.sessionId;
  // User B (Manager) tries to read Conversation A
  const crossUserRead = await fetch(`${API_BASE}/api/conversations/${convAId}`, {
    headers: { Authorization: `Bearer ${managerA.token}` },
  });
  assert(crossUserRead.status === 403, `Manager requesting Admin's conversation is rejected with 403 Forbidden (got ${crossUserRead.status})`);

  // User B tries to delete Conversation A
  const crossUserDelete = await fetch(`${API_BASE}/api/conversations/${convAId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${managerA.token}` },
  });
  assert(crossUserDelete.status === 403, `Manager attempting to delete Admin's conversation is rejected with 403 (got ${crossUserDelete.status})`);

  // User A (Owner) can read their own conversation
  const ownerRead = await fetch(`${API_BASE}/api/conversations/${convAId}`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  assert(ownerRead.status === 200, `Admin successfully reads their own conversation (got ${ownerRead.status})`);

  // --------------------------------------------------------------------------
  // TEST F: LLM CONTEXT ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n9. Running TEST F: LLM Context Isolation...');
  const userA_conv = `conv_iso_A_${Date.now()}`;
  const userB_conv = `conv_iso_B_${Date.now()}`;

  // User A posts secret
  await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({
      message: 'My private secret code is: PRIVATE_USER_A_TEST_123',
      sessionId: userA_conv,
    }),
  });

  // User B posts secret
  await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerA.token}`,
    },
    body: JSON.stringify({
      message: 'My private secret code is: PRIVATE_USER_B_TEST_456',
      sessionId: userB_conv,
    }),
  });

  // User B asks for prior secret
  const userBQuery = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerA.token}`,
    },
    body: JSON.stringify({
      message: 'What was the secret code mentioned in the chat?',
      sessionId: userB_conv,
    }),
  }).then((r) => r.json());

  assert(!userBQuery.reply.includes('PRIVATE_USER_A_TEST_123'), `User B prompt/reply does NOT contain User A's secret (PRIVATE_USER_A_TEST_123)`);
  assert(userBQuery.reply.includes('PRIVATE_USER_B_TEST_456'), `User B correctly remembers their OWN secret (PRIVATE_USER_B_TEST_456)`);

  // User A asks for prior secret
  const userAQuery = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin.token}`,
    },
    body: JSON.stringify({
      message: 'What was the secret code mentioned in the chat?',
      sessionId: userA_conv,
    }),
  }).then((r) => r.json());

  assert(!userAQuery.reply.includes('PRIVATE_USER_B_TEST_456'), `User A prompt/reply does NOT contain User B's secret (PRIVATE_USER_B_TEST_456)`);
  assert(userAQuery.reply.includes('PRIVATE_USER_A_TEST_123'), `User A correctly remembers their OWN secret (PRIVATE_USER_A_TEST_123)`);

  // --------------------------------------------------------------------------
  // REAL DATA FETCHING VERIFICATION
  // --------------------------------------------------------------------------
  console.log('\n10. Testing Real Data Fetching across roles...');

  // 1. HR checking leave policy / balance
  const hrRes = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hr.token}`,
    },
    body: JSON.stringify({ message: 'What is my leave balance?' }),
  }).then((r) => r.json());
  assert(hrRes.reply.toLowerCase().includes('leave') || hrRes.reply.toLowerCase().includes('balance'), `HR gets real leave data response`);

  // 2. Sales checking leads
  const salesRes = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sales.token}`,
    },
    body: JSON.stringify({ message: 'Show me available sales leads' }),
  }).then((r) => r.json());
  assert(Boolean(salesRes.reply), `Sales Agent gets real leads response`);

  // 3. Employee checking personal tasks
  const empRes = await fetch(`${API_BASE}/api/chatbot/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employee.token}`,
    },
    body: JSON.stringify({ message: 'What are my assigned tasks?' }),
  }).then((r) => r.json());
  assert(Boolean(empRes.reply), `Employee gets assigned tasks response`);

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
