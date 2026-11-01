import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocateFixed, MapPin, Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type Branch, hr } from "@/api/hr";
import { useScopeKey } from "@/auth/session";
import { Alert } from "@/design/Alert";
import { Button, IconButton } from "@/design/Button";
import { Card } from "@/design/Card";
import { Dialog } from "@/design/Dialog";
import { TextField } from "@/design/Field";
import { Pill } from "@/design/Pill";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

/** Geofences (Phase 3 task 8): each branch's circle for web check-in — a centre and a radius. Inside a branch with one,
 * checking in and out needs an accurate location within it (outside is refused unless an approved remote-work day or
 * mission covers the time); a branch without one isn't checked. */
export function GeofencesTab() {
  const { t } = useTranslation();
  const format = useFormat();
  const scope = useScopeKey();
  const branches = useQuery({ queryKey: ["branches", "geofences", ...scope], queryFn: hr.branches });
  const [editing, setEditing] = useState<Branch | null>(null);
  return (
    <Card variant="solid" title={t("geofences.title")} subtitle={t("geofences.hint")}>
      <ul aria-label={t("geofences.title")} className="flex flex-col divide-y divide-line">
        {(branches.data?.results ?? [])
          .filter((b) => b.is_active)
          .map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
              <MapPin aria-hidden="true" className="size-4 shrink-0 text-teal-dark" />
              <span className="min-w-40 font-semibold text-ink">{format.name(b)}</span>
              {b.geofence_radius_m ? (
                <>
                  <span dir="ltr" className="num text-sm text-muted">
                    {Number(b.geofence_lat).toFixed(5)}, {Number(b.geofence_lng).toFixed(5)}
                  </span>
                  <Pill tone="teal">{t("geofences.radius", { metres: b.geofence_radius_m })}</Pill>
                </>
              ) : (
                <Pill>{t("geofences.none")}</Pill>
              )}
              <IconButton className="ms-auto" size="sm" variant="plain" label={t("common.editNamed", { name: format.name(b) })} icon={<Pencil />} onClick={() => setEditing(b)} />
            </li>
          ))}
      </ul>
      {editing && <GeofenceDialog branch={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function GeofenceDialog({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const [v, setV] = useState({ lat: branch.geofence_lat ?? "", lng: branch.geofence_lng ?? "", radius: branch.geofence_radius_m ? String(branch.geofence_radius_m) : "200" });
  const [locating, setLocating] = useState<"" | "busy" | "failed">("");
  const save = useMutation({
    mutationFn: (clear: boolean) =>
      hr.updateBranch(
        branch.id,
        clear
          ? { geofence_lat: null, geofence_lng: null, geofence_radius_m: null }
          : { geofence_lat: Number(v.lat).toFixed(6), geofence_lng: Number(v.lng).toFixed(6), geofence_radius_m: Number(v.radius) },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      onClose();
    },
  });
  const errors = apiErrors(save.error, t("common.saveFailed"));
  const here = () => {
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setV((x) => ({ ...x, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }));
        setLocating("");
      },
      () => setLocating("failed"),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };
  const filled = v.lat.trim() && v.lng.trim() && v.radius.trim();
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("geofences.edit", { name: format.name(branch) })}
      footer={
        <>
          {branch.geofence_radius_m && (
            <Button variant="outline" className="me-auto" disabled={save.isPending} onClick={() => save.mutate(true)}>
              {t("geofences.remove")}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!filled || save.isPending} onClick={() => save.mutate(false)}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t("geofences.dialogHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t("geofences.latitude")} name="geofence_lat" dir="ltr" inputMode="decimal" value={v.lat} onChange={(e) => setV({ ...v, lat: e.target.value })} error={errors.fields.geofence_lat} />
          <TextField label={t("geofences.longitude")} name="geofence_lng" dir="ltr" inputMode="decimal" value={v.lng} onChange={(e) => setV({ ...v, lng: e.target.value })} error={errors.fields.geofence_lng} />
          <TextField label={t("geofences.radiusLabel")} name="geofence_radius_m" dir="ltr" inputMode="numeric" value={v.radius} onChange={(e) => setV({ ...v, radius: e.target.value })} error={errors.fields.geofence_radius_m} />
        </div>
        {"geolocation" in navigator && (
          <Button variant="ghost" size="sm" className="self-start" icon={<LocateFixed className="size-4" />} iconPosition="start" disabled={locating === "busy"} onClick={here}>
            {t("geofences.useHere")}
          </Button>
        )}
        {locating === "failed" && <Alert>{t("geofences.locateFailed")}</Alert>}
        {errors.general && <Alert>{errors.general}</Alert>}
      </div>
    </Dialog>
  );
}
