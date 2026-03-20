"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Bell,
  ChevronRight,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Link from "next/link";
import ProfileMenu from "@/components/ui/ProfileMenu";
import { onAuthStateChanged } from "firebase/auth";
import {
  auth,
  getUserNotifications,
  getTransactionsByUid,
  getWorkspaceRecordsByUid,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type UserNotification,
} from "@/lib/firebase";
import toast from "react-hot-toast";

interface NavbarProps {
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  bellColor?: string;

}

type SearchItem = {
  label: string;
  href: string;
  type: "page" | "data";
  source?: string;
  preview?: string;
  keywords?: string[];
};

const SEARCH_ITEMS: SearchItem[] = [
  { label: "Dashboard Home", href: "/dashboard", type: "page", keywords: ["home"] },
  { label: "Tasks", href: "/dashboard/tasks", type: "page", keywords: ["todo", "work"] },
  {
    label: "Transactions",
    href: "/dashboard/transactions",
    type: "page",
    keywords: ["income", "expense"],
  },
  { label: "Payments", href: "/dashboard/payments", type: "page", keywords: ["pay"] },
  { label: "Cards", href: "/dashboard/cards", type: "page", keywords: ["credit", "debit"] },
  { label: "Capital", href: "/dashboard/capital", type: "page", keywords: ["fund", "cash"] },
  { label: "Accounts", href: "/dashboard/accounts", type: "page", keywords: ["bank"] },
  {
    label: "Bill Pay",
    href: "/dashboard/bill-pay",
    type: "page",
    keywords: ["bills", "utilities"],
  },
  { label: "Catalog", href: "/dashboard/catalog", type: "page", keywords: ["items", "products"] },
  {
    label: "Invoicing",
    href: "/dashboard/customers",
    type: "page",
    keywords: ["invoice", "customers"],
  },
  {
    label: "Reimbursements",
    href: "/dashboard/reimbursements",
    type: "page",
    keywords: ["claims"],
  },
  {
    label: "Accounting",
    href: "/dashboard/accounting",
    type: "page",
    keywords: ["reports", "ledger"],
  },
  {
    label: "Notifications",
    href: "/dashboard/notifications",
    type: "page",
    keywords: ["alerts"],
  },
  { label: "Profile", href: "/dashboard/profile", type: "page", keywords: ["user", "account"] },
  {
    label: "Settings",
    href: "/dashboard/settings",
    type: "page",
    keywords: ["preferences"],
  },
  {
    label: "KIKO Chat",
    href: "/dashboard/kiko/chat",
    type: "page",
    keywords: ["ai", "assistant", "chat"],
  },
  { label: "KIKO Agent", href: "/dashboard/kiko/agent", type: "page", keywords: ["ai", "agent"] },
];

const DATA_COLLECTIONS: Array<{ collection: string; source: string; href: string }> = [
  { collection: "tasks", source: "Tasks", href: "/dashboard/tasks" },
  { collection: "payments", source: "Payments", href: "/dashboard/payments" },
  { collection: "cards", source: "Cards", href: "/dashboard/cards" },
  { collection: "capital", source: "Capital", href: "/dashboard/capital" },
  { collection: "accounts", source: "Accounts", href: "/dashboard/accounts" },
  { collection: "bill-pay", source: "Bill Pay", href: "/dashboard/bill-pay" },
  { collection: "catalog", source: "Catalog", href: "/dashboard/catalog" },
  { collection: "invoices", source: "Invoicing", href: "/dashboard/customers" },
  { collection: "reimbursements", source: "Reimbursements", href: "/dashboard/reimbursements" },
];

const formatMoney = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

const Navbar = ({ isSidebarCollapsed, onToggleSidebar, bellColor = "red" }: NavbarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [uid, setUid] = React.useState<string | null>(null);
  const [notifications, setNotifications] = React.useState<UserNotification[]>([]);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = React.useState(0);
  const [dataSearchResults, setDataSearchResults] = React.useState<SearchItem[]>([]);
  const [isSearchingData, setIsSearchingData] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const loadNotifications = React.useCallback(async (nextUid: string) => {
    try {
      const items = await getUserNotifications(nextUid);
      setNotifications(items.slice(0, 12));
    } catch (error) {
      console.error("Notification load error:", error);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setNotifications([]);
        return;
      }

      setUid(user.uid);
      void loadNotifications(user.uid);
    });

    return () => unsubscribe();
  }, [loadNotifications]);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!panelRef.current) {
        return;
      }

      const target = event.target as Node;
      if (!panelRef.current.contains(target)) {
        setIsPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!searchRef.current) {
        return;
      }

      const target = event.target as Node;
      if (!searchRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const filteredSearchItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return SEARCH_ITEMS.slice(0, 8);
    }

    return SEARCH_ITEMS.filter((item) => {
      const haystack = [item.label, item.href, ...(item.keywords ?? [])].join(" ").toLowerCase();
      return haystack.includes(query);
    }).slice(0, 8);
  }, [searchQuery]);

  React.useEffect(() => {
    const queryText = searchQuery.trim().toLowerCase();

    if (!uid || queryText.length < 2) {
      setDataSearchResults([]);
      setIsSearchingData(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsSearchingData(true);

      try {
        const [transactions, notifications, ...workspaceCollections] = await Promise.all([
          getTransactionsByUid(uid),
          getUserNotifications(uid),
          ...DATA_COLLECTIONS.map((item) => getWorkspaceRecordsByUid(uid, item.collection)),
        ]);

        if (cancelled) {
          return;
        }

        const transactionResults: SearchItem[] = transactions
          .filter((item) => {
            const haystack = `${item.merchant} ${item.category} ${item.account}`.toLowerCase();
            return haystack.includes(queryText);
          })
          .slice(0, 4)
          .map((item) => ({
            label: item.merchant,
            href: "/dashboard/transactions",
            type: "data",
            source: "Transactions",
            preview: `${item.category} • ${formatMoney(item.amount)} • ${item.type}`,
          }));

        const notificationResults: SearchItem[] = notifications
          .filter((item) => {
            const haystack = `${item.title} ${item.message} ${item.taskType}`.toLowerCase();
            return haystack.includes(queryText);
          })
          .slice(0, 3)
          .map((item) => ({
            label: item.title,
            href: "/dashboard/notifications",
            type: "data",
            source: "Notifications",
            preview: item.message,
          }));

        const workspaceResults: SearchItem[] = workspaceCollections.flatMap((records, index) => {
          const meta = DATA_COLLECTIONS[index];

          return records
            .filter((record) => {
              const haystack = `${record.title} ${record.description} ${record.status}`.toLowerCase();
              return haystack.includes(queryText);
            })
            .slice(0, 3)
            .map((record) => ({
              label: record.title,
              href: meta.href,
              type: "data",
              source: meta.source,
              preview: `${record.description || "-"} • ${formatMoney(record.amount)}`,
            }));
        });

        setDataSearchResults([...transactionResults, ...workspaceResults, ...notificationResults].slice(0, 10));
      } catch (error) {
        if (!cancelled) {
          console.error("Data search error:", error);
          setDataSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsSearchingData(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery, uid]);

  const mergedSearchItems = React.useMemo(() => {
    const seen = new Set<string>();
    const merged: SearchItem[] = [];

    for (const item of [...filteredSearchItems, ...dataSearchResults]) {
      const key = `${item.type}:${item.href}:${item.label}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(item);
      if (merged.length >= 12) {
        break;
      }
    }

    return merged;
  }, [filteredSearchItems, dataSearchResults]);

  React.useEffect(() => {
    setActiveSearchIndex(0);
  }, [searchQuery, mergedSearchItems.length]);

  const navigateToSearchItem = React.useCallback(
    (item: SearchItem) => {
      router.push(item.href);
      setIsSearchOpen(false);
      setSearchQuery("");
      setDataSearchResults([]);
    },
    [router],
  );

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchOpen && (event.key === "ArrowDown" || event.key === "Enter")) {
      setIsSearchOpen(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchIndex((prev) => Math.min(prev + 1, mergedSearchItems.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = mergedSearchItems[activeSearchIndex] ?? mergedSearchItems[0];
      if (selected) {
        navigateToSearchItem(selected);
      }
    }
  };

  const unreadNotifications = notifications.filter((item) => !item.isRead);
  const hasHighPriority = unreadNotifications.some((item) => item.priority === "high");
  const hasMediumPriority = unreadNotifications.some((item) => item.priority === "medium");
  const hasLowPriority = unreadNotifications.some((item) => item.priority === "low");

  const resolvedBellColor =
    hasHighPriority
      ? "#ef4444"
      : hasMediumPriority
        ? "#f59e0b"
        : hasLowPriority
          ? "#22c55e"
          : bellColor;

  const priorityClassMap: Record<UserNotification["priority"], string> = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-emerald-500",
  };

  const handleReadOne = async (notificationId: string) => {
    if (!uid) {
      return;
    }

    try {
      await markNotificationAsRead(uid, notificationId);
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification,
        ),
      );
    } catch (error) {
      toast.error("Failed to update notification");
      console.error("Notification read error:", error);
    }
  };

  const handleReadAll = async () => {
    if (!uid) {
      return;
    }

    try {
      await markAllNotificationsAsRead(uid);
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error("Failed to mark all notifications");
      console.error("Read all notifications error:", error);
    }
  };

  const segments = mounted ? (pathname ?? "").split("/").filter(Boolean) : [];

  return (
    <nav className="flex h-16 sm:h-17.5 items-center justify-between border-b border-outline bg-forground px-2 sm:px-3 md:px-6 gap-2">
      {/* Left Side - Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          aria-label="Toggle sidebar"
          className="p-2 hover:bg-secondary rounded-lg transition text-text flex-shrink-0"
          onClick={onToggleSidebar}
          type="button"
        >
          {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        {segments.length > 0 ? (
          <div className="hidden items-center gap-2 truncate text-xs sm:text-sm text-text md:flex">
            {segments.map((seg, i) => {
              return (
                <div key={i}>
                  {i === 2 ? (
                    <div>...</div>
                  ) : (
                    i < 2 && (
                      <div className="flex items-center gap-2 justify-center">
                        <span
                          className={
                            "font-medium" +
                            (i === segments.length - 1
                              ? " text-text"
                              : " text-text opacity-60")
                          }
                        >
                          <Link href={`/${segments.slice(0, i + 1).join("/")}`}>
                            {seg.charAt(0).toUpperCase() + seg.slice(1)}
                          </Link>
                        </span>
                        {i !== segments.length - 1 && (
                          <span className="text-text opacity-50">
                            <ChevronRight size={18} color="black" />
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm font-medium text-text">Dashboard</p>
        )}
      </div>

      {/* Middle - Search Bar */}
      <div className="hidden md:block mx-2 lg:mx-8 flex-1 max-w-md" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 bg-secondary border border-outline rounded-lg text-xs sm:text-sm text-text placeholder-text placeholder-opacity-50 focus:outline-none focus:bg-forground focus:border-hover transition"
            onChange={(event) => setSearchQuery(event.target.value)}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            value={searchQuery}
          />

          {isSearchOpen && (
            <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg border border-outline bg-forground">
              {isSearchingData && (
                <p className="border-b border-outline px-3 py-2 text-xs text-text-secondary">
                  Searching workspace data...
                </p>
              )}

              {mergedSearchItems.length === 0 ? (
                <p className="px-3 py-3 text-sm text-text-secondary">No results found.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto py-1">
                  {mergedSearchItems.map((item, index) => (
                    <button
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                        index === activeSearchIndex ? "bg-secondary text-text" : "text-text-secondary hover:bg-secondary"
                      }`}
                      key={`${item.type}-${item.href}-${item.label}`}
                      onClick={() => navigateToSearchItem(item)}
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.label}</span>
                        <span className="block truncate text-xs">
                          {item.type === "data" ? `${item.source ?? "Data"} • ${item.preview ?? item.href}` : item.href}
                        </span>
                      </span>
                      <span className="ml-2 shrink-0 rounded-md border border-outline px-1.5 py-0.5 text-[10px] uppercase">
                        {item.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Icons and Avatar */}
      <div className="flex items-center gap-1 sm:gap-3 ml-auto">
        {/* Bell Icon */}
        <div className="relative" ref={panelRef}>
          <button
            aria-label="Open notifications"
            className="relative rounded-lg p-2 text-text transition hover:bg-secondary"
            onClick={() => setIsPanelOpen((prev) => !prev)}
            type="button"
          >
            <Bell className="h-5 w-5" />
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full"
              style={{ background: resolvedBellColor }}
            />
          </button>

          {isPanelOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-16px)] rounded-lg border border-outline bg-forground z-50">
              <div className="flex items-center justify-between border-b border-outline px-3 py-2">
                <p className="text-sm font-semibold text-text">Notifications</p>
                <button
                  className="text-xs font-medium text-text-secondary hover:text-text"
                  onClick={() => void handleReadAll()}
                  type="button"
                >
                  Mark all read
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="px-3 py-4 text-sm text-text-secondary">No notifications yet.</p>
                )}

                {notifications.map((notification) => (
                  <div
                    className={`border-b border-outline px-3 py-3 last:border-b-0 ${notification.isRead ? "opacity-70" : ""}`}
                    key={notification.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${priorityClassMap[notification.priority]}`} />
                          <p className="text-sm font-medium text-text">{notification.title}</p>
                        </div>
                        <p className="mt-1 text-xs text-text-secondary">{notification.message}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wide text-text-secondary">
                          {notification.taskType}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <button
                          aria-label="Mark notification as read"
                          className="rounded-md border border-outline p-1 text-text-secondary hover:bg-secondary hover:text-text"
                          onClick={() => void handleReadOne(notification.id)}
                          type="button"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-outline px-3 py-2">
                <Link
                  className="text-xs font-medium text-text-secondary hover:text-text"
                  href="/dashboard/notifications"
                  onClick={() => setIsPanelOpen(false)}
                >
                  Open notifications page
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden h-6 w-px bg-outline sm:block"></div>

        <ProfileMenu />
      </div>
    </nav>
  );
};

export default Navbar;
