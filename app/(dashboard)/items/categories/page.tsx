"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Archive,
  Box,
  Edit,
  Plus,
  Tag,
  Tags,
  Trash,
  X,
} from "lucide-react";
import { AppModal } from "@/components/app-modal";
import { BackButton } from "@/components/back-button";
import { useAppData } from "@/lib/client/useAppData";
import { formatUnitLabel, itemVariant } from "@/lib/item-display";
import { formatCurrency } from "@/lib/utils";

type CategoryCard = {
  id: string;
  name: string;
  count: number;
  color: string;
};

const CARD_COLORS = [
  "bg-blue-500",
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

const fieldClass =
  "h-12 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-indigo-500/15 dark:bg-zinc-950";

export default function CategoriesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-black uppercase tracking-widest text-slate-500">Loading categories…</div>}>
      <CategoriesManager />
    </Suspense>
  );
}

function CategoriesManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const user = session?.user as any;
  const {
    categories = [],
    products = [],
    items = [],
    currentLocation,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useAppData();

  const canManage =
    user?.role === "Super Admin"
    || user?.permissions?.includes("inventory.categories.manage")
    || user?.permissions?.includes("inventory.items.create");
  const canDelete =
    user?.role === "Super Admin"
    || user?.permissions?.includes("inventory.categories.manage")
    || user?.permissions?.includes("inventory.items.delete");

  const selectedId = searchParams.get("id") || "";
  const showUncategorized = searchParams.get("view") === "uncategorized";

  const visibleCategories = React.useMemo(
    () => categories.filter((category: any) => String(category?.name || "").trim()),
    [categories],
  );

  const categoryCards = React.useMemo<CategoryCard[]>(() => {
    return visibleCategories
      .map((category: any, index: number) => ({
        id: category.id,
        name: category.name,
        count: products.filter((product: any) => product.categoryId === category.id).length,
        color: CARD_COLORS[index % CARD_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [visibleCategories, products]);

  const uncategorizedItems = React.useMemo(() => {
    const categoryIds = new Set(visibleCategories.map((category: any) => category.id));
    return products.filter((product: any) => !product.categoryId || !categoryIds.has(product.categoryId));
  }, [visibleCategories, products]);

  const selectedCategory = categoryCards.find((category) => category.id === selectedId) || null;
  const openCategory = showUncategorized
    ? { id: "", name: "Uncategorized", count: uncategorizedItems.length, color: "bg-slate-500" }
    : selectedCategory;
  const openItems = showUncategorized
    ? uncategorizedItems
    : products.filter((product: any) => product.categoryId === selectedId);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<CategoryCard | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CategoryCard | null>(null);
  const [nameDraft, setNameDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const totalCounted = categoryCards.reduce((sum, category) => sum + category.count, 0);
  const hasCategories = categoryCards.length > 0;

  const openCategoryView = (id: string) => {
    router.replace(id ? `/items/categories?id=${encodeURIComponent(id)}` : "/items/categories");
  };

  const stockFor = (itemId: string) =>
    items
      .filter((row: any) => row.id === itemId)
      .reduce((sum: number, row: any) => sum + Number(row.stock || 0), 0);

  const handleCreate = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setError("Enter a category name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await addCategory({ name });
      setCreateOpen(false);
      setNameDraft("");
      if (result?.id) openCategoryView(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category.");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = nameDraft.trim();
    if (!name) {
      setError("Enter a category name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateCategory({ id: renameTarget.id, name });
      setRenameTarget(null);
      setNameDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setError("");
    try {
      await deleteCategory({ id: deleteTarget.id });
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) openCategoryView("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete category.");
    } finally {
      setSaving(false);
    }
  };

  if (openCategory && (showUncategorized || selectedCategory)) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="page-heading">
          <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {openCategory.name}
              </h1>
              <p className="mt-1 text-slate-500">
                {openCategory.count} item{openCategory.count === 1 ? "" : "s"} in this category
              </p>
            </div>
          <div className="flex shrink-0 items-center gap-2">
            <BackButton onClick={() => openCategoryView("")} />
          {selectedCategory && canManage ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setNameDraft(selectedCategory.name);
                  setRenameTarget(selectedCategory);
                }}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <Edit className="h-4 w-4" /> Rename
              </button>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setDeleteTarget(selectedCategory);
                  }}
                  disabled={selectedCategory.count > 0}
                  title={selectedCategory.count > 0 ? "Remove or recategorize items before deleting." : "Delete unused category"}
                  className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-900/20 transition-all hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-zinc-800"
                >
                  <Trash className="h-4 w-4" /> Delete
                </button>
              ) : null}
            </div>
          ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-700 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
                  <th className="px-6 py-4">SKU</th>
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4 text-center">Stock</th>
                  <th className="px-6 py-4 text-right">Selling Price</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {openItems.map((item: any) => {
                  const variant = itemVariant(item, currentLocation?.id);
                  const itemName = variant.sizeLabel && variant.sizeLabel.toLowerCase() !== variant.style.toLowerCase()
                    ? `${variant.style} ${variant.sizeLabel}`
                    : item.name || variant.style;
                  return (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs uppercase text-slate-600">{item.code || "-"}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{itemName}</td>
                      <td className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-600">{formatUnitLabel(item)}</td>
                      <td className="px-6 py-4 text-center text-sm font-black text-slate-900 dark:text-white">{stockFor(item.id)}</td>
                      <td className="px-6 py-4 text-right font-mono text-sm font-black">{formatCurrency(item.price || item.sellingPrice || 0)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/items/create?id=${item.id}`}
                          className="inline-flex rounded-xl p-2 text-slate-600 transition-all hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-zinc-800"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {openItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                      No items in this category
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <CategoryModals
          createOpen={false}
          renameOpen={Boolean(renameTarget)}
          deleteTarget={deleteTarget}
          nameDraft={nameDraft}
          setNameDraft={setNameDraft}
          error={error}
          saving={saving}
          onCloseCreate={() => undefined}
          onCloseRename={() => { setRenameTarget(null); setError(""); }}
          onCloseDelete={() => { setDeleteTarget(null); setError(""); }}
          onCreate={handleCreate}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="page-heading">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Categories</h1>
          <p className="mt-1 text-slate-500">
            Live category summary from your current inventory.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setNameDraft("");
              setCreateOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-900/20 transition-all hover:bg-indigo-500 active:scale-95"
          >
            <Plus className="h-4 w-4" /> New Category
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={Tags} label="Categories" value={String(categoryCards.length)} />
        <SummaryCard icon={Tag} label="Categorized Items" value={String(totalCounted)} />
        <button
          type="button"
          onClick={() => router.replace("/items/categories?view=uncategorized")}
          className="text-left"
        >
          <SummaryCard icon={Box} label="Uncategorized Items" value={String(uncategorizedItems.length)} tone={uncategorizedItems.length > 0 ? "warning" : "success"} />
        </button>
      </div>

      {!hasCategories ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <Archive className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">No categories yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Create categories when you are ready. For now, all items will appear as uncategorized.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {categoryCards.map((category) => (
            <div
              key={category.id}
              className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${category.color} text-white shadow-lg`}>
                <Tag className="h-5 w-5" />
              </div>
              <h4 className="text-lg font-black text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white">
                {category.name}
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                {category.count} item{category.count === 1 ? "" : "s"} categorized
              </p>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => openCategoryView(category.id)}
                  className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 hover:underline"
                >
                  View Products
                </button>
                {canManage ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Rename ${category.name}`}
                      onClick={() => {
                        setError("");
                        setNameDraft(category.name);
                        setRenameTarget(category);
                      }}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-zinc-800"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        aria-label={`Delete ${category.name}`}
                        onClick={() => {
                          setError("");
                          setDeleteTarget(category);
                        }}
                        disabled={category.count > 0}
                        title={category.count > 0 ? "Remove or recategorize items before deleting." : "Delete unused category"}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-rose-900/20"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryModals
        createOpen={createOpen}
        renameOpen={Boolean(renameTarget)}
        deleteTarget={deleteTarget}
        nameDraft={nameDraft}
        setNameDraft={setNameDraft}
        error={error}
        saving={saving}
        onCloseCreate={() => { setCreateOpen(false); setError(""); }}
        onCloseRename={() => { setRenameTarget(null); setError(""); }}
        onCloseDelete={() => { setDeleteTarget(null); setError(""); }}
        onCreate={handleCreate}
        onRename={handleRename}
        onDelete={handleDelete}
      />
    </div>
  );
}

function CategoryModals({
  createOpen,
  renameOpen,
  deleteTarget,
  nameDraft,
  setNameDraft,
  error,
  saving,
  onCloseCreate,
  onCloseRename,
  onCloseDelete,
  onCreate,
  onRename,
  onDelete,
}: {
  createOpen: boolean;
  renameOpen: boolean;
  deleteTarget: CategoryCard | null;
  nameDraft: string;
  setNameDraft: (value: string) => void;
  error: string;
  saving: boolean;
  onCloseCreate: () => void;
  onCloseRename: () => void;
  onCloseDelete: () => void;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <AppModal open={createOpen} onClose={onCloseCreate} contentClassName="max-w-md rounded-3xl" labelledBy="new-category-title">
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate();
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 id="new-category-title" className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">New Category</h2>
            <button type="button" onClick={onCloseCreate} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-zinc-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Category Name</label>
          <input
            autoFocus
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            placeholder="e.g. Analgesics"
            className={`${fieldClass} mt-2`}
          />
          {error ? <p className="mt-3 text-xs font-bold text-rose-600">{error}</p> : null}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onCloseCreate} className="btn-cancel flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60">
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal open={renameOpen} onClose={onCloseRename} contentClassName="max-w-md rounded-3xl" labelledBy="rename-category-title">
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            onRename();
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 id="rename-category-title" className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">Rename Category</h2>
            <button type="button" onClick={onCloseRename} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-zinc-800">
              <X className="h-5 w-5" />
            </button>
          </div>
          <label className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-800 dark:text-zinc-200">Category Name</label>
          <input
            autoFocus
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            className={`${fieldClass} mt-2`}
          />
          {error ? <p className="mt-3 text-xs font-bold text-rose-600">{error}</p> : null}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onCloseRename} className="btn-cancel flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal open={Boolean(deleteTarget)} onClose={onCloseDelete} contentClassName="max-w-sm rounded-3xl" labelledBy="delete-category-title">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />
            <div>
              <h2 id="delete-category-title" className="text-lg font-black text-slate-950 dark:text-white">Delete category</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {deleteTarget?.count
                  ? `${deleteTarget.name} still has ${deleteTarget.count} item${deleteTarget.count === 1 ? "" : "s"}. Recategorize them first.`
                  : `${deleteTarget?.name || "This category"} is unused and will be permanently removed.`}
              </p>
              {error ? <p className="mt-2 text-xs font-bold text-rose-600">{error}</p> : null}
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={onCloseDelete} className="btn-cancel flex-1">Cancel</button>
            <button
              type="button"
              onClick={onDelete}
              disabled={saving || Number(deleteTarget?.count || 0) > 0}
              className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </AppModal>
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "warning" | "success";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Icon
        className={`h-5 w-5 ${
          tone === "warning"
            ? "text-amber-500"
            : tone === "success"
              ? "text-emerald-500"
              : "text-indigo-600"
        }`}
      />
      <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
