/** Announcements and event RSVPs (Phase 6 task 20). Shapes follow apps/announcements/views.py. */

import type { FileLink } from "./hr";
import { api, type Named, type Page } from "./index";

export type Audience = "company" | "branch" | "department";
export type AnnouncementBody = { title_ar: string; title_en: string; body_ar: string; body_en: string; audience: Audience; branch: number | null; department: number | null; publish_at: string; expires_at: string | null; pinned: boolean; requires_ack: boolean };
export type Announcement = AnnouncementBody & {
  id: number;
  published_at: string | null;
  info: { read_at: string | null; acknowledged_at: string | null; branch: Named | null; department: Named | null; attachments: { id: number; name: string; size: number }[]; live: boolean };
};
export type Receipts = { audience: number; read: number; acknowledged: number; pending: (Named & { id: number; email: string })[] };
export type RsvpAnswer = "yes" | "maybe" | "no";
export type Rsvp = { mine: RsvpAnswer | null; counts: Record<RsvpAnswer, number>; people?: (Named & { answer: RsvpAnswer })[] };

export const announcementsApi = {
  list: (current?: boolean) => api.get<Page<Announcement>>("/announcements", { page_size: 50, current: current ? "1" : undefined }),
  get: (id: number) => api.get<Announcement>(`/announcements/${id}`),
  save: (body: AnnouncementBody & { id?: number }) => (body.id ? api.patch<Announcement>(`/announcements/${body.id}`, body) : api.post<Announcement>("/announcements", body)),
  remove: (id: number) => api.del(`/announcements/${id}`),
  read: (id: number) => api.post<Announcement>(`/announcements/${id}/read`, {}),
  acknowledge: (id: number) => api.post<Announcement>(`/announcements/${id}/acknowledge`, {}),
  receipts: (id: number) => api.get<Receipts>(`/announcements/${id}/receipts`),
  attach: (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<Announcement>(`/announcements/${id}/attachments`, form);
  },
  attachment: (id: number, aid: number) => api.get<FileLink>(`/announcements/${id}/attachments/${aid}`),
  rsvp: (event: number) => api.get<Rsvp>(`/company-events/${event}/rsvp`),
  answer: (event: number, answer: RsvpAnswer) => api.post<Rsvp>(`/company-events/${event}/rsvp`, { answer }),
};
