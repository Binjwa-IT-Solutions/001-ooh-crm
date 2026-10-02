import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../db/connect.js';
import { ForbiddenError } from '../errors/index.js';
import { Notification, notificationService } from './index.js';

const userAId = '507f1f77bcf86cd799439011';
const userBId = '507f1f77bcf86cd799439022';

before(async () => {
  await connectDatabase();
  await Notification.deleteMany({
    userId: { $in: [new Types.ObjectId(userAId), new Types.ObjectId(userBId)] },
  });
});

after(async () => {
  await Notification.deleteMany({
    userId: { $in: [new Types.ObjectId(userAId), new Types.ObjectId(userBId)] },
  });
  await disconnectDatabase();
});

test('deleteForUser returns false for non-existent or invalid IDs', async () => {
  const resultInvalid = await notificationService.deleteForUser(userAId, 'invalid-id');
  assert.equal(resultInvalid, false);

  const fakeId = new Types.ObjectId().toString();
  const resultNotFound = await notificationService.deleteForUser(userAId, fakeId);
  assert.equal(resultNotFound, false);
});

test('deleteForUser throws ForbiddenError if notification belongs to another user', async () => {
  // Notification created for User B
  const notifB = await Notification.create({
    userId: new Types.ObjectId(userBId),
    type: 'leave.approved',
    title: 'User B Leave Approved',
    link: '/leave?tab=my',
  });

  // User A attempts to delete User B's notification
  await assert.rejects(
    async () => {
      await notificationService.deleteForUser(userAId, notifB._id.toString());
    },
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenError, 'Should throw ForbiddenError');
      return true;
    },
  );

  // Verify User B's notification still exists in DB
  const stillExists = await Notification.findById(notifB._id);
  assert.ok(stillExists, 'Notification must not be deleted by another user');
});

test('deleteForUser deletes only the target notification and preserves other notifications', async () => {
  // Create 3 notifications for User A (different modules)
  const leaveNotif = await Notification.create({
    userId: new Types.ObjectId(userAId),
    type: 'leave.approved',
    title: 'Leave Approved',
    link: '/leave?tab=my',
  });

  const attendanceNotif = await Notification.create({
    userId: new Types.ObjectId(userAId),
    type: 'attendance.habitual_late',
    title: 'Habitual Lateness Alert',
  });

  const taskNotif = await Notification.create({
    userId: new Types.ObjectId(userAId),
    type: 'escalations.task_escalated',
    title: 'Task Escalated',
    link: '/escalations',
  });

  // User A clicks/opens the leave notification -> deletes only leaveNotif
  const deleted = await notificationService.deleteForUser(userAId, leaveNotif._id.toString());
  assert.equal(deleted, true);

  // Verify leave notification is gone from database
  const checkLeave = await Notification.findById(leaveNotif._id);
  assert.equal(checkLeave, null, 'Deleted notification must not exist in DB');

  // Verify attendance and task notifications still exist
  const checkAttendance = await Notification.findById(attendanceNotif._id);
  assert.ok(checkAttendance, 'Attendance notification must remain');

  const checkTask = await Notification.findById(taskNotif._id);
  assert.ok(checkTask, 'Task notification must remain');

  // Verify listForUser reflects deletion (deleted notification does not appear on refresh/fetch)
  const list = await notificationService.listForUser(userAId);
  const foundDeleted = list.notifications.some(
    (n) => n._id.toString() === leaveNotif._id.toString(),
  );
  assert.equal(foundDeleted, false, 'Deleted notification must not appear in listForUser');
  assert.equal(list.notifications.length, 2);
});
