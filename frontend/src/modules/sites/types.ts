export type SiteType =
  | "Airport"
  | "Highway"
  | "Mall"
  | "Metro"
  | "Market"
  | "Other";

export type SiteStatus =
  | "Active"
  | "Maintenance"
  | "Inactive";

export interface SiteAvailability {
  available: boolean;
  bookedDates?: string[];
}

export interface Site {
  _id: string;
  id?: string;

  code: string;
  siteCode?: string;

  city: string;
  type: SiteType;
  address: string;

  gps: {
    lat: number;
    lng: number;
  };

  sizeWidth: number;
  sizeHeight: number;

  baseCostPerDay: number;

  vendorId?: string | null;

  status: SiteStatus;

  startDate: string | Date;
  endDate: string | Date;

  availability?: SiteAvailability;

  photos?: string[];
}

export interface CreateSiteData {
  city: string;
  type: SiteType;
  address: string;

  gps: {
    lat: number;
    lng: number;
  };

  sizeWidth: number;
  sizeHeight: number;

  baseCostPerDay: number;

  vendorId?: string | null;

  status?: SiteStatus;

  startDate: string;
  endDate: string;

  photos?: string[];
}

export interface SiteFilters {
  city?: string;
  type?: SiteType | "";
  status?: SiteStatus | "";
}