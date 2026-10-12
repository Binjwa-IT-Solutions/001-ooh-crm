import { api } from "@/shared/api/client";

import type {
  CreateProofData,
  GenerateProofLinkPayload,
  GenerateProofLinkResponse,
  Proof,
  ProofFilters,
  ProofStatus,
  ValidateProofLinkResponse,
} from "./types";

function getData<T>(response: any): T {
  return (
    response?.data?.data ??
    response?.data ??
    response
  ) as T;
}

export async function generateProofLink(
  payload?: GenerateProofLinkPayload
): Promise<GenerateProofLinkResponse> {
  const response = await api.post(
    "/api/proofs/link/generate",
    payload || {}
  );

  return getData<GenerateProofLinkResponse>(
    response
  );
}

export async function validateProofLink(
  token: string
): Promise<ValidateProofLinkResponse> {
  const response = await api.get(
    `/api/proofs/link/${token}`
  );

  return getData<ValidateProofLinkResponse>(
    response
  );
}

export async function createProof(
  data: CreateProofData
): Promise<Proof> {
  if (!data.token) {
    throw new Error(
      "Proof link is invalid or expired."
    );
  }

  const formData = new FormData();

  formData.append(
    "lat",
    String(data.lat)
  );

  formData.append(
    "lng",
    String(data.lng)
  );

  formData.append(
    "gpsAccuracy",
    String(data.gpsAccuracy)
  );

  formData.append(
    "capturedAt",
    data.capturedAt
  );

  if (data.locationName) {
    formData.append(
      "locationName",
      data.locationName
    );
  }

  if (data.deviceInfo) {
    formData.append(
      "deviceInfo",
      data.deviceInfo
    );
  }

  formData.append(
    "file",
    data.file
  );

  const response = await api.post(
    `/api/proofs/link/${data.token}`,
    formData
  );

  return getData<Proof>(response);
}

export interface ManualProofPayload {
  file: File;
  campaignId?: string;
  vendorId?: string;
  locationName?: string;
  lat?: number;
  lng?: number;
  gpsAccuracy?: number;
  capturedAt?: string;
  deviceInfo?: string;
}

export async function createManualProof(
  data: ManualProofPayload
): Promise<Proof> {
  const formData = new FormData();
  formData.append("lat", String(data.lat ?? 22.7196));
  formData.append("lng", String(data.lng ?? 75.8577));
  formData.append("gpsAccuracy", String(data.gpsAccuracy ?? 15));
  formData.append("capturedAt", data.capturedAt || new Date().toISOString());
  if (data.locationName) {
    formData.append("locationName", data.locationName);
  }
  if (data.campaignId) {
    formData.append("campaignId", data.campaignId);
  }
  if (data.vendorId) {
    formData.append("vendorId", data.vendorId);
  }
  if (data.deviceInfo) {
    formData.append("deviceInfo", data.deviceInfo);
  }
  formData.append("file", data.file);

  const response = await api.post("/api/proofs", formData);
  return getData<Proof>(response);
}

export async function getProofs(
  filters?: Partial<ProofFilters>
): Promise<Proof[]> {
  const params = new URLSearchParams();

  if (filters?.campaignId) {
    params.set(
      "campaignId",
      filters.campaignId
    );
  }

  if (filters?.vendorId) {
    params.set(
      "vendorId",
      filters.vendorId
    );
  }

  if (filters?.atrId) {
    params.set(
      "atrId",
      filters.atrId
    );
  }

  if (filters?.status) {
    params.set(
      "status",
      filters.status
    );
  }

  if (filters?.uploadedBy) {
    params.set(
      "uploadedBy",
      filters.uploadedBy
    );
  }

  const query = params.toString();

  const response = await api.get(
    query
      ? `/api/proofs?${query}`
      : "/api/proofs"
  );

  return getData<Proof[]>(response) || [];
}

export async function getTaskProofs(
  taskId: string
): Promise<Proof[]> {
  const response = await api.get(
    `/api/proofs/task/${taskId}`
  );

  return getData<Proof[]>(response) || [];
}

export async function reviewProof(
  id: string,
  status: Extract<
    ProofStatus,
    "Approved" | "Complete" | "Rejected"
  >,
  rejectionReason?: string
): Promise<Proof> {
  const response = await api.patch(
    `/api/proofs/${id}/review`,
    {
      status,
      rejectionReason,
    }
  );

  return getData<Proof>(response);
}

export async function getCampaignsByVendor(
  vendorId: string
): Promise<Array<{ _id: string; name: string; campaignCode?: string }>> {
  if (!vendorId) return [];
  const response = await api.get(
    `/api/proofs/vendor-campaigns/${vendorId}`
  );
  return getData<Array<{ _id: string; name: string; campaignCode?: string }>>(response) || [];
}

export interface SavedCampaignPow {
  _id: string;
  campaignId: string;
  campaignCode?: string;
  campaignName: string;
  status: "Complete" | "Rejected";
  locationName?: string;
  message?: string;
  savedAt: string;
}

export async function getAllCampaignPows(): Promise<SavedCampaignPow[]> {
  const response = await api.get("/api/proofs/campaign-pow");
  return getData<SavedCampaignPow[]>(response) || [];
}

export async function getCampaignPow(
  campaignId: string
): Promise<SavedCampaignPow | null> {
  if (!campaignId) return null;
  const response = await api.get(
    `/api/proofs/campaign-pow?campaignId=${campaignId}`
  );
  return getData<SavedCampaignPow | null>(response);
}

export async function syncCampaignPow(
  campaignId: string
): Promise<SavedCampaignPow> {
  const response = await api.post("/api/proofs/campaign-pow", { campaignId });
  return getData<SavedCampaignPow>(response);
}