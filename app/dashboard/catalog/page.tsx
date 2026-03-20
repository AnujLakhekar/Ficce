"use client";

import React from "react";
import toast from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { Plus, X } from "lucide-react";
import {
  auth,
  createWorkspaceRecord,
  deleteWorkspaceRecordById,
  getWorkspaceRecordsByUid,
  updateWorkspaceRecordById,
  type WorkspaceRecord,
} from "@/lib/firebase";

const formatMoney = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const formatDate = (value: WorkspaceRecord["createdAt"]) => {
  if (!value) {
    return "-";
  }

  return value.toDate().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function Page() {
  const [uid, setUid] = React.useState<string | null>(null);
  const [records, setRecords] = React.useState<WorkspaceRecord[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);

  const [titleInput, setTitleInput] = React.useState("");
  const [descriptionInput, setDescriptionInput] = React.useState("");
  const [priceInput, setPriceInput] = React.useState("");

  const loadRecords = React.useCallback(async (nextUid: string) => {
    const items = await getWorkspaceRecordsByUid(nextUid, "catalog");
    setRecords(items);
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0].id);
    }
    if (items.length === 0) {
      setSelectedId(null);
    }
  }, [selectedId]);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setRecords([]);
        setSelectedId(null);
        return;
      }

      setUid(user.uid);
      try {
        await loadRecords(user.uid);
      } catch (error) {
        toast.error("Failed to load catalog");
        console.error("Catalog load error:", error);
      }
    });

    return () => unsub();
  }, [loadRecords]);

  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;

  React.useEffect(() => {
    if (!selectedRecord) {
      setTitleInput("");
      setDescriptionInput("");
      setPriceInput("");
      return;
    }

    setTitleInput(selectedRecord.title);
    setDescriptionInput(selectedRecord.description);
    setPriceInput(String(selectedRecord.amount || ""));
  }, [selectedRecord]);

  const handleCreate = async () => {
    if (!uid) {
      toast.error("Please sign in first");
      return;
    }

    if (!titleInput.trim()) {
      toast.error("Item name is required");
      return;
    }

    const numericPrice = Number(priceInput);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      toast.error("Enter valid price");
      return;
    }

    setIsSaving(true);
    try {
      await createWorkspaceRecord(uid, "catalog", {
        title: titleInput.trim(),
        description: descriptionInput.trim() || "One time",
        amount: Number(numericPrice.toFixed(2)),
        status: "active",
      });
      setTitleInput("");
      setDescriptionInput("");
      setPriceInput("");
      setShowCreateForm(false);
      await loadRecords(uid);
      toast.success("Item added");
    } catch (error) {
      toast.error("Failed to add item");
      console.error("Catalog create error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!uid || !selectedRecord) {
      return;
    }

    if (!titleInput.trim()) {
      toast.error("Item name is required");
      return;
    }

    const numericPrice = Number(priceInput);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      toast.error("Enter valid price");
      return;
    }

    setIsSaving(true);
    try {
      await updateWorkspaceRecordById(uid, "catalog", selectedRecord.id, {
        title: titleInput.trim(),
        description: descriptionInput.trim(),
        amount: Number(numericPrice.toFixed(2)),
      });
      setIsEditing(false);
      await loadRecords(uid);
      toast.success("Item updated");
    } catch (error) {
      toast.error("Failed to update item");
      console.error("Catalog update error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!uid || !selectedRecord) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteWorkspaceRecordById(uid, "catalog", selectedRecord.id);
      await loadRecords(uid);
      toast.success("Item deleted");
    } catch (error) {
      toast.error("Failed to delete item");
      console.error("Catalog delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="text-text">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Catalog</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Browse through your invoice catalog to view accounts and their balances.
          </p>
        </div>

        <button
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-text px-4 text-sm font-medium text-forground"
          onClick={() => {
            setShowCreateForm((prev) => !prev);
            setIsEditing(false);
            setTitleInput("");
            setDescriptionInput("");
            setPriceInput("");
          }}
          type="button"
        >
          <Plus className="size-4" /> Add Items
        </button>
      </div>

      {showCreateForm && (
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-outline bg-forground p-4 md:grid-cols-4">
          <input
            className="h-10 rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
            onChange={(event) => setTitleInput(event.target.value)}
            placeholder="Item name"
            value={titleInput}
          />
          <input
            className="h-10 rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
            onChange={(event) => setDescriptionInput(event.target.value)}
            placeholder="Description"
            value={descriptionInput}
          />
          <input
            className="h-10 rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
            inputMode="decimal"
            onChange={(event) => setPriceInput(event.target.value)}
            placeholder="Price"
            value={priceInput}
          />
          <button
            className="h-10 rounded-xl bg-text px-4 text-sm font-medium text-forground disabled:opacity-60"
            disabled={isSaving}
            onClick={() => void handleCreate()}
            type="button"
          >
            {isSaving ? "Saving..." : "Save Item"}
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.7fr]">
        <div className="overflow-hidden rounded-xl border border-outline bg-forground">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-outline bg-secondary/50 text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Descriptions</th>
                <th className="px-4 py-3 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  className={`cursor-pointer border-b border-outline last:border-b-0 ${selectedId === record.id ? "bg-secondary/60" : ""}`}
                  key={record.id}
                  onClick={() => {
                    setSelectedId(record.id);
                    setIsEditing(false);
                  }}
                >
                  <td className="px-4 py-4 font-medium">{record.title}</td>
                  <td className="px-4 py-4 text-text-secondary">{record.description || "-"}</td>
                  <td className="px-4 py-4">{formatMoney(record.amount)}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-text-secondary" colSpan={3}>
                    No items added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="rounded-xl border border-outline bg-forground p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Items</h2>
            <X className="size-4 text-text-secondary" />
          </div>

          {!selectedRecord && (
            <p className="mt-4 text-sm text-text-secondary">Select an item to view details.</p>
          )}

          {selectedRecord && (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-outline p-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      className="h-10 w-full rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
                      onChange={(event) => setTitleInput(event.target.value)}
                      value={titleInput}
                    />
                    <input
                      className="h-10 w-full rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
                      onChange={(event) => setDescriptionInput(event.target.value)}
                      value={descriptionInput}
                    />
                    <input
                      className="h-10 w-full rounded-xl border border-outline bg-secondary px-3 text-sm outline-none focus:border-hover"
                      inputMode="decimal"
                      onChange={(event) => setPriceInput(event.target.value)}
                      value={priceInput}
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-semibold">{selectedRecord.title}</p>
                    <p className="mt-1 text-sm text-text-secondary">{selectedRecord.description || "-"}</p>
                    <p className="mt-3 text-right text-2xl font-semibold">{formatMoney(selectedRecord.amount)}</p>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-outline p-3 text-sm">
                <p className="text-text-secondary">Descriptions</p>
                <p className="mt-1">{selectedRecord.description || "-"}</p>
                <p className="mt-3 text-text-secondary">Last Update</p>
                <p className="mt-1">{formatDate(selectedRecord.createdAt)}</p>
                <p className="mt-3 text-text-secondary">Used</p>
                <p className="mt-1">-</p>
                <p className="mt-3 text-text-secondary">Last Used</p>
                <p className="mt-1">Item has not been used yet</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="h-10 rounded-xl bg-text text-sm font-medium text-forground disabled:opacity-60"
                  disabled={isSaving}
                  onClick={() => {
                    if (isEditing) {
                      void handleSaveEdit();
                      return;
                    }
                    setIsEditing(true);
                  }}
                  type="button"
                >
                  {isEditing ? "Save" : "Edit"}
                </button>
                <button
                  className="h-10 rounded-xl border border-outline bg-forground text-sm font-medium text-text disabled:opacity-60"
                  disabled={isDeleting}
                  onClick={() => void handleDelete()}
                  type="button"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
