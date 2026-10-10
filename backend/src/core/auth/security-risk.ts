export interface LoginRisk {
  riskLevel: 'low' | 'high';
  reasons: string[];
  distanceMeters: number | null;
}

export interface LoginLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export function distanceBetweenLocationsMeters(
  first: Pick<LoginLocation, 'latitude' | 'longitude'>,
  second: Pick<LoginLocation, 'latitude' | 'longitude'>,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export interface OfficeArea {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

/**
 * Whether the reported position could be inside the office. The accuracy circle
 * only has to overlap the office area, so GPS drift at the edge is not punished;
 * this never grants trust on its own — it only clears a known device.
 */
export function isWithinAnyOffice(location: LoginLocation, offices: readonly OfficeArea[]): boolean {
  return offices.some(
    (office) =>
      distanceBetweenLocationsMeters(location, office) - location.accuracyMeters <=
      office.radiusMeters,
  );
}

/**
 * Two kinds of reason come back:
 *   - blocking (new_device, outside_office, location_changed) → riskLevel 'high',
 *     the login waits for an admin;
 *   - signal-only (location_unavailable, location_accuracy_low,
 *     location_baseline_missing) → riskLevel stays 'low', admins are alerted.
 * Unusable location is a signal by default because many laptops cannot report an
 * accurate fix; `requireAccurateLocation` turns it into a blocking reason.
 */
export function assessLoginRisk(input: {
  location: LoginLocation | null;
  knownDeviceLocation: LoginLocation | null;
  isKnownDevice: boolean;
  changeRadiusMeters: number;
  maxLocationAccuracyMeters: number;
  officeLocations?: readonly OfficeArea[];
  requireAccurateLocation?: boolean;
}): LoginRisk {
  const reasons: string[] = [];
  let blocked = false;

  // An unapproved device always needs an admin, wherever it claims to be —
  // browser location is trivially spoofed.
  if (!input.isKnownDevice) {
    reasons.push('new_device');
    blocked = true;
  }

  const accurateLocation =
    input.location && input.location.accuracyMeters <= input.maxLocationAccuracyMeters
      ? input.location
      : null;

  if (!input.location) reasons.push('location_unavailable');
  else if (!accurateLocation) reasons.push('location_accuracy_low');
  if (!accurateLocation && input.requireAccurateLocation) blocked = true;

  const distanceMeters =
    accurateLocation && input.knownDeviceLocation
      ? distanceBetweenLocationsMeters(accurateLocation, input.knownDeviceLocation)
      : null;

  if (accurateLocation) {
    const offices = input.officeLocations ?? [];
    if (offices.length > 0) {
      // With offices configured, the office is the rule — not wherever the device
      // happened to be first approved.
      if (!isWithinAnyOffice(accurateLocation, offices)) {
        reasons.push('outside_office');
        blocked = true;
      }
    } else if (
      distanceMeters !== null &&
      distanceMeters >
        input.changeRadiusMeters +
          accurateLocation.accuracyMeters +
          input.knownDeviceLocation!.accuracyMeters
    ) {
      reasons.push('location_changed');
      blocked = true;
    } else if (input.isKnownDevice && !input.knownDeviceLocation) {
      reasons.push('location_baseline_missing');
    }
  }

  return {
    riskLevel: blocked ? 'high' : 'low',
    reasons,
    distanceMeters,
  };
}

export function normalizeLoginLocation(location: LoginLocation): LoginLocation {
  return {
    latitude: Number(location.latitude.toFixed(3)),
    longitude: Number(location.longitude.toFixed(3)),
    accuracyMeters: Math.max(location.accuracyMeters, 80),
  };
}
