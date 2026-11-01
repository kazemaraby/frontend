import { Outlet } from "react-router";

import { ComposerProvider } from "@/features/selfservice/composer";

import { IconRail } from "./IconRail";

/** Icon rail on the start side (right in Arabic), page content beside it. Pages render their own <Page> header.
 * The request composer (new request / correct a returned one) is available on every page. */
export function AppShell() {
  return (
    <ComposerProvider>
      <div className="flex min-h-dvh">
        <IconRail />
        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pe-8 lg:ps-2 lg:pt-6">
          <Outlet />
        </main>
      </div>
    </ComposerProvider>
  );
}
