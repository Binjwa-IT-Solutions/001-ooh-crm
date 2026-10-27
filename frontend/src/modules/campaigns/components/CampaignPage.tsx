"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import CampaignFilters from "./CampaignFilters";
import CampaignForm from "./CampaignForm";
import CampaignStatusTimeline from "./CampaignStatusTimeline";
import CampaignTable, { isCampaignLocked } from "./CampaignTable";

import {
  useCampaigns,
} from "../hooks/useCampaigns";
import { useAuth } from "@/shared/auth/auth-context";

import type {
  Campaign,
  CampaignFilters as CampaignFiltersType,
  CampaignStatus,
} from "../types";

export default function CampaignPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("campaigns.manage");
  const searchParams = useSearchParams();
  const urlLeadId = searchParams.get("leadId") || "";
const shouldCreate = searchParams.get("create") === "true";
const urlSearch = searchParams.get("search") || "";

const [filters, setFilters] = useState<CampaignFiltersType>(() => ({
  search: urlSearch || undefined,
}));

useEffect(() => {
  if (urlSearch) {
    setFilters((prev) => ({ ...prev, search: urlSearch }));
  }
}, [urlSearch]);

  const apiQuery = useMemo(
    () => ({
      leadId: urlLeadId || undefined,
    }),
    [urlLeadId],
  );

  const {
    campaigns,
    loading,
    error,
    reload: onReload,
    addCampaign: onCreate,
    editCampaign: onUpdate,
    changeStatus: onUpdateStatus,
  } = useCampaigns(apiQuery);

  const [showForm, setShowForm] =
    useState(false);

  useEffect(() => {
    if (shouldCreate) {
      setShowForm(true);
    }
  }, [shouldCreate]);

  const [selectedCampaign, setSelectedCampaign] =
    useState<Campaign | null>(null);

  const [activeCampaignId, setActiveCampaignId] =
    useState<string | null>(null);

  const stateOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaigns) {
      const s = c.state?.trim();
      if (s && !map.has(s.toLowerCase())) {
        map.set(s.toLowerCase(), s);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [campaigns]);

  const cityOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaigns) {
      if (filters.state) {
        if ((c.state?.trim() || "").toLowerCase() !== filters.state.trim().toLowerCase()) {
          continue;
        }
      }
      const city = c.city?.trim();
      if (city && !map.has(city.toLowerCase())) {
        map.set(city.toLowerCase(), city);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [campaigns, filters.state]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const searchMatch = !filters.search?.trim() || (() => {
        const term = filters.search.trim().toLowerCase();
        const nameMatch = (campaign.name || "").toLowerCase().includes(term);
        const codeMatch = (campaign.campaignCode || "").toLowerCase().includes(term);
        const cityMatch2 = (campaign.city || "").toLowerCase().includes(term);
        const stateMatch2 = (campaign.state || "").toLowerCase().includes(term);
        const quotationNoMatch = (campaign.quotationNo || "").toLowerCase().includes(term);
        const quotationNameMatch = (campaign.quotationName || "").toLowerCase().includes(term);
        const piNoMatch = (campaign.piNo || "").toLowerCase().includes(term);

        let leadMatch = false;
        if (campaign.leadId) {
          if (typeof campaign.leadId === "object") {
            const comp = campaign.leadId.companyName || campaign.leadId.company || "";
            const person = campaign.leadId.contactPerson || campaign.leadId.name || "";
            leadMatch = comp.toLowerCase().includes(term) || person.toLowerCase().includes(term);
          } else {
            leadMatch = campaign.leadId.toLowerCase().includes(term);
          }
        }

        let managerMatch2 = false;
        if (campaign.assignedManager) {
          if (typeof campaign.assignedManager === "object") {
            const mName = campaign.assignedManager.name || "";
            managerMatch2 = mName.toLowerCase().includes(term);
          } else {
            managerMatch2 = campaign.assignedManager.toLowerCase().includes(term);
          }
        }

        return (
          nameMatch ||
          codeMatch ||
          cityMatch2 ||
          stateMatch2 ||
          quotationNoMatch ||
          quotationNameMatch ||
          piNoMatch ||
          leadMatch ||
          managerMatch2
        );
      })();

      const stateMatch =
        !filters.state ||
        (campaign.state || "").trim().toLowerCase() === filters.state.trim().toLowerCase();

      const cityMatch =
        !filters.city ||
        (campaign.city || "").trim().toLowerCase() === filters.city.trim().toLowerCase();

      const statusMatch =
        !filters.status || (() => {
          const fs = filters.status.trim().toLowerCase();
          const cs = (campaign.status || "").trim().toLowerCase();
          if (fs === "campaign end") {
            return cs === "campaign end" || cs === "complete" || cs === "completed";
          }
          if (fs === "in progress") {
            return cs === "in progress" || cs === "inprogress" || cs === "draft" || cs === "approved";
          }
          if (fs === "campaign live") {
            return cs === "campaign live";
          }
          if (fs === "rejected") {
            return cs === "rejected" || cs === "cancelled" || cs === "campaign rejected";
          }
          return cs === fs;
        })();

      const managerMatch =
        !filters.manager || (() => {
          if (typeof campaign.assignedManager === "object" && campaign.assignedManager) {
            return (
              campaign.assignedManager._id === filters.manager ||
              (campaign.assignedManager.name || "")
                .toLowerCase()
                .includes(filters.manager.toLowerCase())
            );
          }
          return campaign.assignedManager === filters.manager;
        })();

      return (
        searchMatch &&
        stateMatch &&
        cityMatch &&
        statusMatch &&
        managerMatch
      );
    });
  }, [campaigns, filters]);

  const activeCampaign = useMemo(() => {
    if (!filteredCampaigns.length) return null;
    if (activeCampaignId) {
      const match = filteredCampaigns.find((c) => c._id === activeCampaignId);
      if (match) return match;
    }
    return filteredCampaigns[0];
  }, [filteredCampaigns, activeCampaignId]);

  function handleAddCampaign() {
    setSelectedCampaign(null);
    setShowForm(true);
  }

  function handleEditCampaign(
    campaign: Campaign,
  ) {
    if (isCampaignLocked(campaign.status)) {
      return;
    }
    setActiveCampaignId(campaign._id);
    setSelectedCampaign(campaign);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setSelectedCampaign(null);
  }

  async function handleFormSuccess(
    data: Parameters<typeof onCreate>[0],
  ) {
    if (selectedCampaign?._id) {
      await onUpdate(selectedCampaign._id, data);
    } else {
      const created = await onCreate(data);
      if (created?._id) {
        setActiveCampaignId(created._id);
      }
    }

    setShowForm(false);
    setSelectedCampaign(null);
    await onReload();
  }

  const [statusError, setStatusError] =
    useState<string | null>(null);

  async function handleStatusChange(
    campaign: Campaign,
    status: CampaignStatus,
    reason?: string,
  ) {
    setActiveCampaignId(campaign._id);
    try {
      setStatusError(null);
      await onUpdateStatus(
        campaign._id,
        status,
        reason,
      );
      await onReload();
    } catch (err) {
      setStatusError(
        err instanceof Error
          ? err.message
          : "Failed to update campaign status.",
      );
    }
  }

  function resetFilters() {
    setFilters({});
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl p-6">
        {/* PAGE HEADER */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Campaigns
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage campaigns and their lifecycle.
            </p>
          </div>

          {canManage ? (
            <button
              type="button"
              onClick={handleAddCampaign}
              className="rounded-lg bg-[#8B2424] px-5 py-2.5 text-sm font-semibold text-[#F9DADA] shadow-sm transition hover:bg-[#A8383B] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#A8383B] focus:ring-offset-2"
            >
              + Create Campaign
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Read-Only Access
            </span>
          )}
        </div>

        {/* FILTERS */}
        <div className="mb-6">
          <CampaignFilters
            filters={filters}
            stateOptions={stateOptions}
            cityOptions={cityOptions}
            onChange={(nextFilters) =>
              setFilters({
                ...nextFilters,
                status: nextFilters.status as CampaignStatus | undefined,
              })
            }
            onReset={resetFilters}
          />
        </div>

        {/* LOAD ERROR */}
        {error && (
          <div className="mb-5 flex items-center rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-red-800">
                Failed to fetch campaigns
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* STATUS CHANGE ERROR */}
        {statusError && (
          <div className="mb-5 flex items-start justify-between rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-red-800">
                Status update failed
              </p>

              <p className="mt-1 whitespace-pre-line text-sm text-red-600">
                {statusError}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStatusError(null)}
              className="ml-4 flex-shrink-0 text-red-400 hover:text-red-600"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* TOOLBAR */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {filteredCampaigns.length}{" "}
            {filteredCampaigns.length === 1
              ? "campaign"
              : "campaigns"}
          </p>

          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-[#8B2424] hover:bg-[#F9DADA] hover:text-[#8B2424] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#8B2424]" />

            <p className="mt-4 text-sm text-gray-500">
              Loading campaigns...
            </p>
          </div>
        ) : (
          <>
            {/* TIMELINE */}
            {activeCampaign && (
              <div className="mb-6">
                <CampaignStatusTimeline
                  status={activeCampaign.status}
                  campaignCode={activeCampaign.campaignCode}
                  campaignName={activeCampaign.name}
                />
              </div>
            )}

            {/* TABLE */}
            <CampaignTable
              campaigns={filteredCampaigns}
              selectedCampaignId={activeCampaign?._id}
              canManage={canManage}
              onSelectCampaign={(campaign) =>
                setActiveCampaignId(campaign._id)
              }
              onEdit={handleEditCampaign}
              onStatusChange={handleStatusChange}
            />
          </>
        )}
      </div>

      {/* FORM */}
      {showForm && (
        <CampaignForm
          campaign={selectedCampaign}
          defaultLeadId={urlLeadId}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}
    </main>
  );
}