import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/design/PageHeader";
import { Pill } from "@/design/Pill";

import { Logo } from "./Logo";
import { TopBar } from "./TopBar";

type Props = {
  title: string;
  tabs?: ReactNode;
  actions?: ReactNode;
  /** Extra header row (period picker). */
  toolbar?: ReactNode;
  /** The screen shows sample data until its module is built: say so, so nobody acts on the numbers. */
  sample?: boolean;
  children: ReactNode;
};

/** Page frame: title + top bar, tabs + actions, then content. Sets the document title. */
export function Page({ title, tabs, actions, toolbar, sample, children }: Props) {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = `${title} · ${t("app.name")}`;
  }, [title, t]);

  return (
    <>
      <PageHeader title={title} leading={<Logo className="size-9 lg:hidden" />} aside={<TopBar />} tabs={tabs} actions={actions}>
        {(toolbar || sample) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {toolbar}
            {sample && (
              <Pill tone="amber" size="md" className="ms-auto">
                {t("common.sampleData")}
              </Pill>
            )}
          </div>
        )}
      </PageHeader>
      {children}
    </>
  );
}
