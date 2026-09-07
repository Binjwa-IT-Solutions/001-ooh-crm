"use client";

import { useEffect, useMemo, useState } from "react";

import { usePurchaseOrders } from "@/modules/purchase-orders/hooks/usePurchaseOrders";

import PurchaseOrderFilters from "@/modules/purchase-orders/components/PurchaseOrderFilters";

import PurchaseOrderTable from "@/modules/purchase-orders/components/PurchaseOrderTable";

import PurchaseOrderForm from "@/modules/purchase-orders/components/PurchaseOrderForm";

import PurchaseOrderDetails from "@/modules/purchase-orders/components/PurchaseOrderDetails";

import type {
  PurchaseOrder,
  PurchaseOrderFormData,
} from "@/modules/purchase-orders/types";

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    orders,
    loading,
    saving,
    error,
    addOrder,
    editOrder,
    issueOrder,
    cancelOrder,
  } = usePurchaseOrders({
    search: debouncedSearch,
    status: status || undefined,
  });

  const [formOpen, setFormOpen] = useState(false);

  const [editingOrder, setEditingOrder] =
    useState<PurchaseOrder | null>(null);

  const [detailsOrder, setDetailsOrder] =
    useState<PurchaseOrder | null>(null);

  const filteredOrders = useMemo(() => {
    const value = search.trim().toLowerCase();

    return orders.filter((order) => {
      const vendor =
        typeof order.vendorId === "string"
          ? order.vendorId
          : `${order.vendorId?.name ?? ""} ${order.vendorId?.city ?? ""} ${order.vendorId?.state ?? ""}`;

      const campaign =
        typeof order.campaignId === "string"
          ? order.campaignId
          : `${order.campaignId?.name ?? ""} ${order.campaignId?.campaignCode ?? ""} ${order.campaignId?.city ?? ""}`;

      const poNumber = order.poNumber ?? "";

      const searchMatch =
        !value ||
        poNumber.toLowerCase().includes(value) ||
        vendor.toLowerCase().includes(value) ||
        campaign.toLowerCase().includes(value);

      return (
        searchMatch &&
        (!status || order.status === status)
      );
    });
  }, [orders, search, status]);

  function openAdd() {
    setEditingOrder(null);
    setFormOpen(true);
  }

  function openEdit(order: PurchaseOrder) {
    if (order.status !== "Draft") return;

    setEditingOrder(order);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingOrder(null);
  }

  async function handleSubmit(
    data: PurchaseOrderFormData,
  ) {
    if (editingOrder) {
      return editOrder(
        editingOrder._id,
        data,
      );
    }

    return addOrder(data);
  }

  async function handleIssue(
    order: PurchaseOrder,
  ) {
    if (
      !window.confirm(
        `Are you sure you want to issue ${order.poNumber}? Once issued, it cannot be edited.`,
      )
    ) {
      return;
    }

    await issueOrder(order._id);
  }

  async function handleCancel(
    order: PurchaseOrder,
  ) {
    if (
      !window.confirm(
        `Are you sure you want to cancel ${order.poNumber}?`,
      )
    ) {
      return;
    }

    await cancelOrder(order._id);
  }

  return (
    <main className="min-h-screen bg-[#F7F8FA] p-4 md:p-6">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#1F2937]">
              Purchase Orders
            </h1>

            <p className="mt-1 text-sm text-[#667085]">
              Manage vendor purchase orders
            </p>
          </div>

          <button
            type="button"
            onClick={openAdd}
            className="
              rounded-xl
              bg-[#A8333B]
              px-5 py-3
              text-sm font-bold text-white
              shadow-sm transition
              hover:bg-[#F9DADA]
              hover:text-[#A8333B]
              focus:outline-none
              focus:ring-2
              focus:ring-[#F9DADA]
            "
          >
            + Create Purchase Order
          </button>
        </div>

        {/* Summary */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary
            title="Total Orders"
            value={orders.length}
          />

          <Summary
            title="Draft"
            value={
              orders.filter(
                (order) =>
                  order.status === "Draft",
              ).length
            }
          />

          <Summary
            title="Issued"
            value={
              orders.filter(
                (order) =>
                  order.status === "Issued",
              ).length
            }
          />

          <Summary
            title="Cancelled"
            value={
              orders.filter(
                (order) =>
                  order.status === "Cancelled",
              ).length
            }
          />
        </div>

        {/* Filters */}
        <PurchaseOrderFilters
          search={search}
          status={status}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
        />

        {/* Error */}
        {error && (
          <div className="mt-5 rounded-xl border border-[#F0C7C7] bg-[#FFF8F8] p-4">
            <p className="text-sm font-semibold text-[#8B2424]">
              {error}
            </p>
          </div>
        )}

        {/* Table */}
        <div className="mt-6">
          {loading ? (
            <Loading />
          ) : (
            <PurchaseOrderTable
              orders={filteredOrders}
              onView={setDetailsOrder}
              onEdit={openEdit}
              onIssue={handleIssue}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>

      {/* Form */}
      {formOpen && (
        <PurchaseOrderForm
          order={editingOrder}
          saving={saving}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onSuccess={closeForm}
        />
      )}

      {/* Details */}
      {detailsOrder && (
        <PurchaseOrderDetails
          order={detailsOrder}
          onClose={() =>
            setDetailsOrder(null)
          }
        />
      )}
    </main>
  );
}

function Summary({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div
      className="
        rounded-2xl
        border border-[#E8E8EC]
        bg-white
        p-5
        shadow-sm
        transition
        hover:border-[#F0C7C7]
        hover:shadow-md
      "
    >
      <p className="text-sm font-medium text-[#667085]">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-[#1F2937]">
        {value}
      </p>
    </div>
  );
}

function Loading() {
  return (
    <div className="rounded-2xl border border-[#E8E8EC] bg-white p-16 text-center shadow-sm">
      <div
        className="
          mx-auto h-8 w-8
          animate-spin
          rounded-full
          border-4
          border-[#F9DADA]
          border-t-[#A8333B]
        "
      />

      <p className="mt-4 text-sm font-medium text-[#667085]">
        Loading purchase orders...
      </p>
    </div>
  );
}