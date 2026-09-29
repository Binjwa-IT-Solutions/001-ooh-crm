import type { Proof } from "./types";

export function formatDate(
  value?: string
) {
  if (!value) return "-";

  return new Date(value).toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

export function formatDistance(
  distance?: number
) {
  if (
    distance === undefined ||
    distance === null
  ) {
    return "-";
  }

  return `${Math.round(distance)} m`;
}

export function formatGps(
  lat?: number,
  lng?: number
) {
  if (
    lat === undefined ||
    lng === undefined
  ) {
    return "-";
  }

  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function getProofImageUrl(proof?: Proof | null): string {
  if (!proof) return "";
  if (
    proof.watermarkedImageKey &&
    (proof.watermarkedImageKey.startsWith("http") ||
      proof.watermarkedImageKey.startsWith("data:") ||
      proof.watermarkedImageKey.startsWith("/uploads/"))
  ) {
    return proof.watermarkedImageKey;
  }
  if (
    proof.originalImageKey &&
    (proof.originalImageKey.startsWith("http") ||
      proof.originalImageKey.startsWith("data:") ||
      proof.originalImageKey.startsWith("/uploads/"))
  ) {
    return proof.originalImageKey;
  }
  if (proof._id) {
    return `/api/proofs/${proof._id}/image`;
  }
  return "";
}

const geocodeCache = new Map<string, string>();

export async function getLocationName(
  lat?: number,
  lng?: number
): Promise<string> {
  if (lat === undefined || lng === undefined) {
    return "-";
  }

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key)!;
  }

  // 1. First priority: Nominatim with detailed address components (area, road, suburb, city)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "MediaOctusApp/1.0",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      // Detect Indian local neighborhood / area / suburb (e.g. Vijay Nagar, Bhawarkua)
      const localArea =
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        addr.residential ||
        addr.road ||
        addr.commercial ||
        addr.industrial ||
        addr.amenity ||
        addr.shop ||
        addr.building ||
        addr.village ||
        addr.hamlet;

      const city =
        addr.city ||
        addr.town ||
        addr.city_district ||
        addr.county ||
        addr.state_district;

      if (localArea && city) {
        if (localArea.toLowerCase().includes(city.toLowerCase())) {
          geocodeCache.set(key, localArea);
          return localArea;
        }
        const formatted = `${localArea}, ${city}`;
        geocodeCache.set(key, formatted);
        return formatted;
      }

      if (localArea) {
        geocodeCache.set(key, localArea);
        return localArea;
      }

      if (city) {
        geocodeCache.set(key, city);
        return city;
      }

      if (data.display_name) {
        const parts = data.display_name
          .split(",")
          .slice(0, 2)
          .map((s: string) => s.trim())
          .join(", ");
        geocodeCache.set(key, parts);
        return parts;
      }
    }
  } catch {
    // fallback to BigDataCloud
  }

  // 2. Second priority: BigDataCloud reverse geocode
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality;
      const city = data.city;
      const adminLevels = data.localityInfo?.administrative || [];
      const wardOrArea = adminLevels.find(
        (a: { adminLevel?: number; name?: string }) =>
          (a.adminLevel ?? 0) >= 8 && a.name && a.name !== city
      )?.name;

      const areaPart = wardOrArea || locality;
      if (
        areaPart &&
        city &&
        !areaPart.toLowerCase().includes(city.toLowerCase())
      ) {
        const formatted = `${areaPart}, ${city}`;
        geocodeCache.set(key, formatted);
        return formatted;
      }

      const parts = [
        areaPart || city,
        data.principalSubdivision,
      ].filter(Boolean);

      if (parts.length > 0) {
        const unique = Array.from(new Set(parts)).join(", ");
        geocodeCache.set(key, unique);
        return unique;
      }
    }
  } catch {
    // fallback
  }

  const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  geocodeCache.set(key, fallback);
  return fallback;
}