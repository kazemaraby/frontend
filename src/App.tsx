import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";

import { ApiError } from "./api";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth, RequirePermission } from "./auth/guards";
import { useDocumentLanguage } from "./i18n";
import NoAccessPage from "./features/misc/NoAccessPage";
import RouteErrorPage from "./features/misc/RouteErrorPage";
import { AppShell } from "./layout/AppShell";

type Module = { default: ComponentType };

/** Lazy route. With a permission code / plan module, the screen is replaced by the "no access" page when the user
 * lacks the permission in the active company or the module is not in the tenant's plan. */
const page = (load: () => Promise<Module>, permission?: string, module?: string) => async () => {
  const Screen = (await load()).default;
  if (!permission && !module) return { Component: Screen };
  return {
    Component: () => (
      <RequirePermission code={permission} module={module}>
        <Screen />
      </RequirePermission>
    ),
  };
};

const router = createBrowserRouter([
  { path: "/login", HydrateFallback: () => null, lazy: page(() => import("./features/auth/LoginPage")) },
  // Public: the invitation / new password link e-mailed to a user (Settings → Users and roles).
  { path: "/set-password/:uid/:token", HydrateFallback: () => null, lazy: page(() => import("./features/auth/SetPasswordPage")) },
  // Public: the company's link for the mobile app (stores, company code, QR code); opens the app when it's installed.
  { path: "/app", HydrateFallback: () => null, lazy: page(() => import("./features/mobile/AppPage")) },
  // Public: the privacy policy of the website and the app (the stores link to it).
  { path: "/privacy", HydrateFallback: () => null, lazy: page(() => import("./features/privacy/PrivacyPage")) },
  // Public: the QR code on a letter opens this without signing in.
  { path: "/verify/:token", HydrateFallback: () => null, lazy: page(() => import("./features/letters/VerifyPage")) },
  // Public: the careers page (Phase 6 task 2), no sign-in.
  { path: "/careers", HydrateFallback: () => null, lazy: page(() => import("./features/careers/CareersPage")) },
  { path: "/careers/my-data", HydrateFallback: () => null, lazy: async () => ({ Component: (await import("./features/careers/MyDataPage")).MyDataRequestPage }) },
  { path: "/careers/my-data/:token", HydrateFallback: () => null, lazy: page(() => import("./features/careers/MyDataPage")) },
  { path: "/careers/:id", HydrateFallback: () => null, lazy: page(() => import("./features/careers/CareersOpeningPage")) },
  // Public: the candidate's job offer (task 5), opened from the e-mailed signed link.
  { path: "/offer/:token", HydrateFallback: () => null, lazy: page(() => import("./features/careers/OfferPage")) },
  {
    Component: RequireAuth,
    HydrateFallback: () => null,
    children: [
      {
        path: "/",
        Component: AppShell,
        children: [
          {
            // A screen that throws shows an error card inside the shell (menu and top bar stay usable).
            ErrorBoundary: RouteErrorPage,
            children: [
          { index: true, lazy: page(() => import("./features/dashboard/DashboardPage")) },
          { path: "employees", lazy: page(() => import("./features/employees/EmployeesPage"), "employees.view", "core_hr") },
          {
            path: "employees/import",
            lazy: page(() => import("./features/imports/ImportPage"), "employees.import", "core_hr"),
          },
          {
            path: "employees/new",
            lazy: page(() => import("./features/employees/NewEmployeePage"), "employees.create", "core_hr"),
          },
          {
            path: "employees/:id",
            lazy: page(() => import("./features/employees/profile/EmployeeProfilePage"), "employees.view", "core_hr"),
          },
          {
            path: "documents",
            lazy: page(() => import("./features/documents/DocumentExpiryPage"), "employees.view_documents", "core_hr"),
          },
          { path: "org-chart", lazy: page(() => import("./features/org/OrgChartPage"), "core.view_org", "core_hr") },
          { path: "settings", lazy: page(() => import("./features/setup/SettingsPage")) },
          { path: "settings/setup", lazy: page(() => import("./features/setup/SetupPage"), "core.manage_companies") },
          { path: "settings/leave/import", lazy: page(() => import("./features/leave/ImportBalancesPage"), "leave.manage_balances") },
          { path: "settings/travel", lazy: page(() => import("./features/selfservice/TravelSettingsPage"), "selfservice.manage_travel") },
          { path: "settings/attendance", lazy: page(() => import("./features/attendance/AttendanceSettingsPage"), "attendance.manage", "attendance") },
          { path: "settings/payroll", lazy: page(() => import("./features/payroll/PayrollSettingsPage"), "payroll.view", "payroll") },
          { path: "compliance", lazy: page(() => import("./features/compliance/CompliancePage"), "compliance.view", "compliance") },
          { path: "settings/compliance", lazy: page(() => import("./features/compliance/ComplianceSettingsPage"), "compliance.view", "compliance") },
          { path: "settings/letters", lazy: page(() => import("./features/letters/LettersSettingsPage"), "selfservice.manage_letters") },
          { path: "settings/leave", lazy: page(() => import("./features/leave/LeaveSettingsPage"), "leave.manage_types") },
          { path: "settings/holidays", lazy: page(() => import("./features/calendar/HolidaysPage"), "leave.manage_calendar") },
          { path: "custody", lazy: page(() => import("./features/custody/CustodyPage"), "selfservice.view_custody", "core_hr") },
          { path: "requests", lazy: page(() => import("./features/selfservice/SelfServicePage"), "selfservice.submit", "self_service") },
          { path: "leave", lazy: page(() => import("./features/leave/LeavePage"), undefined, "leave") },
          { path: "calendar", lazy: page(() => import("./features/calendar/CalendarPage")) },
          { path: "settings/users", lazy: page(() => import("./features/users/UsersPage"), "core.manage_users") },
          { path: "settings/billing", lazy: page(() => import("./features/billing/BillingPage"), "core.manage_billing") },
          { path: "settings/api", lazy: page(() => import("./features/apiClients/ApiClientsPage"), undefined, "api") },
          { path: "settings/workflows", lazy: page(() => import("./features/workflow/RoutesPage"), "workflow.manage") },
          { path: "settings/workflows/new", lazy: page(() => import("./features/workflow/RouteEditorPage"), "workflow.manage") },
          { path: "settings/workflows/:id", lazy: page(() => import("./features/workflow/RouteEditorPage"), "workflow.manage") },
          {
            path: "settings/master-data",
            lazy: page(() => import("./features/setup/MasterDataPage"), "core.manage_master_data", "core_hr"),
          },
          { path: "me", lazy: page(() => import("./features/employees/MyFilePage")) },
          { path: "onboarding", lazy: page(() => import("./features/onboarding/OnboardingPage"), undefined, "core_hr") },
          { path: "payroll", lazy: page(() => import("./features/payroll/PayrollPage"), "payroll.view", "payroll") },
          { path: "payroll/import-additional", lazy: page(() => import("./features/payroll/ImportAdditionalPage"), "payroll.manage", "payroll") },
          { path: "payslips", lazy: page(() => import("./features/payroll/MyPayslipsPage"), undefined, "payroll") },
          { path: "payroll/import-advances", lazy: page(() => import("./features/payroll/ImportAdvancesPage"), "payroll.manage", "payroll") },
          {
            path: "attendance",
            lazy: page(() => import("./features/attendance/AttendancePage"), "attendance.view", "attendance"),
          },
          {
            path: "attendance/import-people",
            lazy: page(() => import("./features/attendance/ImportPeoplePage"), "attendance.manage", "attendance"),
          },
          { path: "performance", lazy: page(() => import("./features/performance/PerformancePage"), "performance.view", "performance") },
          { path: "interviews", lazy: page(() => import("./features/recruitment/MyInterviewsPage"), undefined, "recruitment") },
          { path: "recruitment", lazy: page(() => import("./features/recruitment/RecruitmentPage"), undefined, "recruitment") },
          { path: "announcements", lazy: page(() => import("./features/announcements/AnnouncementsPage")) },
          { path: "announcements/:id", lazy: page(() => import("./features/announcements/AnnouncementsPage")) },
          { path: "training", lazy: page(() => import("./features/training/TrainingPage"), "training.view", "training") },
          { path: "reports", lazy: page(() => import("./features/reports/ReportsPage"), "reports.view", "reports") },
          { path: "reports/files/:token", lazy: page(() => import("./features/reports/ReportFilePage")) },
          { path: "approvals", lazy: page(() => import("./features/approvals/ApprovalsPage")) },
          { path: "notifications", lazy: page(() => import("./features/notifications/NotificationsPage")) },
          { path: "no-access", Component: NoAccessPage },
          { path: "*", lazy: page(() => import("./features/misc/ComingSoonPage")) },
            ],
          },
        ],
      },
    ],
  },
  { path: "/dev/components", HydrateFallback: () => null, lazy: page(() => import("./features/dev/ComponentsPage")) },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      // 4xx answers (no access, not found, bad filter) won't change on retry.
      retry: (failures, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 2,
    },
  },
});

export function App() {
  useDocumentLanguage();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
