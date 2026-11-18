export type ProofStatus =
  | "Pending"
  | "Approved"
  | "Complete"
  | "Rejected";

export interface Proof {
  _id: string;

  taskId?: string;
  campaignId?:
    | string
    | {
        _id: string;
        name: string;
        campaignCode?: string;
      };
  vendorId?:
    | string
    | {
        _id: string;
        name?: string;
        companyName?: string;
        contactPersonName?: string;
      };
  atrId?: string;

  originalImageKey: string;
  locationName?: string;

  watermarkedImageKey?: string;
  watermarkedAt?: string;

  gps: {
    lat: number;
    lng: number;
  };

  gpsAccuracy: number;

  // Geo-fence distance
  distanceFromSite?: number;

  capturedAt: string;

  uploadedBy?:
    | string
    | {
        _id: string;
        name?: string;
      };

  deviceInfo?: string;

  status: ProofStatus;

  rejectionReason?: string;

  reviewedBy?: string;
  reviewedAt?: string;

  uses?: number;
  maxUses?: number;
  remainingUses?: number;

  createdAt: string;
  updatedAt: string;
}

export interface CreateProofData {
  token?: string;

  locationName?: string;

  lat: number;
  lng: number;

  gpsAccuracy: number;

  capturedAt: string;

  deviceInfo?: string;

  file: File;
}

export interface ProofFilters {
  campaignId: string;
  vendorId: string;
  atrId: string;
  status: "" | ProofStatus;
  uploadedBy: string;
}

export interface GenerateProofLinkPayload {
  campaignId?: string;
  vendorId?: string;
}

export interface GenerateProofLinkResponse {
  token: string;
  link: string;
  maxUses: number;
  message: string;
}

export interface ValidateProofLinkResponse {
  valid: boolean;
  message?: string;
  uses?: number;
  maxUses?: number;
  remainingUses?: number;
  campaign?: {
    _id: string;
    name: string;
    campaignCode?: string;
  };
  vendor?: {
    _id: string;
    name?: string;
    companyName?: string;
    contactPersonName?: string;
  };
}