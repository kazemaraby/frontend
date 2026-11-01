import { Camera, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { CheckField } from "@/design/Field";
import { Dialog } from "@/design/Dialog";

/** Asks once for the employee's consent to a selfie with their web check-ins (decision 5, PDPL): what it is for, how
 * long it is kept, that it is never matched against faces, and that it can be withdrawn. */
export function ConsentDialog({ keepDays, busy, onAgree, onClose }: { keepDays: number; busy: boolean; onAgree: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("selfie.consentTitle")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!agreed || busy} onClick={onAgree}>
            {t("selfie.agree")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-ink">
        <p>{t("selfie.why")}</p>
        <ul className="list-disc ps-5 text-muted">
          <li>{t("selfie.kept", { days: keepDays })}</li>
          <li>{t("selfie.noMatching")}</li>
          <li>{t("selfie.who")}</li>
          <li>{t("selfie.withdraw")}</li>
        </ul>
        <CheckField label={t("selfie.agreeBox")} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
      </div>
    </Dialog>
  );
}

/** The front camera: a still photo (JPEG, at most 640 px wide) to send with the punch. */
export function CameraDialog({ title, busy, onUse, onClose }: { title: string; busy: boolean; onUse: (photo: Blob) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [failed, setFailed] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [ready, setReady] = useState(false); // the video has a frame to take

  useEffect(() => {
    let live: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setFailed(true);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((track) => track.stop());
        live = s;
        setStream(s);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      live?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    if (video.current && stream) video.current.srcObject = stream;
  }, [stream, photo]);
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  const take = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 640 / v.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => blob && setPhoto({ blob, url: URL.createObjectURL(blob) }), "image/jpeg", 0.8);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          {photo ? (
            <>
              <Button
                variant="outline"
                icon={<RotateCcw className="size-4" />}
                onClick={() => {
                  setReady(false);
                  setPhoto(null);
                }}
              >
                {t("selfie.retake")}
              </Button>
              <Button disabled={busy} onClick={() => onUse(photo.blob)}>
                {t("selfie.use")}
              </Button>
            </>
          ) : (
            <Button icon={<Camera className="size-4" />} disabled={!stream || !ready} onClick={take}>
              {t("selfie.take")}
            </Button>
          )}
        </>
      }
    >
      {failed ? (
        <Alert>{t("selfie.noCamera")}</Alert>
      ) : (
        <div className="overflow-hidden rounded-card bg-navy/5">
          {photo ? (
            <img src={photo.url} alt={t("selfie.preview")} className="mx-auto max-h-80" />
          ) : (
            <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} aria-label={t("selfie.camera")} className="mx-auto max-h-80 -scale-x-100" />
          )}
        </div>
      )}
    </Dialog>
  );
}
