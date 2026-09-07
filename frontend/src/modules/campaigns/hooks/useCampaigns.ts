"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createCampaign,
  getCampaigns,
  updateCampaign,
  updateCampaignStatus,
} from "../api";

import type {
  Campaign,
  CampaignFilters,
  CampaignStatus,
  CreateCampaignPayload,
} from "../types";

export function useCampaigns(
  filters: CampaignFilters,
) {
  const [campaigns, setCampaigns] =
    useState<Campaign[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [updatingStatus, setUpdatingStatus] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const loadCampaigns =
    useCallback(async () => {
      try {
        setLoading(true);
        setError(null);

        const response =
          await getCampaigns(
            filters,
          );

        setCampaigns(
          response.data ?? [],
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load campaigns",
        );
      } finally {
        setLoading(false);
      }
    }, [filters]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const addCampaign =
    useCallback(
      async (
        payload: CreateCampaignPayload,
      ) => {
        try {
          setCreating(true);
          setError(null);

          const response =
            await createCampaign(
              payload,
            );

          setCampaigns(
            (current) => [
              response.data,
              ...current,
            ],
          );

          return response.data;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to create campaign";

          setError(message);

          throw error;
        } finally {
          setCreating(false);
        }
      },
      [],
    );

  const editCampaign =
    useCallback(
      async (
        id: string,
        payload: CreateCampaignPayload,
      ) => {
        try {
          setCreating(true);
          setError(null);

          const response =
            await updateCampaign(
              id,
              payload,
            );

          setCampaigns(
            (current) =>
              current.map((c) =>
                c._id === id ? response.data : c,
              ),
          );

          return response.data;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to update campaign";

          setError(message);

          throw error;
        } finally {
          setCreating(false);
        }
      },
      [],
    );

  const changeStatus =
    useCallback(
      async (
        id: string,
        status: CampaignStatus,
      ) => {
        try {
          setUpdatingStatus(
            true,
          );

          setError(null);

          const response =
            await updateCampaignStatus(
              id,
              status,
            );

          setCampaigns(
            (current) =>
              current.map(
                (campaign) =>
                  campaign._id === id
                    ? response.data
                    : campaign,
              ),
          );

          return response.data;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to update campaign status";

          setError(message);

          throw error;
        } finally {
          setUpdatingStatus(
            false,
          );
        }
      },
      [],
    );

  return {
    campaigns,
    loading,
    creating,
    updatingStatus,
    error,
    reload: loadCampaigns,
    addCampaign,
    editCampaign,
    changeStatus,
  };
}