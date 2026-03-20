"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  HandCoins,
  House,
  Ratio,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavSubItem = {
  label: string;
  href: string;
};

type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavSubItem[];
};

type NavGroup = {
  title?: string;
  items: NavItem[];
};

type AgencyType= {
    name: string;
    team: string;
    Logo: React.ReactNode;
}

const AGENCY: AgencyType = {
    name: "Orbix Studio",
    team: "Orbix Studio Team",
    Logo: <Building2 size={15} />
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { key: "home", label: "Home", icon: House, href: "/dashboard" },
      { key: "tasks", label: "Tasks", icon: ClipboardList, href: "/dashboard/tasks" },
      {
        key: "transactions",
        label: "Transactions",
        icon: CircleDollarSign,
        href: "/dashboard/transactions",
      },
      { key: "payments", label: "Payments", icon: ReceiptText, href: "/dashboard/payments" },
      { key: "cards", label: "Cards", icon: CreditCard, href: "/dashboard/cards" },
      { key: "capital", label: "Capital", icon: WalletCards, href: "/dashboard/capital" },
      { key: "accounts", label: "Accounts", icon: Building2, href: "/dashboard/accounts" },
    ],
  },
  {
    title: "Workflows",
    items: [
      { key: "bill-pay", label: "Bill Pay", icon: BadgeDollarSign, href: "/dashboard/bill-pay" },
      {
        key: "invoicing",
        label: "Invoicing",
        icon: ReceiptText,
        children: [
          { label: "Catalog", href: "/dashboard/catalog" },
          { label: "Customers", href: "/dashboard/customers" },
        ],
      },
      {
        key: "reimbursements",
        label: "Reimbursements",
        icon: HandCoins,
        href: "/dashboard/reimbursements",
      },
      { key: "accounting", label: "Accounting", icon: BookOpen, href: "/dashboard/accounting" },
    ],
  },
   {
    title: "KIKO AI",
    items: [
      {
        key: "KIKO",
        label: "Agent Space",
        icon: Ratio,
        children: [
          { label: "agent", href: "/dashboard/kiko/agent" },
        ],
      },
    ],
  },
];

interface SidePanelProps {
  isCollapsed: boolean;
}

const SidePanel = ({ isCollapsed }: SidePanelProps) => {
  const pathname = usePathname() ?? "";
  const [mounted, setMounted] = React.useState(false);
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentPath = mounted ? pathname : "";

  const isPathActive = (href: string) => {
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  const hasActiveChild = (item: NavItem) => {
    return item.children?.some((child) => isPathActive(child.href)) ?? false;
  };

  const hasChildren = (item: NavItem) => {
    return (item.children?.length ?? 0) > 0;
  };

  const isItemActive = (item: NavItem) => {
    if (item.href && isPathActive(item.href)) return true;
    return hasActiveChild(item);
  };

  const isSectionOpen = (item: NavItem) => {
    const explicit = openSections[item.key];
    if (typeof explicit === "boolean") {
      return explicit;
    }
    return hasActiveChild(item);
  };

  const toggleSection = (key: string, currentValue: boolean) => {
    setOpenSections((prev) => ({ ...prev, [key]: !currentValue }));
  };

  return (
    <aside className="h-full bg-forground border-r border-outline px-3 py-3">
      {/* <div className="rounded-xl border border-outline bg-forground p-3">
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
          <div className="grid h-6 w-6 place-items-center rounded-lg bg-[#0B4A4D] text-white">
            {AGENCY.Logo}
          </div>

          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                animate={{ opacity: 1, width: "auto" }}
                className="min-w-0 flex-1 overflow-hidden"
                exit={{ opacity: 0, width: 0 }}
                initial={{ opacity: 0, width: 0 }}
              >
                <p className="text-[12px] leading-none text-text-secondary">Agency</p>
                <p className="truncate pt-1 text-[12px] font-medium bg-secondary leading-none text-text">
                  {AGENCY.team}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                initial={{ opacity: 0, x: 6 }}
              >
                <ChevronDown size={16} className="text-text-secondary" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div> */}

      {NAV_GROUPS.map((group, groupIndex) => (
        <React.Fragment key={group.title ?? `group-${groupIndex}`}>
          {groupIndex > 0 && <div className="my-4 border-t border-outline" />}

          <AnimatePresence initial={false}>
            {!isCollapsed && group.title && (
              <motion.p
                animate={{ opacity: 1, y: 0 }}
                className="px-3 pb-2 text-[13px] font-medium text-text"
                exit={{ opacity: 0, y: -4 }}
                initial={{ opacity: 0, y: -4 }}
              >
                {group.title}
              </motion.p>
            )}
          </AnimatePresence>

          <nav className={group.title ? "space-y-1" : "mt-4 space-y-1"}>
            {group.items.map((item) => {
              const Icon = item.icon;
              const itemHasChildren = hasChildren(item);
              const itemActive = isItemActive(item);
              const sectionOpen = isSectionOpen(item);
              const showChildren = !isCollapsed && itemHasChildren && sectionOpen;

              return (
                <div key={item.key}>
                  {itemHasChildren ? (
                    <button
                      className={`w-full flex items-center rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                        isCollapsed ? "justify-center" : "gap-3"
                      } ${
                        itemActive
                          ? "bg-hover text-(--color--hover-text-content)"
                          : "text-text hover:bg-hover hover:text-(--color--hover-text-content)"
                      }`}
                      onClick={() => toggleSection(item.key, sectionOpen)}
                      title={isCollapsed ? item.label : undefined}
                      type="button"
                    >
                      <Icon size={19} />

                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.span
                            animate={{ opacity: 1, width: "auto" }}
                            className="flex-1 text-left overflow-hidden"
                            exit={{ opacity: 0, width: 0 }}
                            initial={{ opacity: 0, width: 0 }}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 8 }}
                            initial={{ opacity: 0, rotate: 8 }}
                          >
                            {sectionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  ) : (
                    <Link
                      className={`w-full flex items-center rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                        isCollapsed ? "justify-center" : "gap-3"
                      } ${
                        itemActive
                          ? "bg-hover text-(--color--hover-text-content)"
                          : "text-text hover:bg-hover hover:text-(--color--hover-text-content)"
                      }`}
                      href={item.href ?? "/dashboard"}
                      prefetch={false}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <Icon size={19} />

                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.span
                            animate={{ opacity: 1, width: "auto" }}
                            className="flex-1 text-left overflow-hidden"
                            exit={{ opacity: 0, width: 0 }}
                            initial={{ opacity: 0, width: 0 }}
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  )}

                  <AnimatePresence initial={false}>
                    {showChildren && item.children && item.children.length > 0 && (
                      <motion.div
                        animate={{ opacity: 1, height: "auto" }}
                        className="ml-10 space-y-0.5 pt-1 text-[15px] overflow-hidden"
                        exit={{ opacity: 0, height: 0 }}
                        initial={{ opacity: 0, height: 0 }}
                      >
                        {item.children?.map((subItem) => {
                          const subActive = isPathActive(subItem.href);
                          return (
                            <Link
                              key={subItem.href}
                              className={`block w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
                                subActive
                                  ? "bg-hover text-(--color--hover-text-content)"
                                  : "text-text hover:bg-hover hover:text-(--color--hover-text-content)"
                              }`}
                              href={subItem.href}
                              prefetch={false}
                            >
                              {subItem.label}
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>
        </React.Fragment>
      ))}
    </aside>
  );
};

export default SidePanel;