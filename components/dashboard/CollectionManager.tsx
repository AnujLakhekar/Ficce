"use client";

import React from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Download, LoaderCircle, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  auth,
  createWorkspaceRecord,
  deleteWorkspaceRecordById,
  getWorkspaceRecordsByUid,
  type WorkspaceRecord,
} from "@/lib/firebase";

type CollectionManagerProps = {
  title: string;
  subtitle: string;
  collectionName: string;
  amountLabel?: string;
  statusOptions?: string[];
  addButtonLabel?: string;
  showDetailsPanel?: boolean;
};

const formatDate = (value: WorkspaceRecord["createdAt"]) => {
  if (!value) {
    return "-";
  }

  return value.toDate().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export default function CollectionManager({
  title,
  subtitle,
  collectionName,
  amountLabel = "Amount",
  statusOptions = ["active", "pending", "completed"],
  addButtonLabel = "Add Record",
  showDetailsPanel = false,
}: CollectionManagerProps) {
  const [uid, setUid] = React.useState<string | null>(null);
  const [records, setRecords] = React.useState<WorkspaceRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [titleInput, setTitleInput] = React.useState("");
  const [descriptionInput, setDescriptionInput] = React.useState("");
  const [amountInput, setAmountInput] = React.useState("");
  const [statusInput, setStatusInput] = React.useState(statusOptions[0] ?? "active");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | null>(null);

  const loadRecords = React.useCallback(async (nextUid: string) => {
    try {
      setIsLoading(true);
      const items = await getWorkspaceRecordsByUid(nextUid, collectionName);
      setRecords(items);
    } catch (error) {
      toast.error(`Failed to load ${title.toLowerCase()}`);
      console.error(`Load ${collectionName} error:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [collectionName, title]);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setRecords([]);
        setIsLoading(false);
        return;
      }

      setUid(user.uid);
      void loadRecords(user.uid);
    });

    return () => unsubscribe();
  }, [loadRecords]);

  React.useEffect(() => {
    if (records.length > 0 && !selectedRecordId) {
      setSelectedRecordId(records[0].id);
    }

    if (records.length === 0) {
      setSelectedRecordId(null);
    }
  }, [records, selectedRecordId]);

  const filteredRecords = records.filter((record) => {
    if (statusFilter === "all") {
      return true;
    }

    return record.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);
  const completedAmount = records
    .filter((record) => {
      const value = record.status.toLowerCase();
      return ["completed", "paid", "done", "closed", "approved"].includes(value);
    })
    .reduce((sum, record) => sum + record.amount, 0);
  const pendingAmount = Math.max(totalAmount - completedAmount, 0);

  const selectedRecord = records.find((record) => record.id === selectedRecordId) ?? null;

  const handleCreate = async () => {
    if (!uid) {
      toast.error("Please sign in first");
      return;
    }

    const numericAmount = Number(amountInput || 0);

    if (!titleInput.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setIsSaving(true);

    try {
      await createWorkspaceRecord(uid, collectionName, {
        title: titleInput.trim(),
        description: descriptionInput.trim(),
        amount: Number(numericAmount.toFixed(2)),
        status: statusInput,
      });

      setTitleInput("");
      setDescriptionInput("");
      setAmountInput("");
      setStatusInput(statusOptions[0] ?? "active");
      await loadRecords(uid);
      toast.success(`${title} record created`);
    } catch (error) {
      toast.error(`Failed to create ${title.toLowerCase()} record`);
      console.error(`Create ${collectionName} error:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!uid) {
      toast.error("Please sign in first");
      return;
    }

    setDeletingId(recordId);

    try {
      await deleteWorkspaceRecordById(uid, collectionName, recordId);
      setRecords((prev) => prev.filter((record) => record.id !== recordId));
      toast.success("Record deleted");
    } catch (error) {
      toast.error("Failed to delete record");
      console.error(`Delete ${collectionName} error:`, error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      toast.error("No records to export");
      return;
    }

    const headers = ["Title", "Description", amountLabel, "Status", "Created At"];
    const rows = filteredRecords.map((record) => [
      record.title,
      record.description,
      String(record.amount),
      record.status,
      formatDate(record.createdAt),
    ]);

    const csv = [headers, ...rows]
      .map((values) => values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${collectionName}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Records exported");
  };

  return (
    <div className="space-y-4 text-text">
      <section className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-outline p-3 sm:p-4 bg-[radial-gradient(circle_at_65%_15%,rgba(155,112,255,0.35)_0%,rgba(155,112,255,0)_35%),radial-gradient(circle_at_78%_25%,rgba(80,175,255,0.45)_0%,rgba(80,175,255,0)_42%),linear-gradient(180deg,#d8f0ff_0%,#f8fbff_65%)]">
          <p className="text-xs text-text-secondary">Total Value</p>
          <p className="mt-1 text-2xl sm:text-3xl font-semibold">{formatMoney(totalAmount)}</p>
          <p className="mt-1 text-xs text-text-secondary">{records.length} records</p>
        </div>
        <div className="rounded-2xl border border-outline p-3 sm:p-4 bg-[radial-gradient(circle_at_20%_25%,rgba(95,232,214,0.35)_0%,rgba(95,232,214,0)_40%),radial-gradient(circle_at_78%_22%,rgba(255,155,119,0.4)_0%,rgba(255,155,119,0)_42%),linear-gradient(180deg,#e4fffa_0%,#fff7f2_65%)]">
          <p className="text-xs text-text-secondary">Completed Value</p>
          <p className="mt-1 text-2xl sm:text-3xl font-semibold">{formatMoney(completedAmount)}</p>
          <p className="mt-1 text-xs text-text-secondary">Closed/Paid records</p>
        </div>
        <div className="rounded-2xl border border-outline p-3 sm:p-4 bg-[radial-gradient(circle_at_22%_22%,rgba(233,118,210,0.35)_0%,rgba(233,118,210,0)_38%),radial-gradient(circle_at_68%_26%,rgba(255,204,115,0.4)_0%,rgba(255,204,115,0)_40%),linear-gradient(180deg,#f9eeff_0%,#fffdf5_65%)]">
          <p className="text-xs text-text-secondary">Open Value</p>
          <p className="mt-1 text-2xl sm:text-3xl font-semibold">{formatMoney(pendingAmount)}</p>
          <p className="mt-1 text-xs text-text-secondary">Pending or active records</p>
        </div>
      </section>

      <section className="rounded-2xl border border-outline bg-forground">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline px-3 sm:px-5 py-3 sm:py-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold">{title}</h1>
            <p className="mt-1 text-xs sm:text-sm text-text-secondary">{subtitle}</p>
          </div>

          <button
            className="h-11 sm:h-10 rounded-xl bg-text px-3 sm:px-4 text-xs sm:text-sm font-medium text-forground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || isLoading || !uid}
            onClick={() => void handleCreate()}
            type="button"
          >
            {isSaving ? "Saving..." : addButtonLabel}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:gap-3 border-b border-outline px-3 sm:px-4 py-3 sm:py-4 sm:grid-cols-2 md:grid-cols-5">
          <input
            className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm text-text outline-none focus:border-hover"
            onChange={(event) => setTitleInput(event.target.value)}
            placeholder="Title"
            value={titleInput}
          />
          <input
            className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm text-text outline-none focus:border-hover"
            onChange={(event) => setDescriptionInput(event.target.value)}
            placeholder="Description"
            value={descriptionInput}
          />
          <input
            className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm text-text outline-none focus:border-hover"
            inputMode="decimal"
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder={amountLabel}
            value={amountInput}
          />
          <select
            className="h-11 rounded-xl border border-outline bg-secondary px-3 text-sm text-text outline-none focus:border-hover"
            onChange={(event) => setStatusInput(event.target.value)}
            value={statusInput}
          >
            {statusOptions.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
          <div className="hidden h-11 md:block" />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2 border-b border-outline px-3 sm:px-4 py-2 sm:py-3">
          <button
            className="rounded-xl bg-text px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium text-forground min-h-10"
            onClick={() => setStatusFilter("all")}
            type="button"
          >
            All
          </button>
          <select
            className="h-10 rounded-xl border border-outline bg-forground px-3 text-xs sm:text-sm text-text outline-none focus:border-hover"
            onChange={(event) => setStatusFilter(event.target.value)}
            value={statusFilter}
          >
            <option value="all">Status</option>
            {statusOptions.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
          <button
            className="inline-flex items-center gap-1 sm:gap-2 rounded-xl border border-outline bg-forground px-3 sm:px-4 py-2 text-xs sm:text-sm text-text hover:bg-secondary min-h-10"
            onClick={handleExport}
            type="button"
          >
            <Download className="size-4 text-text-secondary" />
            <span className="hidden sm:inline">Export All</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>

        <div className={`grid gap-3 sm:gap-4 p-3 sm:p-4 ${showDetailsPanel ? "lg:grid-cols-[1.35fr_0.9fr]" : "grid-cols-1"}`}>
          <div className="overflow-x-auto rounded-xl border border-outline">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-outline bg-secondary/60 text-xs uppercase text-text-secondary">
                <tr>
                  <th className="px-2 sm:px-4 py-3">Title</th>
                  <th className="px-2 sm:px-4 py-3 hidden sm:table-cell">Desc</th>
                  <th className="px-2 sm:px-4 py-3">{amountLabel}</th>
                  <th className="px-2 sm:px-4 py-3 hidden md:table-cell">Status</th>
                  <th className="px-2 sm:px-4 py-3 hidden lg:table-cell">Created</th>
                  <th className="px-2 sm:px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-2 sm:px-4 py-8 text-center text-text-secondary" colSpan={6}>
                      <span className="inline-flex items-center gap-2 text-xs sm:text-base">
                        <LoaderCircle className="size-4 animate-spin" /> Loading...
                      </span>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  filteredRecords.map((record) => (
                    <tr
                      className={`border-b border-outline last:border-b-0 ${selectedRecordId === record.id ? "bg-secondary/50" : ""}`}
                      key={record.id}
                      onClick={() => setSelectedRecordId(record.id)}
                    >
                      <td className="px-2 sm:px-4 py-3 font-medium truncate">{record.title}</td>
                      <td className="px-2 sm:px-4 py-3 text-text-secondary hidden sm:table-cell truncate text-xs">{record.description || "-"}</td>
                      <td className="px-2 sm:px-4 py-3 font-medium text-xs sm:text-sm">{formatMoney(record.amount)}</td>
                      <td className="px-2 sm:px-4 py-3 hidden md:table-cell text-xs">{record.status}</td>
                      <td className="px-2 sm:px-4 py-3 text-text-secondary hidden lg:table-cell text-xs">{formatDate(record.createdAt)}</td>
                      <td className="px-2 sm:px-4 py-3 text-right">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-outline px-2 py-1.5 text-xs font-medium text-text hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 min-h-10 justify-center"
                          disabled={deletingId === record.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDelete(record.id);
                          }}
                          type="button"
                        >
                          {deletingId === record.id ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}

                {!isLoading && filteredRecords.length === 0 && (
                  <tr>
                    <td className="px-2 sm:px-4 py-8 text-center text-text-secondary text-xs sm:text-base" colSpan={6}>
                      No records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showDetailsPanel && (
            <aside className="rounded-xl border border-outline bg-forground p-4">
              <h2 className="text-xl font-semibold">Item</h2>
              {!selectedRecord && (
                <p className="mt-3 text-sm text-text-secondary">Select a row to view details.</p>
              )}

              {selectedRecord && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-outline bg-secondary p-3">
                    <p className="text-xs text-text-secondary">Title</p>
                    <p className="mt-1 font-medium">{selectedRecord.title}</p>
                    <p className="mt-2 text-xs text-text-secondary">{selectedRecord.description || "-"}</p>
                  </div>

                  <div className="rounded-lg border border-outline p-3">
                    <p className="text-xs text-text-secondary">{amountLabel}</p>
                    <p className="mt-1 text-lg font-semibold">{formatMoney(selectedRecord.amount)}</p>
                    <p className="mt-2 text-xs text-text-secondary">Status: {selectedRecord.status}</p>
                    <p className="text-xs text-text-secondary">Created: {formatDate(selectedRecord.createdAt)}</p>
                  </div>

                  <button
                    className="inline-flex items-center gap-1 rounded-lg border border-outline px-2.5 py-1.5 text-xs font-medium text-text hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={deletingId === selectedRecord.id}
                    onClick={() => void handleDelete(selectedRecord.id)}
                    type="button"
                  >
                    {deletingId === selectedRecord.id ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Delete
                  </button>
                </div>
              )}
            </aside>
          )}
        </div>
      </section>
    </div>
  );
}
