"use client";

import { useMemo, useState } from "react";

import CampaignFilters from "./CampaignFilters";
import CampaignForm from "./CampaignForm";
import CampaignStatusTimeline from "./CampaignStatusTimeline";
import CampaignTable from "./CampaignTable";

import {
  useCampaigns,
} from "../hooks/useCampaigns";

import type {
  Campaign,
  CampaignFilters as CampaignFiltersType,
  CampaignStatus,
} from "../types";

export default function CampaignPage() {
  const [filters, setFilters] =
    useState<CampaignFiltersType>({});

  const {
    campaigns,
    loading,
    error,
    reload: onReload,
    addCampaign: onCreate,
    editCampaign: onUpdate,
    changeStatus: onUpdateStatus,
  } = useCampaigns(filters);

  const [showForm, setShowForm] =
    useState(false);

  const [selectedCampaign, setSelectedCampaign] =
    useState<Campaign | null>(null);

  const [activeCampaignId, setActiveCampaignId] =
    useState<string | null>(null);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const searchMatch = !filters.search?.trim() || (() => {
        const term = filters.search.trim().toLowerCase();
        const nameMatch = (campaign.name || "").toLowerCase().includes(term);
        const codeMatch = (campaign.campaignCode || "").toLowerCase().includes(term);
        const cityMatch2 = (campaign.city || "").toLowerCase().includes(term);

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

        return nameMatch || codeMatch || cityMatch2 || leadMatch || managerMatch2;
      })();

      const cityMatch =
        !filters.city ||
        campaign.city
          .toLowerCase()
          .includes(
            filters.city.toLowerCase(),
          );

      const statusMatch =
        !filters.status ||
        campaign.status === filters.status;

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

      const startDateMatch =
        !filters.startDate ||
        new Date(campaign.startDate) >=
          new Date(filters.startDate);

      const endDateMatch =
        !filters.endDate ||
        new Date(campaign.endDate) <=
          new Date(filters.endDate);

      return (
        searchMatch &&
        cityMatch &&
        statusMatch &&
        managerMatch &&
        startDateMatch &&
        endDateMatch
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
  ) {
    setActiveCampaignId(campaign._id);
    try {
      setStatusError(null);
      await onUpdateStatus(
        campaign._id,
        status,
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
    <main className="min-h-screen bg-gray-50">
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

          <button
            type="button"
            onClick={handleAddCampaign}
            className="rounded-lg bg-[#8B2424] px-5 py-2.5 text-sm font-semibold text-[#F9DADA] shadow-sm transition hover:bg-[#A8383B] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#A8383B] focus:ring-offset-2"
          >
            + Create Campaign
          </button>
        </div>

        {/* FILTERS */}
        <div className="mb-6">
          <CampaignFilters
            filters={filters}
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
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}
    </main>
  );
}