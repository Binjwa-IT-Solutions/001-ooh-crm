"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Building2,
  Trash2,
  Plus,
  Search,
  ChevronDown,
  X,
  CreditCard,
  MapPin,
  Check,
} from "lucide-react";

import type {
  BankDetails,
  CampaignOption,
  CompanyProfile,
  PurchaseOrder,
  PurchaseOrderFormData,
  PurchaseOrderLineItem,
  VendorOption,
} from "../types";

import {
  getCampaignOptionsForPO,
  getVendorOptionsForPO,
} from "../api";
import { getVendors } from "@/modules/vendors/api";

interface Props {
  order: PurchaseOrder | null;
  saving: boolean;
  onBack: () => void;
  onSubmit: (
    data: PurchaseOrderFormData,
    issueImmediately?: boolean,
  ) => Promise<PurchaseOrder | boolean | null>;
  onSuccess: (savedOrder: PurchaseOrder) => void;
}

interface MediaItem {
  id: string;
  item: string;
  subItem: string;
  hsn: string;
  qty: number | string;
  unit: string;
  rate: number | string;
  discount: number | string;
  tax: number | string;
  amount?: number | string;
}

const PLACES_STORAGE_KEY = "mo_saved_places_of_supply";
const COMPANIES_STORAGE_KEY = "mo_saved_company_profiles";
const MEDIA_SERVICES_STORAGE_KEY = "mo_saved_media_services";

interface SavedMediaItem {
  item: string;
  subItem?: string;
  hsn?: string;
  rate?: number;
  tax?: number;
}

export default function PurchaseOrderForm({
  order,
  saving,
  onBack,
  onSubmit,
  onSuccess,
}: Props) {
  // Campaign state: manual input + suggestions
  const [campaignQuery, setCampaignQuery] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [campaignOpen, setCampaignOpen] = useState(false);
  const campaignRef = useRef<HTMLDivElement>(null);

  // Vendor state: manual input + suggestions
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorOpen, setVendorOpen] = useState(false);
  const vendorRef = useRef<HTMLDivElement>(null);

  // Place of Supply state: manual input + suggestions from saved history
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [savedPlaces, setSavedPlaces] = useState<string[]>([]);
  const [posOpen, setPosOpen] = useState(false);
  const posRef = useRef<HTMLDivElement>(null);

  // Bill From (Your Company) state: manual input + suggestions from saved profiles
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [savedCompanies, setSavedCompanies] = useState<CompanyProfile[]>([]);
  const [companyOpen, setCompanyOpen] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);

  // Vendor override address & GSTIN
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorGstin, setVendorGstin] = useState("");
  const [isEditingVendorAddr, setIsEditingVendorAddr] = useState(false);

  // PO Meta
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Media Items Table (all blank by default)
  const [items, setItems] = useState<MediaItem[]>([
    {
      id: "1",
      item: "",
      subItem: "",
      hsn: "",
      qty: "",
      unit: "PCS",
      rate: "",
      discount: "",
      tax: 18,
      amount: "",
    },
  ]);
  const [savedMediaServices, setSavedMediaServices] = useState<SavedMediaItem[]>([]);
  const [activeItemSuggestIndex, setActiveItemSuggestIndex] = useState<number | null>(null);
  const [customTaxRows, setCustomTaxRows] = useState<Record<number, boolean>>({});
  const itemSuggestRef = useRef<HTMLDivElement>(null);

  // Bank Details State (Replaced Notes)
  const [hasBankDetails, setHasBankDetails] = useState(true);
  const [bankName, setBankName] = useState("");
  const [personName, setPersonName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [branch, setBranch] = useState("");

  // Terms & Conditions
  const [showTerms, setShowTerms] = useState(true);
  const [terms, setTerms] = useState<string[]>([
    "Payment within 30 days.",
    "Installation as per agreed timeline.",
    "Any damage will be vendor responsibility.",
  ]);

  // Options from API
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [error, setError] = useState("");

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (campaignRef.current && !campaignRef.current.contains(event.target as Node)) {
        setCampaignOpen(false);
      }
      if (vendorRef.current && !vendorRef.current.contains(event.target as Node)) {
        setVendorOpen(false);
      }
      if (posRef.current && !posRef.current.contains(event.target as Node)) {
        setPosOpen(false);
      }
      if (companyRef.current && !companyRef.current.contains(event.target as Node)) {
        setCompanyOpen(false);
      }
      if (itemSuggestRef.current && !itemSuggestRef.current.contains(event.target as Node)) {
        setActiveItemSuggestIndex(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load saved places of supply, company profiles, and media services from localStorage
  useEffect(() => {
    try {
      const storedPlaces = localStorage.getItem(PLACES_STORAGE_KEY);
      if (storedPlaces) {
        const parsed = JSON.parse(storedPlaces);
        if (Array.isArray(parsed)) setSavedPlaces(parsed);
      }
      const storedCompanies = localStorage.getItem(COMPANIES_STORAGE_KEY);
      if (storedCompanies) {
        const parsed = JSON.parse(storedCompanies);
        if (Array.isArray(parsed)) setSavedCompanies(parsed);
      }
      const storedServices = localStorage.getItem(MEDIA_SERVICES_STORAGE_KEY);
      if (storedServices) {
        const parsed = JSON.parse(storedServices);
        if (Array.isArray(parsed)) setSavedMediaServices(parsed);
      }
    } catch (e) {
      console.error("Failed to load local storage PO presets", e);
    }
  }, []);

  // Load campaigns & vendors
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [cRes, vRes] = await Promise.allSettled([
          getCampaignOptionsForPO(),
          getVendorOptionsForPO().catch(() => getVendors()),
        ]);

        if (!mounted) return;

        if (cRes.status === "fulfilled" && cRes.value?.data) {
          setCampaigns(Array.isArray(cRes.value.data) ? cRes.value.data : []);
        }

        if (vRes.status === "fulfilled" && vRes.value?.data) {
          const raw = Array.isArray(vRes.value.data) ? vRes.value.data : [];
          setVendors(
            raw.map((v: any) => ({
              _id: String(v._id),
              name: v.name || "Vendor",
              state: v.state || "",
              city: v.city || (Array.isArray(v.citiesServed) ? v.citiesServed[0] : ""),
              address:
                v.address ||
                (v.city && v.state
                  ? `${v.city}, ${v.state}`
                  : Array.isArray(v.citiesServed) && v.citiesServed[0]
                    ? `${v.citiesServed[0]}, ${v.state || ""}`
                    : v.state || ""),
              gstin: v.gstin || v.gstNumber || "",
              status: v.status || "Active",
              contactPerson: v.contactPerson,
              mobile: v.mobile,
            })),
          );
        }
      } catch (err) {
        console.error("Error loading PO options:", err);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize or populate from existing order
  useEffect(() => {
    if (!order) {
      setPoNumber("");
      return;
    }

    setPoNumber(order.poNumber || "");
    if (order.poDate) {
      setPoDate(String(order.poDate).slice(0, 10));
    }

    // Campaign
    if (order.campaignName) {
      setCampaignQuery(order.campaignName);
    } else if (order.campaignId) {
      if (typeof order.campaignId === "object" && order.campaignId !== null) {
        setCampaignQuery(order.campaignId.name || "");
        setCampaignId(order.campaignId._id || "");
      } else {
        setCampaignId(String(order.campaignId));
      }
    }

    // Vendor
    if (order.vendorName) {
      setVendorQuery(order.vendorName);
    } else if (order.vendorId) {
      if (typeof order.vendorId === "object" && order.vendorId !== null) {
        setVendorQuery(order.vendorId.name || "");
        setVendorId(order.vendorId._id || "");
      } else {
        setVendorId(String(order.vendorId));
      }
    }

    if (order.companyName) setCompanyName(order.companyName);
    if (order.companyAddress) setCompanyAddress(order.companyAddress);
    if (order.companyGstin) setCompanyGstin(order.companyGstin);
    if (order.companyEmail) setCompanyEmail(order.companyEmail);

    if (order.placeOfSupply) setPlaceOfSupply(order.placeOfSupply);
    if (order.vendorAddress) setVendorAddress(order.vendorAddress);
    if (order.vendorGstin) setVendorGstin(order.vendorGstin);
    if (order.termsAndConditions?.length) setTerms(order.termsAndConditions);

    // Bank Details
    if (order.bankDetails) {
      setHasBankDetails(true);
      setBankName(order.bankDetails.bankName || "");
      setPersonName(order.bankDetails.personName || "");
      setAccountNumber(order.bankDetails.accountNumber || "");
      setIfsc(order.bankDetails.ifsc || "");
      setBranch(order.bankDetails.branch || "");
    }

    if (order.lineItems?.length) {
      const customTaxes: Record<number, boolean> = {};
      setItems(
        order.lineItems.map((li, idx) => {
          const taxVal = li.tax !== undefined ? li.tax : 18;
          if (![0, 5, 12, 18].includes(taxVal)) {
            customTaxes[idx] = true;
          }
          return {
            id: String(idx + 1),
            item: li.item || li.service || li.spaceType || "",
            subItem: li.description || li.city || "",
            hsn: li.hsn || "",
            qty: li.qty || li.days || 1,
            unit: li.unit || "PCS",
            rate: li.rate || li.ratePerDay || 0,
            discount: li.discount || 0,
            tax: taxVal,
          };
        }),
      );
      setCustomTaxRows(customTaxes);
    }
  }, [order]);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    const q = campaignQuery.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.city && c.city.toLowerCase().includes(q)),
    );
  }, [campaigns, campaignQuery]);

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    const q = vendorQuery.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.city && v.city.toLowerCase().includes(q)) ||
        (v.state && v.state.toLowerCase().includes(q)),
    );
  }, [vendors, vendorQuery]);

  // Place of Supply: Helper to save new place to storage
  const savePlaceOfSupply = (place: string) => {
    const trimmed = place.trim();
    if (!trimmed) return;
    setSavedPlaces((prev) => {
      const exists = prev.some((p) => p.toLowerCase() === trimmed.toLowerCase());
      if (exists) return prev;
      const updated = [trimmed, ...prev];
      try {
        localStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save place of supply", e);
      }
      return updated;
    });
  };

  const removeSavedPlace = (placeToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedPlaces((prev) => {
      const updated = prev.filter((p) => p.toLowerCase() !== placeToRemove.toLowerCase());
      try {
        localStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to update saved places", e);
      }
      return updated;
    });
  };

  const filteredPlacesOfSupply = useMemo(() => {
    const q = placeOfSupply.trim().toLowerCase();
    if (!q) return savedPlaces;
    return savedPlaces.filter((p) => p.toLowerCase().includes(q));
  }, [savedPlaces, placeOfSupply]);

  // Company Profile: Helper to save profile to storage
  const saveCompanyProfile = (profile: CompanyProfile) => {
    const name = profile.companyName?.trim();
    if (!name) return;
    setSavedCompanies((prev) => {
      const filtered = prev.filter((c) => c.companyName?.trim().toLowerCase() !== name.toLowerCase());
      const updated = [profile, ...filtered];
      try {
        localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save company profile", e);
      }
      return updated;
    });
  };

  const removeSavedCompany = (companyNameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedCompanies((prev) => {
      const updated = prev.filter((c) => c.companyName?.trim().toLowerCase() !== companyNameToRemove.toLowerCase());
      try {
        localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to remove saved company", e);
      }
      return updated;
    });
  };

  const handleSelectCompany = (comp: CompanyProfile) => {
    setCompanyName(comp.companyName || "");
    setCompanyAddress(comp.companyAddress || "");
    setCompanyGstin(comp.companyGstin || "");
    setCompanyEmail(comp.companyEmail || "");
    setCompanyOpen(false);
  };

  const filteredCompanies = useMemo(() => {
    const q = companyName.trim().toLowerCase();
    if (!q) return savedCompanies;
    return savedCompanies.filter((c) => (c.companyName || "").toLowerCase().includes(q));
  }, [savedCompanies, companyName]);

  // Selected vendor object
  const selectedVendor = useMemo(() => {
    return (
      vendors.find((v) => v._id === vendorId) ||
      vendors.find((v) => v.name.toLowerCase() === vendorQuery.toLowerCase().trim())
    );
  }, [vendors, vendorId, vendorQuery]);

  const displayVendorAddress =
    vendorAddress ||
    selectedVendor?.address ||
    (selectedVendor?.city && selectedVendor?.state
      ? `${selectedVendor.city}, ${selectedVendor.state}`
      : selectedVendor?.state || "");

  const displayVendorGstin =
    vendorGstin || selectedVendor?.gstin || (selectedVendor as any)?.gstNumber || "";

  // Auto-fill address and GSTIN into state when vendor matches
  useEffect(() => {
    if (!selectedVendor) return;
    const addr =
      selectedVendor.address ||
      (selectedVendor.city && selectedVendor.state
        ? `${selectedVendor.city}, ${selectedVendor.state}`
        : selectedVendor.state || "");
    const gst = selectedVendor.gstin || (selectedVendor as any)?.gstNumber || "";
    if (addr && !vendorAddress) {
      setVendorAddress(addr);
    }
    if (gst && !vendorGstin) {
      setVendorGstin(gst);
    }
  }, [selectedVendor]);

  // Calculations
  const calculatedItems = useMemo(() => {
    return items.map((it) => {
      const q = it.qty === "" ? 0 : Number(it.qty) || 0;
      const r = it.rate === "" ? 0 : Number(it.rate) || 0;
      const d = it.discount === "" ? 0 : Number(it.discount) || 0;
      const t = it.tax === "" ? 18 : Number(it.tax) || 0;

      const autoAmount = Math.max(0, q * r - d);

      return {
        ...it,
        numericQty: q,
        numericRate: r,
        numericDiscount: d,
        numericTax: t,
        amount: autoAmount,
        numericAmount: autoAmount,
      };
    });
  }, [items]);

  const subtotal = useMemo(() => {
    return calculatedItems.reduce((acc, curr) => acc + curr.numericAmount, 0);
  }, [calculatedItems]);

  const gstAmount = useMemo(() => {
    return Math.round(
      calculatedItems.reduce(
        (acc, it) => acc + (it.numericAmount * it.numericTax) / 100,
        0,
      ),
    );
  }, [calculatedItems]);

  const totalAmount = subtotal + gstAmount;

  // Media services storage helpers
  const saveMediaServices = (itemsToSave: MediaItem[]) => {
    const valid = itemsToSave.filter((it) => it.item.trim().length > 0);
    if (!valid.length) return;

    setSavedMediaServices((prev) => {
      let updated = [...prev];
      valid.forEach((it) => {
        const name = it.item.trim();
        updated = updated.filter(
          (s) => s.item.toLowerCase() !== name.toLowerCase(),
        );
        updated.unshift({
          item: name,
          subItem: it.subItem.trim() || undefined,
          hsn: it.hsn.trim() || undefined,
          rate: it.rate ? Number(it.rate) : undefined,
          tax: it.tax !== "" ? Number(it.tax) : undefined,
        });
      });
      const finalItems = updated.slice(0, 50);
      try {
        localStorage.setItem(MEDIA_SERVICES_STORAGE_KEY, JSON.stringify(finalItems));
      } catch (e) {
        console.error("Failed to save media services", e);
      }
      return finalItems;
    });
  };

  const removeSavedMediaService = (nameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedMediaServices((prev) => {
      const updated = prev.filter(
        (s) => s.item.toLowerCase() !== nameToRemove.toLowerCase(),
      );
      try {
        localStorage.setItem(MEDIA_SERVICES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to update saved media services", e);
      }
      return updated;
    });
  };

  // Items handlers
  const handleAddItem = () => {
    const nextId = String(Date.now());
    setItems((prev) => [
      ...prev,
      {
        id: nextId,
        item: "",
        subItem: "",
        hsn: "",
        qty: "",
        unit: "PCS",
        rate: "",
        discount: "",
        tax: 18,
        amount: "",
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof MediaItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTerm = () => {
    setTerms((prev) => [...prev, "New term and condition."]);
  };

  const handleUpdateTerm = (index: number, val: string) => {
    setTerms((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const handleRemoveTerm = (index: number) => {
    setTerms((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit handler
  const handleSave = async (issueImmediately: boolean) => {
    setError("");

    if (!vendorQuery.trim() && !vendorId) {
      setError("Please specify or select a Vendor.");
      return;
    }

    if (!items.length) {
      setError("Please add at least one line item.");
      return;
    }

    const lineItems: PurchaseOrderLineItem[] = calculatedItems.map((ci) => ({
      item: ci.item,
      service: ci.item,
      description: ci.subItem,
      city: ci.subItem,
      hsn: ci.hsn,
      qty: ci.numericQty,
      unit: ci.unit,
      rate: ci.numericRate,
      discount: ci.numericDiscount,
      tax: ci.numericTax,
      amount: ci.numericAmount,
      days: 1,
      ratePerDay: ci.numericRate,
    }));

    const bankDetailsPayload: BankDetails | null = hasBankDetails
      ? {
          bankName: bankName.trim(),
          personName: personName.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.trim(),
          branch: branch.trim(),
        }
      : null;

    // Auto-save place of supply to persistent storage
    if (placeOfSupply.trim()) {
      savePlaceOfSupply(placeOfSupply.trim());
    }

    // Auto-save company profile to persistent storage
    if (companyName.trim()) {
      saveCompanyProfile({
        companyName: companyName.trim(),
        companyAddress: companyAddress.trim(),
        companyGstin: companyGstin.trim(),
        companyEmail: companyEmail.trim(),
      });
    }

    // Auto-save media services to persistent storage
    saveMediaServices(calculatedItems);

    const payload: PurchaseOrderFormData = {
      poNumber:
        poNumber.trim() ||
        `MO-PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      poDate,
      vendorId: vendorId || undefined,
      vendorName: vendorQuery.trim(),
      campaignId: campaignId || undefined,
      campaignName: campaignQuery.trim(),
      placeOfSupply: placeOfSupply.trim(),
      vendorAddress: displayVendorAddress,
      vendorGstin: displayVendorGstin,
      companyName: companyName.trim() || undefined,
      companyAddress: companyAddress.trim() || undefined,
      companyGstin: companyGstin.trim() || undefined,
      companyEmail: companyEmail.trim() || undefined,
      lineItems,
      subtotal,
      gstRate: items[0]?.tax ? Number(items[0].tax) : 18,
      gstAmount,
      totalAmount,
      bankDetails: bankDetailsPayload,
      termsAndConditions: terms.filter((t) => t.trim().length > 0),
      status: issueImmediately ? "Issued" : "Draft",
    };

    const res = await onSubmit(payload, issueImmediately);
    if (res && typeof res === "object") {
      onSuccess(res);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {order ? "Edit Purchase Order" : "Create Purchase Order"}
            </h1>
            <p className="text-xs text-gray-500">
              Add vendor, campaign details, media items and bank details
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition disabled:opacity-50"
          >
            Save as Draft
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="rounded-xl bg-[#A8333B] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#8B2424] transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Issue Purchase Order"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* 3 Top Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Bill From (Your Company) */}
        <div
          ref={companyRef}
          className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Bill From (Your Company)
            </p>
            {savedCompanies.length > 0 && (
              <button
                type="button"
                onClick={() => setCompanyOpen(!companyOpen)}
                className="text-xs font-bold text-[#A8333B] hover:underline flex items-center gap-1"
              >
                Saved ({savedCompanies.length})
                <ChevronDown className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Company Name with suggestions dropdown */}
          <div className="relative">
            <input
              type="text"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setCompanyOpen(true);
              }}
              onFocus={() => {
                if (savedCompanies.length > 0) setCompanyOpen(true);
              }}
              placeholder="Your Company Name"
              className="w-full font-bold text-gray-900 border-b border-gray-200 pb-1.5 text-sm outline-none focus:border-[#A8333B] placeholder:text-gray-400 placeholder:font-normal"
            />

            {/* Suggestions dropdown for saved companies */}
            {companyOpen && (
              <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                  <span>Saved Company Profiles</span>
                  <span className="text-[10px] font-normal text-gray-400">click to load</span>
                </div>

                {filteredCompanies.map((c, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectCompany(c)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs cursor-pointer hover:bg-[#FDE8E8] group transition"
                  >
                    <div className="overflow-hidden">
                      <p className="font-bold text-gray-900 group-hover:text-[#A8333B] truncate">
                        {c.companyName}
                      </p>
                      {c.companyGstin && (
                        <p className="text-[10px] text-gray-500 font-mono">
                          GSTIN: {c.companyGstin}
                        </p>
                      )}
                      {c.companyAddress && (
                        <p className="text-[10px] text-gray-400 truncate max-w-[200px]">
                          {c.companyAddress}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      title="Remove from saved companies"
                      onClick={(e) => removeSavedCompany(c.companyName || "", e)}
                      className="text-gray-300 hover:text-red-500 p-1 rounded"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {!filteredCompanies.length && (
                  <div className="px-3 py-2 text-xs text-gray-500 italic">
                    {companyName.trim()
                      ? `"${companyName}" will be saved once you save the PO.`
                      : "No saved companies. Type details manually."}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Company Address */}
          <div className="mt-2.5">
            <textarea
              rows={2}
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="Address (Floor, Building, City, State, Pincode)"
              className="w-full text-xs text-gray-700 leading-relaxed border border-gray-200 rounded-lg p-2 outline-none focus:border-[#A8333B] placeholder:text-gray-400 resize-none"
            />
          </div>

          {/* GSTIN & Email */}
          <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">
                GSTIN
              </label>
              <input
                type="text"
                value={companyGstin}
                onChange={(e) => setCompanyGstin(e.target.value)}
                placeholder="230RHPS3516P1ZZ"
                className="w-full text-xs text-gray-700 font-mono border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#A8333B]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">
                Email
              </label>
              <input
                type="text"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="company@mail.com"
                className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#A8333B]"
              />
            </div>
          </div>
        </div>

        {/* Ship From (Vendor Address) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Ship From (Vendor Address)
            </p>
            <button
              type="button"
              onClick={() => setIsEditingVendorAddr(!isEditingVendorAddr)}
              className="text-xs font-semibold text-[#A8333B] hover:underline"
            >
              {isEditingVendorAddr ? "Done" : "Change"}
            </button>
          </div>

          <h2 className="mt-2 text-base font-bold text-gray-900 truncate">
            {vendorQuery || selectedVendor?.name || "Vendor Name"}
          </h2>

          {isEditingVendorAddr ? (
            <div className="mt-2 space-y-2">
              <textarea
                rows={2}
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
                placeholder="Vendor Address"
                className="w-full text-xs text-gray-800 leading-relaxed border border-gray-200 rounded-lg p-2 outline-none focus:border-[#A8333B] resize-none"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">GSTIN :</span>
                <input
                  type="text"
                  value={vendorGstin}
                  onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
                  placeholder="Enter GSTIN"
                  className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-mono text-gray-800 outline-none focus:border-[#A8333B]"
                />
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                {displayVendorAddress || (
                  <span className="text-gray-400 italic">No address specified</span>
                )}
              </p>
              <p className="mt-2 text-xs text-gray-700">
                <span className="font-semibold text-gray-900">GSTIN :</span>{" "}
                <span className="font-mono text-gray-800 font-medium">
                  {displayVendorGstin || (
                    <span className="text-gray-400 italic font-normal">Not specified</span>
                  )}
                </span>
              </p>
            </>
          )}
        </div>

        {/* Invoice Details */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Invoice Details
          </p>

          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700">
                PO Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Auto-generated on vendor selection"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 focus:border-[#A8333B] focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">
                PO Date <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-[#A8333B] outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selectors Row: Campaign, Vendor, Place of Supply with Manual Writing & Suggestions */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Campaign: Manual Input with Filtered Suggestions */}
        <div ref={campaignRef} className="relative">
          <label className="mb-1.5 block text-xs font-bold text-gray-700">
            Campaign <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={campaignQuery}
              onChange={(e) => {
                setCampaignQuery(e.target.value);
                setCampaignId("");
                setCampaignOpen(true);
              }}
              onFocus={() => setCampaignOpen(true)}
              placeholder="Type manual or select campaign..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm text-gray-800 outline-none transition focus:border-[#A8333B] focus:ring-2 focus:ring-[#F9DADA]"
            />
            <button
              type="button"
              onClick={() => setCampaignOpen(!campaignOpen)}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Suggestions Dropdown */}
          {campaignOpen && (
            <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Campaign Suggestions (click to select or type manually)
              </div>
              {filteredCampaigns.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => {
                    setCampaignQuery(c.name);
                    setCampaignId(c._id);
                    setCampaignOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-800 hover:bg-[#FDE8E8] hover:text-[#A8333B] transition"
                >
                  <span className="font-semibold">{c.name}</span>
                  {c.city && (
                    <span className="text-[11px] text-gray-400">{c.city}</span>
                  )}
                </button>
              ))}

              {!filteredCampaigns.length && (
                <div className="px-3 py-2 text-xs text-gray-500 italic">
                  No matching campaigns. Custom &quot;{campaignQuery}&quot; will be used.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vendor: Manual Input with Filtered Suggestions */}
        <div ref={vendorRef} className="relative">
          <label className="mb-1.5 block text-xs font-bold text-gray-700">
            Vendor <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={vendorQuery}
              onChange={(e) => {
                const val = e.target.value;
                setVendorQuery(val);
                setVendorId("");
                setVendorOpen(true);
                if (val.trim() && !poNumber.trim()) {
                  const year = new Date().getFullYear();
                  setPoNumber(`MO-PO-${year}-${Math.floor(1000 + Math.random() * 9000)}`);
                }
              }}
              onFocus={() => setVendorOpen(true)}
              placeholder="Type manual or select vendor..."
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm text-gray-800 outline-none transition focus:border-[#A8333B] focus:ring-2 focus:ring-[#F9DADA]"
            />
            <button
              type="button"
              onClick={() => setVendorOpen(!vendorOpen)}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Suggestions Dropdown */}
          {vendorOpen && (
            <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Vendor Suggestions (click to auto-fill details)
              </div>
              {filteredVendors.map((v) => (
                <button
                  key={v._id}
                  type="button"
                  onClick={() => {
                    setVendorQuery(v.name);
                    setVendorId(v._id);
                    const addr =
                      v.address ||
                      (v.city && v.state
                        ? `${v.city}, ${v.state}`
                        : v.state || "");
                    const gst = v.gstin || (v as any).gstNumber || "";
                    setVendorAddress(addr);
                    setVendorGstin(gst);
                    if (!poNumber.trim()) {
                      const year = new Date().getFullYear();
                      setPoNumber(`MO-PO-${year}-${Math.floor(1000 + Math.random() * 9000)}`);
                    }
                    setVendorOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-gray-800 hover:bg-[#FDE8E8] hover:text-[#A8333B] transition"
                >
                  <div>
                    <div className="font-semibold">{v.name}</div>
                    <div className="text-[11px] text-gray-400">
                      {v.address || (v.city ? `${v.city}, ${v.state || ""}` : v.state || "")}
                    </div>
                  </div>
                  {(v.gstin || (v as any).gstNumber) && (
                    <span className="text-[10px] text-gray-400 font-mono">
                      GSTIN: {v.gstin || (v as any).gstNumber}
                    </span>
                  )}
                </button>
              ))}

              {!filteredVendors.length && (
                <div className="px-3 py-2 text-xs text-gray-500 italic">
                  No matching vendors. Custom &quot;{vendorQuery}&quot; will be used.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Place of Supply: Manual Writing + Suggestions from Saved History */}
        <div ref={posRef} className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-gray-700">
              Place of Supply (City & State) <span className="text-red-500">*</span>
            </label>
            {savedPlaces.length > 0 && (
              <span className="text-[11px] text-gray-400">
                {savedPlaces.length} saved
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={placeOfSupply}
              onChange={(e) => {
                setPlaceOfSupply(e.target.value);
                setPosOpen(true);
              }}
              onFocus={() => {
                if (savedPlaces.length > 0) setPosOpen(true);
              }}
              placeholder="e.g. Indore, Madhya Pradesh (manual type or choose saved)"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm text-gray-800 outline-none transition focus:border-[#A8333B] focus:ring-2 focus:ring-[#F9DADA]"
            />
            <button
              type="button"
              onClick={() => setPosOpen(!posOpen)}
              className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
            >
              <MapPin className="h-4 w-4" />
            </button>
          </div>

          {/* Place of Supply Suggestions Dropdown with Saved Places */}
          {posOpen && (
            <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                <span>Saved Places of Supply</span>
                {savedPlaces.length > 0 && (
                  <span className="text-[10px] text-gray-400 font-normal">click to select</span>
                )}
              </div>

              {filteredPlacesOfSupply.map((place, idx) => {
                const isSelected = placeOfSupply.toLowerCase() === place.toLowerCase();
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setPlaceOfSupply(place);
                      setPosOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-[#FDE8E8] text-[#A8333B] font-bold"
                        : "text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      <span>{place}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSelected && <Check className="h-3.5 w-3.5 text-[#A8333B]" />}
                      <button
                        type="button"
                        title="Remove from saved suggestions"
                        onClick={(e) => removeSavedPlace(place, e)}
                        className="text-gray-300 hover:text-red-500 p-1 rounded"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {!filteredPlacesOfSupply.length && (
                <div className="px-3 py-2 text-xs text-gray-500 italic">
                  {placeOfSupply.trim()
                    ? `No matching saved places. "${placeOfSupply}" will be saved once you create the PO.`
                    : "No saved places yet. Type city & state manually and it will be saved for next time."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Items / Media Services Card */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        {/* Table Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-900">
            Items / Media Services
          </h2>

          <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center gap-1.5 rounded-xl border border-[#A8333B] bg-white px-4 py-2 text-xs font-bold text-[#A8333B] hover:bg-[#FDE8E8] transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-center w-12">NO.</th>
                <th className="px-4 py-3 min-w-[200px]">ITEMS</th>
                <th className="px-4 py-3 w-28">HSN</th>
                <th className="px-4 py-3 w-28">QTY</th>
                <th className="px-4 py-3 w-32">RATE (₹)</th>
                <th className="px-4 py-3 w-24">DISCOUNT</th>
                <th className="px-4 py-3 w-24">TAX</th>
                <th className="px-4 py-3 w-32">AMOUNT (₹)</th>
                <th className="px-4 py-3 text-center w-16"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-sm">
              {calculatedItems.map((item, index) => (
                <tr key={item.id} className="transition hover:bg-gray-50/50">
                  {/* NO. */}
                  <td className="px-4 py-3.5 text-center font-bold text-gray-500">
                    {index + 1}
                  </td>

                  {/* ITEMS */}
                  <td className="px-4 py-3.5 relative">
                    <div ref={activeItemSuggestIndex === index ? itemSuggestRef : undefined}>
                      <input
                        type="text"
                        value={item.item}
                        onChange={(e) => {
                          handleUpdateItem(index, "item", e.target.value);
                          setActiveItemSuggestIndex(index);
                        }}
                        onFocus={() => {
                          if (savedMediaServices.length > 0) {
                            setActiveItemSuggestIndex(index);
                          }
                        }}
                        placeholder="Item name (e.g. Hoarding, Bus Shelter)"
                        className="w-full font-semibold text-gray-900 outline-none placeholder:text-gray-400 border-b border-transparent focus:border-gray-300 pb-0.5"
                      />

                      {/* Suggestions Dropdown for Media Services */}
                      {activeItemSuggestIndex === index && (
                        <div className="absolute left-4 z-40 mt-1 w-72 max-h-52 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
                          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                            <span>Saved Media Services</span>
                            {savedMediaServices.length > 0 && (
                              <span className="text-[10px] text-gray-400 font-normal">click to fill</span>
                            )}
                          </div>

                          {savedMediaServices
                            .filter(
                              (s) =>
                                !item.item.trim() ||
                                s.item.toLowerCase().includes(item.item.trim().toLowerCase()),
                            )
                            .map((s, sIdx) => (
                              <div
                                key={sIdx}
                                onClick={() => {
                                  handleUpdateItem(index, "item", s.item);
                                  if (s.subItem) handleUpdateItem(index, "subItem", s.subItem);
                                  if (s.hsn) handleUpdateItem(index, "hsn", s.hsn);
                                  if (s.rate) handleUpdateItem(index, "rate", s.rate);
                                  if (s.tax !== undefined) handleUpdateItem(index, "tax", s.tax);
                                  setActiveItemSuggestIndex(null);
                                }}
                                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs cursor-pointer hover:bg-[#FDE8E8] group transition"
                              >
                                <div className="overflow-hidden">
                                  <p className="font-bold text-gray-900 group-hover:text-[#A8333B] truncate">
                                    {s.item}
                                  </p>
                                  {(s.subItem || s.hsn || s.rate) && (
                                    <p className="text-[10px] text-gray-400 truncate">
                                      {s.subItem ? `${s.subItem} · ` : ""}
                                      {s.hsn ? `HSN: ${s.hsn} · ` : ""}
                                      {s.rate ? `₹${s.rate}` : ""}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  title="Remove from saved"
                                  onClick={(e) => removeSavedMediaService(s.item, e)}
                                  className="text-gray-300 hover:text-red-500 p-1 rounded"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}

                          {!savedMediaServices.filter(
                            (s) =>
                              !item.item.trim() ||
                              s.item.toLowerCase().includes(item.item.trim().toLowerCase()),
                          ).length && (
                            <div className="px-2 py-1.5 text-xs text-gray-400 italic">
                              {item.item.trim()
                                ? `"${item.item}" will be saved once you save the PO.`
                                : "No saved services yet. Type item manually."}
                            </div>
                          )}
                        </div>
                      )}

                      <input
                        type="text"
                        value={item.subItem}
                        onChange={(e) => handleUpdateItem(index, "subItem", e.target.value)}
                        placeholder="Location / Subtitle (optional)"
                        className="mt-1 w-full text-xs text-gray-500 outline-none placeholder:text-gray-300 border-b border-transparent focus:border-gray-200 pb-0.5"
                      />
                    </div>
                  </td>

                  {/* HSN */}
                  <td className="px-4 py-3.5">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={(e) => handleUpdateItem(index, "hsn", e.target.value)}
                        placeholder="HSN (Optional)"
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-[#A8333B]"
                      />
                    </div>
                  </td>

                  {/* QTY */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        value={item.qty}
                        onChange={(e) => handleUpdateItem(index, "qty", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0"
                        className="w-14 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-[#A8333B]"
                      />
                      <span className="text-xs font-bold text-gray-400">PCS</span>
                    </div>
                  </td>

                  {/* RATE (₹) */}
                  <td className="px-4 py-3.5">
                    <input
                      type="number"
                      min="0"
                      value={item.rate}
                      onChange={(e) => handleUpdateItem(index, "rate", e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-[#A8333B]"
                    />
                  </td>

                  {/* DISCOUNT */}
                  <td className="px-4 py-3.5">
                    <input
                      type="number"
                      min="0"
                      value={item.discount}
                      onChange={(e) => handleUpdateItem(index, "discount", e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-[#A8333B]"
                    />
                  </td>

                  {/* TAX with Manual option */}
                  <td className="px-4 py-3.5">
                    {customTaxRows[index] ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.tax}
                          onChange={(e) => handleUpdateItem(index, "tax", e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="%"
                          className="w-14 rounded-lg border border-[#A8333B] px-1.5 py-1 text-xs font-bold text-gray-800 outline-none"
                        />
                        <span className="text-xs font-bold text-gray-500">%</span>
                        <button
                          type="button"
                          title="Switch back to presets"
                          onClick={() =>
                            setCustomTaxRows((prev) => ({ ...prev, [index]: false }))
                          }
                          className="text-[11px] text-gray-400 hover:text-gray-700 px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        value={[0, 5, 12, 18].includes(Number(item.tax)) ? Number(item.tax) : "manual"}
                        onChange={(e) => {
                          if (e.target.value === "manual") {
                            setCustomTaxRows((prev) => ({ ...prev, [index]: true }));
                          } else {
                            handleUpdateItem(index, "tax", Number(e.target.value));
                          }
                        }}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-700 outline-none focus:border-[#A8333B]"
                      >
                        <option value="18">18%</option>
                        <option value="12">12%</option>
                        <option value="5">5%</option>
                        <option value="0">0%</option>
                        <option value="manual">Manual %</option>
                      </select>
                    )}
                  </td>

                  {/* AMOUNT (₹) */}
                  <td className="px-4 py-3.5 font-bold text-gray-900">
                    ₹{item.amount.toLocaleString("en-IN")}
                  </td>

                  {/* ACTION */}
                  <td className="px-4 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={calculatedItems.length <= 1}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add item row button */}
        <div className="border-t border-dashed border-gray-200 p-3 text-center bg-gray-50/40">
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#A8333B] hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </button>
        </div>

        {/* Bottom Section: Bank Details & Terms on Left (Notes Removed), Totals on Right */}
        <div className="grid grid-cols-1 gap-6 border-t border-gray-200 p-6 md:grid-cols-2">
          {/* Left Column: Bank Details & Terms & Conditions */}
          <div className="space-y-4">
            {/* Bank Details (Replaces Notes with option to add or remove) */}
            <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#A8333B]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
                    Bank Details
                  </span>
                </div>

                {hasBankDetails ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHasBankDetails(false);
                      setBankName("");
                      setPersonName("");
                      setAccountNumber("");
                      setIfsc("");
                      setBranch("");
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Bank Details
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setHasBankDetails(true);
                      setBankName("");
                      setPersonName("");
                      setAccountNumber("");
                      setIfsc("");
                      setBranch("");
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#A8333B] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Bank Details
                  </button>
                )}
              </div>

              {hasBankDetails ? (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Bank Name */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank, SBI, ICICI"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-[#A8333B]"
                    />
                  </div>

                  {/* Person Name (Account Holder) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600">
                      Person / Account Name
                    </label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder="e.g. Account Holder / Beneficiary Name"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-[#A8333B]"
                    />
                  </div>

                  {/* Account Number */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="e.g. 50200012345678"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-800 font-mono outline-none focus:border-[#A8333B]"
                    />
                  </div>

                  {/* IFSC */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value)}
                      placeholder="e.g. HDFC0001234"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-800 font-mono outline-none focus:border-[#A8333B]"
                    />
                  </div>

                  {/* Branch */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-gray-600">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. Vijay Nagar Branch, Indore"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-[#A8333B]"
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-400 italic">
                  No bank details included in this purchase order. Click &quot;+ Add Bank Details&quot; to specify.
                </p>
              )}
            </div>

            {/* Terms & Conditions */}
            <div className="rounded-xl border border-gray-200 p-3.5 bg-white">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowTerms(!showTerms)}
                  className="flex items-center gap-1 text-xs font-bold text-[#A8333B]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Terms & Conditions
                </button>
                {showTerms && (
                  <button
                    type="button"
                    onClick={handleAddTerm}
                    className="text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                  >
                    + Add Condition
                  </button>
                )}
              </div>

              {showTerms && (
                <div className="mt-2.5 space-y-2">
                  {terms.map((term, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">
                        {i + 1}.
                      </span>
                      <input
                        type="text"
                        value={term}
                        onChange={(e) => handleUpdateTerm(i, e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-[#A8333B]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveTerm(i)}
                        className="text-gray-300 hover:text-red-500 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Totals Summary */}
          <div className="flex flex-col justify-end items-end">
            <div className="w-full max-w-xs space-y-2.5 rounded-xl bg-gray-50/70 p-4 border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-medium">Subtotal</span>
                <span className="font-semibold text-gray-900">
                  ₹ {subtotal.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-medium">GST (18%)</span>
                <span className="font-semibold text-gray-900">
                  ₹ {gstAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">
                  Total Amount
                </span>
                <span className="text-base font-bold text-[#A8333B]">
                  ₹ {totalAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}