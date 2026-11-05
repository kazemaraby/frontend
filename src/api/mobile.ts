import { api } from "./index";

/** The mobile app, before sign-in (backend apps/mobile): the store links and the company's name, the QR code of the
 * company's /app link. */
export type MobileConfig = {
  min_version: string;
  latest_version: string;
  store: { ios: string; android: string };
  tenant: { name_ar: string; name_en: string };
};

export const mobileApi = {
  config: () => api.get<MobileConfig>("/mobile/config"),
  qrUrl: "/api/v1/mobile/qr.svg",
};
