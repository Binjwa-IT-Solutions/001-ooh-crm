"use client";

import type { Vendor, VendorSite } from "../types";

interface Props {
  vendor: Vendor;
  sites: VendorSite[];
  loading: boolean;
  onClose: () => void;
}

export default function VendorSitesModal({
  vendor,
  sites,
  loading,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-[#EEEEF3] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#1F2937]">
              Linked Sites
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              Vendor: {vendor.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-2xl font-bold text-gray-500 hover:bg-[#F9DADA] hover:text-[#8B2424]"
          >
            ×
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#F9DADA] border-t-[#8B2424]" />
              <p className="mt-4 text-sm text-[#667085]">
                Loading sites...
              </p>
            </div>
          ) : !sites.length ? (
            <div className="py-12 text-center">
              <p className="font-bold text-[#1F2937]">
                No linked sites
              </p>

              <p className="mt-1 text-sm text-[#667085]">
                No sites are linked with this vendor.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sites.map((site) => (
                <div
                  key={site._id}
                  className="flex items-center justify-between rounded-xl border border-[#E8E8EC] p-4 hover:border-[#F0C7C7] hover:bg-[#FFF8F8]"
                >
                  <div>
                    <p className="text-sm font-bold text-[#1F2937]">
                      {site.code}
                    </p>

                    <p className="mt-1 text-xs text-[#667085]">
                      {site.city} · {site.type}
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600">
                    {site.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-[#EEEEF3] bg-[#FAFAFB] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#8B2424] bg-[#F9DADA] px-5 py-2.5 text-sm font-bold text-[#8B2424] hover:bg-[#8B2424] hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}