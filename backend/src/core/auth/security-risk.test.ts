import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessLoginRisk,
  distanceBetweenLocationsMeters,
  normalizeLoginLocation,
} from './security-risk.js';

const baseline = { latitude: 19.076, longitude: 72.8777, accuracyMeters: 10 };

test('calculates distance between GPS coordinates in meters', () => {
  const distance = distanceBetweenLocationsMeters(
    { latitude: 0, longitude: 0 },
    { latitude: 0.001, longitude: 0 },
  );
  assert.ok(distance > 110 && distance < 112);
});

test('a known device within the configured radius passes risk checks', () => {
  const risk = assessLoginRisk({
    location: { ...baseline, latitude: baseline.latitude + 0.001 },
    knownDeviceLocation: baseline,
    isKnownDevice: true,
    changeRadiusMeters: 1000,
    maxLocationAccuracyMeters: 1000,
  });

  assert.equal(risk.riskLevel, 'low');
  assert.deepEqual(risk.reasons, []);
});

test('a new device requires approval even when location is available', () => {
  const risk = assessLoginRisk({
    location: baseline,
    knownDeviceLocation: null,
    isKnownDevice: false,
    changeRadiusMeters: 1000,
    maxLocationAccuracyMeters: 1000,
  });

  assert.equal(risk.riskLevel, 'high');
  assert.deepEqual(risk.reasons, ['new_device']);
});

test('location outside the change radius requires approval', () => {
  const risk = assessLoginRisk({
    location: { ...baseline, latitude: baseline.latitude + 0.03 },
    knownDeviceLocation: baseline,
    isKnownDevice: true,
    changeRadiusMeters: 1000,
    maxLocationAccuracyMeters: 1000,
  });

  assert.equal(risk.riskLevel, 'high');
  assert.ok(risk.reasons.includes('location_changed'));
  assert.ok((risk.distanceMeters ?? 0) > 3000);
});

test('missing or inaccurate GPS on a known device only raises a signal', () => {
  const risk = assessLoginRisk({
    location: null,
    knownDeviceLocation: baseline,
    isKnownDevice: true,
    changeRadiusMeters: 1000,
    maxLocationAccuracyMeters: 1000,
  });

  assert.equal(risk.riskLevel, 'low');
  assert.deepEqual(risk.reasons, ['location_unavailable']);

  // A city-level guess far away must not count as "location changed".
  const inaccurate = assessLoginRisk({
    location: { latitude: 24.202, longitude: 78.361, accuracyMeters: 50_000 },
    knownDeviceLocation: baseline,
    isKnownDevice: true,
    changeRadiusMeters: 1000,
    maxLocationAccuracyMeters: 1000,
  });
  assert.equal(inaccurate.riskLevel, 'low');
  assert.deepEqual(inaccurate.reasons, ['location_accuracy_low']);
});

test('LOCATION_REQUIRED makes missing GPS require approval', () => {
  const risk = assessLoginRisk({
    location: null,
    knownDeviceLocation: baseline,
    isKnownDevice: true,
    changeRadiusMeters: 1000,
    maxLocationAccuracyMeters: 1000,
    requireAccurateLocation: true,
  });

  assert.equal(risk.riskLevel, 'high');
});

const office = { name: 'HQ', latitude: 19.076, longitude: 72.8777, radiusMeters: 500 };

test('a new device needs approval even inside the office', () => {
  const risk = assessLoginRisk({
    location: { ...baseline, accuracyMeters: 80 },
    knownDeviceLocation: null,
    isKnownDevice: false,
    changeRadiusMeters: 1000,
    maxLocationAccuracyMeters: 1000,
    officeLocations: [office],
  });

  assert.equal(risk.riskLevel, 'high');
  assert.deepEqual(risk.reasons, ['new_device']);
});

test('a known device inside the office passes, outside it needs approval', () => {
  const inside = assessLoginRisk({
    location: { ...baseline, accuracyMeters: 80 },
    knownDeviceLocation: baseline,
    isKnownDevice: true,
    changeRadiusMeters: 1000,
    maxLocationAccuracyMeters: 1000,
    officeLocations: [office],
  });
  assert.equal(inside.riskLevel, 'low');
  assert.deepEqual(inside.reasons, []);

  // ~2.2 km away — also outside the baseline radius would not matter: the office is the rule.
  const outside = assessLoginRisk({
    location: { latitude: office.latitude + 0.02, longitude: office.longitude, accuracyMeters: 80 },
    knownDeviceLocation: baseline,
    isKnownDevice: true,
    changeRadiusMeters: 5000,
    maxLocationAccuracyMeters: 1000,
    officeLocations: [office],
  });
  assert.equal(outside.riskLevel, 'high');
  assert.deepEqual(outside.reasons, ['outside_office']);
});

test('rounds stored GPS coordinates and includes a location-precision floor', () => {
  assert.deepEqual(
    normalizeLoginLocation({ latitude: 19.07641, longitude: 72.87772, accuracyMeters: 12 }),
    { latitude: 19.076, longitude: 72.878, accuracyMeters: 80 },
  );
});
