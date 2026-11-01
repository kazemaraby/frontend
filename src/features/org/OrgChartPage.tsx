import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Users } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

import { hr, type OrgDepartment, type OrgPerson } from "@/api/hr";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Avatar } from "@/design/Avatar";
import { Card } from "@/design/Card";
import { cn } from "@/design/cn";
import { Pill } from "@/design/Pill";
import { Tabs } from "@/design/Tabs";
import { Page } from "@/layout/Page";
import { useFormat } from "@/lib/useFormat";

type Node<T> = { item: T; children: Node<T>[] };

/** Builds a forest from a flat list: anyone whose parent isn't in the list is a root (e.g. a manager outside the
 * user's scope). Cycles can't occur: the backend refuses them. */
function forest<T extends { id: number }>(items: T[], parentOf: (item: T) => number | null): Node<T>[] {
  const nodes = new Map(items.map((item) => [item.id, { item, children: [] as Node<T>[] }]));
  const roots: Node<T>[] = [];
  for (const node of nodes.values()) {
    const parent = parentOf(node.item);
    const owner = parent !== null ? nodes.get(parent) : undefined;
    (owner ? owner.children : roots).push(node);
  }
  return roots;
}

/** /org-chart (#37): the department tree with each head and head count, and the reporting lines (who reports to
 * whom), limited to the people the user may see. */
export default function OrgChartPage() {
  const { t } = useTranslation();
  const scopeKey = useScopeKey();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "people" ? "people" : "departments";
  const chart = useQuery({ queryKey: ["org-chart", ...scopeKey], queryFn: hr.orgChart });
  const people = new Map((chart.data?.people ?? []).map((p) => [p.id, p]));

  return (
    <Page
      title={t("org.title")}
      tabs={
        <Tabs
          label={t("org.title")}
          value={view}
          onChange={(v) => setParams(v === "departments" ? {} : { view: v }, { replace: true })}
          items={[
            { id: "departments", label: t("org.departments") },
            { id: "people", label: t("org.people") },
          ]}
        />
      }
    >
      <Card>
        {chart.isError && <Alert>{t("common.loadFailed")}</Alert>}
        {chart.isPending && <p className="text-muted">{t("common.loading")}</p>}
        {chart.data && view === "departments" && (
          <Tree
            label={t("org.departments")}
            nodes={forest(chart.data.departments, (d) => d.parent)}
            empty={t("org.noDepartments")}
            render={(d) => <DepartmentCard department={d} head={d.manager ? people.get(d.manager) : undefined} />}
          />
        )}
        {chart.data && view === "people" && (
          <Tree
            label={t("org.people")}
            nodes={forest(chart.data.people, (p) => p.manager)}
            empty={t("org.noPeople")}
            render={(p) => <PersonCard person={p} />}
          />
        )}
      </Card>
    </Page>
  );
}

function Tree<T extends { id: number }>({
  label,
  nodes,
  render,
  empty,
}: {
  label: string;
  nodes: Node<T>[];
  render: (item: T) => ReactNode;
  empty: string;
}) {
  if (!nodes.length) return <p className="text-muted">{empty}</p>;
  return (
    <ul role="tree" aria-label={label} className="flex flex-col gap-3">
      {nodes.map((node) => (
        <Branch key={node.item.id} node={node} render={render} depth={0} />
      ))}
    </ul>
  );
}

function Branch<T extends { id: number }>({ node, render, depth }: { node: Node<T>; render: (item: T) => ReactNode; depth: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-level={depth + 1} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t("org.collapse") : t("org.expand")}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-muted hover:bg-neutral-soft"
          >
            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", !open && "-rotate-90 rtl:rotate-90")} />
          </button>
        ) : (
          <span aria-hidden="true" className="size-8 shrink-0" />
        )}
        {render(node.item)}
      </div>
      {hasChildren && open && (
        <ul role="group" className="ms-4 flex flex-col gap-3 border-s-2 border-line ps-6">
          {node.children.map((child) => (
            <Branch key={child.item.id} node={child} render={render} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function DepartmentCard({ department, head }: { department: OrgDepartment; head?: OrgPerson }) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-tile bg-white px-4 py-3 shadow-soft sm:flex-none sm:min-w-80">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{format.name(department)}</p>
        <p className="text-sm text-muted">
          {head ? (
            <Link to={`/employees/${head.id}`} className="hover:underline">
              {t("org.headedBy", { name: format.name(head) })}
            </Link>
          ) : (
            t("org.noHead")
          )}
        </p>
      </div>
      <Pill tone="teal" icon={<Users aria-hidden="true" />}>
        {format.number(department.head_count)}
        <span className="sr-only">{t("org.headCount")}</span>
      </Pill>
    </div>
  );
}

function PersonCard({ person }: { person: OrgPerson }) {
  const format = useFormat();
  return (
    <Link
      to={`/employees/${person.id}`}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-tile bg-white px-4 py-3 shadow-soft hover:bg-neutral-soft sm:flex-none sm:min-w-72"
    >
      <Avatar name={format.name(person)} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{format.name(person)}</span>
        <span className="num block truncate text-sm text-muted">
          {[person.job_title && format.pick(person.job_title), person.employee_no].filter(Boolean).join(" · ")}
        </span>
      </span>
    </Link>
  );
}
