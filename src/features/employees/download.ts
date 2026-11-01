import type { FileLink } from "@/api/hr";

/** Asks the API for a short-lived signed link (it checks the permission) and opens it: PDFs and images are shown
 * in a new tab, other files download. */
export async function openFile(link: () => Promise<FileLink>) {
  const tab = window.open("", "_blank"); // opened synchronously so the browser doesn't treat it as a popup
  try {
    const { url } = await link();
    if (tab) tab.location.href = `${url}?inline=1`;
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}
