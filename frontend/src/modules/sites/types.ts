export type MediaType =
  | "Billboard"
  | "Hoarding"
  | "Transit"
  | "Metro"
  | "Airport"
  | "Mall"
  | "Digital"
  | "Other";

export type AvailabilityStatus =
  | "Available"
  | "Booked";

export type MediaPlanStatus =
  | "Draft"
  | "Pending"
  | "Approved"
  | "Rejected";

export type ATRStatus = MediaPlanStatus;

export interface Site {
  _id: string;
  id?: string;

  clientName: string;

  salesPersonName?: string;
  salesPersonContact?: string;

  state?: string;
  city: string;
  location: string;

  mediaType: MediaType;
  quantity: number;

  startDate: string;
  endDate: string;
  duration: number;

  vendorName: string;
  vendorId?: string;

  availability: AvailabilityStatus;

  status: MediaPlanStatus;

  atrNo?: string;

  code?: string;
  siteCode?: string;
  address?: string;

  gps?: {
    lat: number;
    lng: number;
  };

  sizeWidth?: number;
  sizeHeight?: number;
  baseCostPerDay?: number;

  photos?: string[];

  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSiteData {
  clientName: string;

  salesPersonName?: string;
  salesPersonContact?: string;

  state?: string;
  city: string;
  location: string;

  mediaType: MediaType;
  quantity: number;

  startDate: string;
  endDate: string;
  duration: number;

  vendorName: string;
  vendorId?: string;

  availability: AvailabilityStatus;

  status: MediaPlanStatus;

  atrNo?: string;
}

export type UpdateSiteData =
  Partial<CreateSiteData>;

export interface SiteFilters {
  search?: string;

  state?: string;
  city?: string;

  vendorName?: string;
  salesPersonName?: string;

  mediaType?: MediaType;

  availability?: AvailabilityStatus;

  status?: MediaPlanStatus;
}