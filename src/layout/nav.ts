import {
  Megaphone,
  BriefcaseBusiness,
  CalendarDays,
  ChartColumn,
  ChartPie,
  CircleCheck,
  CircleHelp,
  ClipboardCheck,
  Clock,
  Folder,
  GraduationCap,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  Network,
  PanelsTopLeft,
  ShieldCheck,
  ShoppingBag,
  Sun,
  User,
  Wallet,
} from "lucide-react";

export type NavItem = {
  id: string;
  to: string;
  icon: LucideIcon;
  /** Permission code (active company) needed to see the item and open the screen. */
  permission?: string;
  /** Plan module (apps.tenants.Module) the screen belongs to. */
  module?: string;
};

/** Icon rail, top to bottom, as in docs/design. Items without a screen yet open a "coming soon" page and are
 * shown to everyone until their module defines permissions. */
export const MAIN_NAV: NavItem[] = [
  { id: "dashboard", to: "/", icon: PanelsTopLeft },
  { id: "approvals", to: "/approvals", icon: CircleCheck },
  { id: "employees", to: "/employees", icon: User, permission: "employees.view", module: "core_hr" },
  // Everyone may have onboarding tasks (a manager's welcome meeting, the new hire's own documents).
  { id: "onboarding", to: "/onboarding", icon: ListChecks, module: "core_hr" },
  { id: "org", to: "/org-chart", icon: Network, permission: "core.view_org", module: "core_hr" },
  // Managers raise requisitions without seeing the pipeline; the screen shows what each may do.
  { id: "recruitment", to: "/recruitment", icon: BriefcaseBusiness, permission: "recruitment.request", module: "recruitment" },
  { id: "payroll", to: "/payroll", icon: Wallet, permission: "payroll.view", module: "payroll" },
  { id: "attendance", to: "/attendance", icon: Clock, permission: "attendance.view", module: "attendance" },
  { id: "calendar", to: "/calendar", icon: CalendarDays },
  { id: "announcements", to: "/announcements", icon: Megaphone },
  { id: "leave", to: "/leave", icon: ClipboardCheck, module: "leave" },
  { id: "documents", to: "/documents", icon: Folder, permission: "employees.view_documents", module: "core_hr" },
  { id: "performance", to: "/performance", icon: ChartPie, permission: "performance.view", module: "performance" },
  { id: "training", to: "/training", icon: GraduationCap, permission: "training.view", module: "training" },
  { id: "compliance", to: "/compliance", icon: ShieldCheck, permission: "compliance.view", module: "compliance" },
  { id: "reports", to: "/reports", icon: ChartColumn, permission: "reports.view", module: "reports" },
  { id: "requests", to: "/requests", icon: MessageSquare, module: "self_service" },
  { id: "custody", to: "/custody", icon: ShoppingBag, permission: "selfservice.view_custody", module: "core_hr" },
];

export const FOOTER_NAV: NavItem[] = [
  { id: "help", to: "/help", icon: CircleHelp },
  // HR (master data) and the account admin (company setup) both have settings; the page lists what each may change.
  { id: "settings", to: "/settings", icon: Sun, permission: "core.manage_master_data" },
];
