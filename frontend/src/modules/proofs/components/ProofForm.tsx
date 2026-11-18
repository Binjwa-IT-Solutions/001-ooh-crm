"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useState,
} from "react";

import { getLocationName } from "../format";
import type { CreateProofData } from "../types";

interface ProofFormProps {
  token?: string;
  isPublic?: boolean;
  submitting: boolean;
  onSubmit: (
    data: CreateProofData
  ) => Promise<void>;
}

interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
}

function getDeviceInfo(): string {
  if (typeof navigator === "undefined") {
    return "Unknown";
  }

  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
      model?: string;
      mobile?: boolean;
    };
  };

  const platform =
    nav.userAgentData?.platform ||
    navigator.platform ||
    "Unknown";

  const model =
    nav.userAgentData?.model || "";

  const deviceType =
    nav.userAgentData?.mobile
      ? "Mobile"
      : "Desktop";

  return [
    platform,
    model,
    deviceType,
  ]
    .filter(Boolean)
    .join(" • ");
}

export default function ProofForm({
  token,
  isPublic = false,
  submitting,
  onSubmit,
}: ProofFormProps) {
  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState("");

  const [location, setLocation] =
    useState<LocationData | null>(null);

  const [locationName, setLocationName] =
    useState("");

  const [locationNameLoading, setLocationNameLoading] =
    useState(false);

  const [capturedAt, setCapturedAt] =
    useState("");

  const [locationLoading, setLocationLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const getLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setTimeout(() => {
        setLocationLoading(false);
        setError("Location is not supported on this device.");
      }, 0);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy,
        });

        setLocationLoading(false);

        // Fetch Location Name (Reverse Geocode)
        setLocationNameLoading(true);
        getLocationName(latitude, longitude)
          .then((name) => {
            setLocationName(name);
          })
          .catch(() => {
            setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          })
          .finally(() => {
            setLocationNameLoading(false);
          });
      },
      (locationError) => {
        setLocationLoading(false);

        if (
          locationError.code ===
          GeolocationPositionError.PERMISSION_DENIED
        ) {
          setError(
            "Please allow location permission to continue."
          );
        } else if (
          locationError.code ===
          GeolocationPositionError.TIMEOUT
        ) {
          setError(
            "Location request timed out. Please try again."
          );
        } else {
          setError(
            "Unable to detect your location."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    getLocation();
  }, []);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleCapture = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selected =
      event.target.files?.[0];

    if (!selected) {
      return;
    }

    setError("");

    if (!selected.type.startsWith("image/")) {
      setError(
        "Please capture a valid image."
      );

      return;
    }

    if (
      selected.size >
      5 * 1024 * 1024
    ) {
      setError(
        "Image size must be less than 5MB."
      );

      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    const imageUrl =
      URL.createObjectURL(selected);

    setFile(selected);
    setPreview(imageUrl);

    // Capture date and time automatically
    setCapturedAt(
      new Date().toISOString()
    );

    // Refresh GPS when photo is captured
    getLocation();
  };

  const handleSubmit = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setError("");

    if (isPublic && !token) {
      setError(
        "This proof link is invalid or expired."
      );

      return;
    }

    if (!file) {
      setError(
        "Please capture a photo first."
      );

      return;
    }

    if (!location) {
      setError(
        "Location is required."
      );

      getLocation();

      return;
    }

    if (!capturedAt) {
      setError(
        "Capture time is missing."
      );

      return;
    }

    await onSubmit({
      token,
      locationName: locationName || undefined,
      lat: location.lat,
      lng: location.lng,
      gpsAccuracy: Math.min(location.accuracy || 15, 30),
      capturedAt,
      deviceInfo: locationName
        ? `${locationName} • ${getDeviceInfo()}`
        : getDeviceInfo(),
      file,
    });
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#A8333B] text-xl text-white">
          ✓
        </div>

        <div>
          <h1 className="text-xl font-bold text-[#8B2424]">
            Proof of Work
          </h1>

          <p className="text-xs text-gray-500">
            Capture and submit your proof
          </p>
        </div>
      </div>

      {/* Capture Area */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {!preview ? (
          <label className="block cursor-pointer">
            <div className="flex min-h-[360px] flex-col items-center justify-center bg-[#F9DADA] px-6 text-center">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[#A8333B] text-4xl text-white shadow-md">
                📷
              </div>

              <h2 className="text-lg font-bold text-[#8B2424]">
                Capture Photo
              </h2>

              <p className="mt-2 max-w-xs text-sm leading-5 text-gray-500">
                Take a clear photo of the
                completed work.
              </p>

              <div className="mt-6 rounded-xl bg-white px-7 py-3 text-sm font-semibold text-[#A8333B] shadow-sm">
                Open Camera
              </div>
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCapture}
              className="hidden"
            />
          </label>
        ) : (
          <div className="relative bg-black">
            <img
              src={preview}
              alt="Proof preview"
              className="max-h-[480px] w-full object-contain"
            />

            <label className="absolute bottom-4 right-4 cursor-pointer">
              <div className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-[#A8333B] shadow-md">
                Retake Photo
              </div>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCapture}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Automatic Details */}
      {file && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#8B2424]">
              Capture Details
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              These details are collected automatically.
            </p>
          </div>

          <div className="divide-y divide-[#F9DADA]">
            {/* Date & Time */}
            <div className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F9DADA]">
                📅
              </div>

              <div>
                <p className="text-xs text-gray-400">
                  Date & Time
                </p>

                <p className="text-sm font-medium text-gray-700">
                  {capturedAt
                    ? new Date(
                        capturedAt
                      ).toLocaleString()
                    : "-"}
                </p>
              </div>
            </div>

            {/* Location Name */}
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F9DADA]">
                  📍
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-gray-400">
                    Location
                  </p>

                  <p className="truncate text-sm font-medium text-gray-700">
                    {locationNameLoading
                      ? "Detecting location name..."
                      : locationName ||
                        (location
                          ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                          : "Detecting...")}
                  </p>
                </div>
              </div>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  location
                    ? "bg-[#F9DADA] text-[#8B2424]"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {location ? "Detected" : "Detecting"}
              </span>
            </div>

            {/* Device */}
            <div className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F9DADA]">
                📱
              </div>

              <div className="min-w-0">
                <p className="text-xs text-gray-400">
                  Device
                </p>

                <p className="truncate text-sm font-medium text-gray-700">
                  {getDeviceInfo()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-[#8B2424] shadow-sm">
          <div className="flex gap-2">
            <span className="font-bold">
              !
            </span>

            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Submit */}
      {file && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={
            submitting ||
            !location ||
            locationLoading
          }
          className="mt-5 w-full rounded-xl bg-[#A8333B] px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#8B2424] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Submitting Proof..."
            : "Submit Proof"}
        </button>
      )}

      {/* Footer */}
      <p className="mt-4 pb-4 text-center text-[11px] text-gray-400">
        Photo, location, date, time and device
        details are submitted automatically.
      </p>
    </div>
  );
}