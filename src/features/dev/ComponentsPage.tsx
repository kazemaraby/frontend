import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Avatar } from "@/design/Avatar";
import { BarChart } from "@/design/BarChart";
import { Button, IconButton } from "@/design/Button";
import { Calendar } from "@/design/Calendar";
import { Card, CardLink } from "@/design/Card";
import { type Column, DataTable, PersonCell } from "@/design/DataTable";
import { DonutGauge } from "@/design/DonutGauge";
import { Checkbox, SearchInput, Select } from "@/design/Field";
import { KpiTile } from "@/design/KpiTile";
import { Menu, MenuItem } from "@/design/Menu";
import { Money } from "@/design/Money";
import { PageHeader } from "@/design/PageHeader";
import { Pagination } from "@/design/Pagination";
import { Pill, STATUSES, StatusChip, pillTones, type PillTone } from "@/design/Pill";
import { RiyalSign } from "@/design/RiyalSign";
import { Tabs } from "@/design/Tabs";
import { Tooltip } from "@/design/Tooltip";
import { TrendChart } from "@/design/TrendChart";
import { PreviewSession } from "@/auth/PreviewSession";
import { createI18n, dirFor, type Language } from "@/i18n";
import { IconRail } from "@/layout/IconRail";
import { Logo } from "@/layout/Logo";
import { TopBar } from "@/layout/TopBar";
import { useFormat } from "@/lib/useFormat";
import { MOCK_TODAY } from "@/mocks";
import { type PayrollRow, payrollRows } from "@/mocks/payroll";
import { monthlyHires, turnoverTrend } from "@/mocks/reports";

/** Renders its children with their own i18n instance, `lang` and `dir`, so both languages sit side by side. */
function InLanguage({ lng, children }: { lng: Language; children: ReactNode }) {
  const instance = useMemo(() => createI18n(lng), [lng]);
  return (
    <I18nextProvider i18n={instance}>
      <PreviewSession>
        <div lang={lng} dir={dirFor(lng)} className="min-w-0">
          {children}
        </div>
      </PreviewSession>
    </I18nextProvider>
  );
}

function Showcase({ id, wide, children }: { id: string; wide?: boolean; children: () => ReactNode }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby={`dev-${id}`} className="scroll-mt-6" id={id}>
      <h2 id={`dev-${id}`} className="mb-3 text-lg font-semibold">
        {t(`dev.sections.${id}`)}
      </h2>
      <div className={wide ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 gap-4 2xl:grid-cols-2"}>
        {(["ar", "en"] as const).map((lng) => (
          <InLanguage key={lng} lng={lng}>
            <div className="rounded-panel border border-dashed border-line-strong p-4 sm:p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">{t(`dev.languageBadge.${lng}`)}</p>
              {children()}
            </div>
          </InLanguage>
        ))}
      </div>
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

function TabsDemo() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"run" | "additional" | "batches">("run");
  const [period, setPeriod] = useState<"default" | "today" | "d7">("default");
  return (
    <div className="flex flex-col gap-4">
      <Tabs
        label={t("payroll.title")}
        value={tab}
        onChange={setTab}
        items={[
          { id: "run", label: t("payroll.tabs.run") },
          { id: "additional", label: t("payroll.tabs.additional") },
          { id: "batches", label: t("payroll.tabs.batches") },
        ]}
      />
      <Tabs
        variant="segmented"
        label={t("reports.period")}
        value={period}
        onChange={setPeriod}
        className="self-start"
        items={[
          { id: "default", label: t("reports.periods.default") },
          { id: "today", label: t("common.today") },
          { id: "d7", label: t("reports.lastDays", { count: 7 }) },
        ]}
      />
    </div>
  );
}

function TableDemo() {
  const { t } = useTranslation();
  const format = useFormat();
  const [page, setPage] = useState(1);
  const columns: Column<PayrollRow>[] = [
    { id: "no", header: t("payroll.columns.number"), cell: (r) => <span className="num font-semibold">{r.employee_no}</span> },
    { id: "name", header: t("payroll.columns.name"), cell: (r) => <PersonCell name={format.name(r)} /> },
    { id: "net", header: t("payroll.columns.net"), cell: (r) => <Money amount={r.net} className="font-bold" /> },
    { id: "status", header: t("employees.columns.status"), cell: (r) => <StatusChip status={r.end_of_service ? "active" : "pending"} /> },
  ];
  return (
    <>
      <DataTable
        caption={t("dev.sections.dataTable")}
        columns={columns}
        rows={payrollRows.slice(0, 3)}
        rowKey={(r) => String(r.id)}
        rowLabel={(r) => format.name(r)}
        selectable
        onEdit={() => undefined}
        onDelete={() => undefined}
        minWidth={640}
      />
      <Pagination
        page={page}
        pageCount={5}
        onPageChange={setPage}
        summary={t("employees.showing", { from: 1, to: 3, count: 15, total: 15 })}
      />
    </>
  );
}

function MenuDemo() {
  const { t } = useTranslation();
  return (
    <Menu
      trigger={(props) => (
        <Button variant="outline" {...props}>
          {t("dev.openMenu")}
        </Button>
      )}
    >
      {(close) => (
        <>
          <MenuItem active onSelect={close} icon={<Pencil className="size-4" />}>
            {t("common.edit")}
          </MenuItem>
          <MenuItem onSelect={close} icon={<Trash2 className="size-4" />}>
            {t("common.delete")}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

export default function ComponentsPage() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = `${t("dev.title")} · ${t("app.name")}`;
  }, [t]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-10 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-[26px] font-bold sm:text-[34px]">{t("dev.title")}</h1>
            <p className="text-muted">{t("dev.subtitle")}</p>
          </div>
        </div>
        <Link to="/" className="font-semibold text-teal-dark hover:underline">
          {t("dev.backToApp")}
        </Link>
      </header>

      <Showcase id="appShell" wide>
        {() => (
          <div className="flex gap-4 overflow-x-auto rounded-panel bg-white/40 p-3">
            <IconRail preview />
            <div className="min-w-[640px] flex-1">
              <PageHeader
                title={<Trans k="employees.title" />}
                aside={<TopBar />}
                tabs={<TabsDemo />}
                actions={
                  <Button variant="accent" icon={<Plus className="size-[18px]" />}>
                    <Trans k="employees.add" />
                  </Button>
                }
              />
              <ShellContent />
            </div>
          </div>
        )}
      </Showcase>

      <Showcase id="buttons">
        {() => <ButtonsDemo />}
      </Showcase>

      <Showcase id="statusChips">
        {() => <ChipsDemo />}
      </Showcase>

      <Showcase id="money">
        {() => <MoneyDemo />}
      </Showcase>

      <Showcase id="tabs">
        {() => <TabsDemo />}
      </Showcase>

      <Showcase id="fields">
        {() => <FieldsDemo />}
      </Showcase>

      <Showcase id="cards">
        {() => <CardsDemo />}
      </Showcase>

      <Showcase id="dataTable">
        {() => <TableDemo />}
      </Showcase>

      <Showcase id="charts">
        {() => <ChartsDemo />}
      </Showcase>

      <Showcase id="calendar">
        {() => <Calendar today={MOCK_TODAY} marked={["2026-10-14", "2026-10-24", "2026-10-31"]} className="max-w-md" />}
      </Showcase>
    </div>
  );
}

/** Sample page body so the shell preview reads as a whole screen. */
function ShellContent() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <KpiTile label={t("attendance.kpi.present")} value="128" tone="green" />
        <KpiTile label={t("attendance.kpi.late")} value="9" tone="amber" />
        <KpiTile label={t("attendance.kpi.absent")} value="4" tone="red" />
      </div>
      <Card>
        <TableDemo />
      </Card>
    </div>
  );
}

function Trans({ k }: { k: string }) {
  const { t } = useTranslation();
  return <>{t(k)}</>;
}

function ButtonsDemo() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <Row>
        <Button>{t("dashboard.start")}</Button>
        <Button variant="accent" icon={<Plus className="size-[18px]" />}>
          {t("employees.add")}
        </Button>
        <Button variant="outline" icon={<Download className="size-[18px]" />}>
          {t("common.export")}
        </Button>
        <Button variant="ghost">{t("common.viewAll")}</Button>
        <Button variant="outline" disabled>
          {t("dashboard.end")}
        </Button>
      </Row>
      <Row>
        <IconButton label={t("common.add")} icon={<Plus />} />
        <IconButton variant="outline" label={t("dashboard.customize")} icon={<Pencil />} />
        <IconButton variant="solid" label={t("common.add")} icon={<Plus />} />
        <IconButton size="sm" variant="plain" label={t("common.edit")} icon={<Pencil />} />
        <IconButton size="sm" variant="danger" label={t("common.delete")} icon={<Trash2 />} />
        <Tooltip label={t("dev.tooltipSample")}>
          <span tabIndex={0} className="rounded-full bg-white px-4 py-2 text-sm">
            {t("dev.hoverMe")}
          </span>
        </Tooltip>
      </Row>
      <Row>
        <Avatar name={t("dev.sampleName")} />
        <Avatar name={t("dev.sampleName")} size="md" />
        <Avatar name={t("dev.sampleName")} tone="peach" size="md" />
        <Avatar name={t("dev.sampleName")} tone="forest" size="md" />
        <Avatar name={t("dev.sampleName")} tone="navy" size="md" />
        <Avatar name={t("dev.sampleName")} tone="teal" size="lg" />
      </Row>
    </div>
  );
}

function ChipsDemo() {
  return (
    <div className="flex flex-col gap-3">
      <Row>
        {STATUSES.map((s) => (
          <StatusChip key={s} status={s} />
        ))}
      </Row>
      <Row>
        {(Object.keys(pillTones) as PillTone[]).map((tone) => (
          <Pill key={tone} tone={tone}>
            <code dir="ltr">{tone}</code>{/* design-token name, shown as code on purpose */}
          </Pill>
        ))}
      </Row>
    </div>
  );
}

function MoneyDemo() {
  const format = useFormat();
  return (
    <div className="flex flex-col gap-3">
      <Row>
        <Money amount="149735.00" className="text-[28px] font-bold" signClassName="text-muted" />
        <Money amount="1000000.63" className="text-xl font-bold" />
        <Money amount="16000.00" />
        <Money amount="1560.00" className="text-danger" />
        <Money amount="2500.50" currency="USD" />
        <RiyalSign className="h-8 w-auto text-teal-dark" />
      </Row>
      <p className="num text-sm text-muted">
        {format.date("2026-10-21")} · {format.hijri("2026-10-21")} · {format.timeRange("08:30", "16:00")}
      </p>
    </div>
  );
}

function FieldsDemo() {
  const { t } = useTranslation();
  return (
    <Row>
      <SearchInput label={t("common.search")} placeholder={t("common.searchPlaceholder")} className="w-64" />
      <Select
        label={t("employees.allStatuses")}
        options={[
          { value: "", label: t("employees.allStatuses") },
          { value: "active", label: t("status.active") },
        ]}
      />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox label={t("common.selectAll")} defaultChecked />
        {t("common.selectAll")}
      </label>
      <MenuDemo />
    </Row>
  );
}

function CardsDemo() {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={t("dashboard.whoIsAway")} subtitle={t("reports.lastMonths", { count: 3 })} action={<CardLink>{t("common.viewAll")}</CardLink>}>
        <Card variant="inset" padding="md">
          {t("dev.cardBody")}
        </Card>
      </Card>
      <Card draggable title={t("reports.newHires")} subtitle="2026">
        <Card variant="inset" padding="md">
          {t("dev.cardBody")}
        </Card>
      </Card>
      <KpiTile label={t("payroll.kpi.net", { month: format.date("2026-10-01", "monthYear") })} value={<Money amount="149735" signClassName="text-muted" />} />
      <div className="grid grid-cols-2 gap-4">
        <KpiTile label={t("attendance.kpi.present")} value="128" tone="green" />
        <KpiTile label={t("attendance.kpi.absent")} value="4" tone="red" />
      </div>
    </div>
  );
}

function ChartsDemo() {
  const { t } = useTranslation();
  const format = useFormat();
  const months = format.months();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-around gap-6 rounded-card bg-white p-5">
        <DonutGauge value={90} label="90%" tone="tealDark" />
        <DonutGauge value={75} label={t("reports.hours", { count: 45 })}>
          <span className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold">{format.number(45)}</span>
            <span className="text-sm text-muted">{t("reports.hoursUnit", { count: 45 })}</span>
          </span>
        </DonutGauge>
      </div>
      <div className="rounded-card bg-white p-4">
        <BarChart
          label={t("reports.newHires")}
          data={monthlyHires.map((value, i) => ({ label: months[i], value }))}
          highlight={7}
          ticks={[0, 25, 50, 75, 100]}
          height={220}
        />
      </div>
      <div className="rounded-card bg-white p-4">
        <TrendChart
          label={t("reports.turnoverTrends")}
          primaryLabel={t("reports.retention")}
          secondaryLabel={t("reports.turnover")}
          data={turnoverTrend.map((p) => ({ label: p.month === null ? "" : months[p.month], primary: p.retention, secondary: p.turnover }))}
          ticks={[50, 80, 100]}
          height={220}
        />
      </div>
    </div>
  );
}
