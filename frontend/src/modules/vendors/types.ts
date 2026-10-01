export type VendorStatus = "Active" | "Inactive" | "Blacklist";

export type RegistrationStatus =
  | "Registered"
  | "Unregistered"
  | "Pending";

export type VendorType =
  | "Individual"
  | "Partnership"
  | "Company"
  | "MSME"
  | "Others";

export type PaymentTerms =
  | "Net 30"
  | "Net 45"
  | "Manual";

export interface VendorContact {
  name: string;
  email: string;
  phone: string;
}

export interface VendorBankDetails {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
}

export interface VendorDocument {
  _id?: string;
  type: string;
  name: string;
  url?: string;
  fileKey?: string;
}

export interface Vendor {
  _id: string;
  id?: string;

  name: string;
  vendorType: VendorType;
  registrationStatus: RegistrationStatus;

  gstNumber?: string;
  panNumber?: string;

  msmeRegistered: boolean;
  msmeNumber?: string;
  udyamRegistration?: string;

  city?: string;
  state?: string;
  citiesServed: string[];

  primaryContact: VendorContact;
  secondaryContacts: VendorContact[];

  paymentTerms?: PaymentTerms;
  manualPaymentTerms?: string;

  bankDetails: VendorBankDetails;

  vendorRating?: number;

  documents: VendorDocument[];

  status: VendorStatus;

  createdAt?: string;
  updatedAt?: string;

  contactPerson?: string;
  siteOwnerName?: string;
  mobile?: string;
  email?: string;
  address?: string;
  pincode?: string;

  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  bankAccount?: string;
  bankAccountNumber?: string;

  ifsc?: string;
  ifscCode?: string;
  branchName?: string;
}

export interface VendorSite {
  _id: string;
  code: string;
  city: string;
  type: string;
  status: string;
}

export interface VendorFormData {
  name: string;
  vendorType: VendorType;
  registrationStatus: RegistrationStatus;

  gstNumber: string;
  panNumber: string;

  msmeRegistered: boolean;
  msmeNumber: string;
  udyamRegistration: string;

  city: string;
  state: string;
  citiesServed: string[];

  primaryContact: VendorContact;
  secondaryContacts: VendorContact[];

  paymentTerms: PaymentTerms;
  manualPaymentTerms?: string;

  bankDetails: VendorBankDetails;

  vendorRating?: number;

  documents: VendorDocument[];

  status: VendorStatus;
}

export interface VendorsResponse {
  data: Vendor[];
  message?: string;
  success?: boolean;
}

export interface VendorResponse {
  data: Vendor;
  message?: string;
  success?: boolean;
}

export interface VendorSitesResponse {
  data: VendorSite[];
  message?: string;
  success?: boolean;
}

export interface VendorFilters {
  search?: string;
  city?: string;
  state?: string;
  status?: VendorStatus;
  registrationStatus?: RegistrationStatus;
  vendorType?: VendorType;
}

export interface VendorFilterOptionsResponse {
  data: {
    cities: string[];
    states: string[];
    registrationStatuses: string[];
    vendorTypes: string[];
    statuses: string[];
  };
}