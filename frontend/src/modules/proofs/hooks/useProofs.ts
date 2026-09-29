"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createProof,
  getProofs,
  reviewProof,
} from "../api";

import type {
  CreateProofData,
  Proof,
  ProofFilters,
} from "../types";

export function useProofs() {
  const [proofs, setProofs] =
    useState<Proof[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [filters, setFilters] =
    useState<ProofFilters>({
      campaignId: "",
      vendorId: "",
      atrId: "",
      status: "",
      uploadedBy: "",
    });

  const loadProofs = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await getProofs(filters);

        setProofs(data);
      } catch (err: any) {
        setError(
          err?.message ||
            "Failed to load proofs"
        );
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    loadProofs();
  }, [loadProofs]);

  const submitProof = async (
    data: CreateProofData
  ): Promise<Proof> => {
    try {
      setSubmitting(true);
      setError("");

      const proof =
        await createProof(data);

      return proof;
    } catch (err: any) {
      const message =
        err?.message ||
        "Proof upload failed";

      setError(message);

      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const approveProof = async (
    id: string
  ) => {
    try {
      const updated =
        await reviewProof(
          id,
          "Approved"
        );

      setProofs((prev) =>
        prev.map((proof) =>
          proof._id === id
            ? updated
            : proof
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to approve proof"
      );

      throw err;
    }
  };

  const completeProof = async (
    id: string
  ) => {
    try {
      const updated =
        await reviewProof(
          id,
          "Complete"
        );

      setProofs((prev) =>
        prev.map((proof) =>
          proof._id === id
            ? updated
            : proof
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to complete proof"
      );

      throw err;
    }
  };

  const rejectProof = async (
    id: string,
    reason: string
  ) => {
    try {
      const updated =
        await reviewProof(
          id,
          "Rejected",
          reason
        );

      setProofs((prev) =>
        prev.map((proof) =>
          proof._id === id
            ? updated
            : proof
        )
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to reject proof"
      );

      throw err;
    }
  };

  const updateFilter = (
    key: keyof ProofFilters,
    value: string
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      campaignId: "",
      vendorId: "",
      atrId: "",
      status: "",
      uploadedBy: "",
    });
  };

  return {
    proofs,
    loading,
    submitting,
    error,
    filters,
    submitProof,
    approveProof,
    completeProof,
    rejectProof,
    updateFilter,
    clearFilters,
    reload: loadProofs,
  };
}