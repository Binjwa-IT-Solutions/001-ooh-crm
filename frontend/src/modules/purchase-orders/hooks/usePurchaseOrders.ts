"use client";

import { useCallback, useEffect, useState } from "react";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrders,
  issuePurchaseOrder,
  updatePurchaseOrder,
} from "../api";
import type {
  PurchaseOrder,
  PurchaseOrderFormData,
} from "../types";

export function usePurchaseOrders() {
  const [orders, setOrders] = useState<
    PurchaseOrder[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await getPurchaseOrders();

      setOrders(response.data || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load purchase orders",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function addOrder(
    data: PurchaseOrderFormData,
  ) {
    try {
      setSaving(true);
      setError("");

      await createPurchaseOrder(data);
      await loadOrders();

      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create purchase order",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function editOrder(
    id: string,
    data: Partial<PurchaseOrderFormData>,
  ) {
    try {
      setSaving(true);
      setError("");

      await updatePurchaseOrder(id, data);
      await loadOrders();

      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update purchase order",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function issueOrder(id: string) {
    try {
      setSaving(true);
      setError("");

      await issuePurchaseOrder(id);
      await loadOrders();

      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to issue purchase order",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder(id: string) {
    try {
      setSaving(true);
      setError("");

      await cancelPurchaseOrder(id);
      await loadOrders();

      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to cancel purchase order",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    orders,
    loading,
    saving,
    error,
    loadOrders,
    addOrder,
    editOrder,
    issueOrder,
    cancelOrder,
  };
}

export function usePurchaseOrder(id: string) {
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError('');
      const response = await getPurchaseOrder(id);
      setPurchaseOrder(response.data || null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load purchase order');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  return {
    purchaseOrder,
    isLoading,
    error,
    mutate: loadOrder,
  };
}