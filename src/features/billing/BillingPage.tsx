import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { type BillingInvoice, type Buyer, billingApi } from "@/api/billing";
import { Alert } from "@/design/Alert";
import { Button } from "@/design/Button";
import { Card } from "@/design/Card";
import { type Column, DataTable } from "@/design/DataTable";
import { Dialog } from "@/design/Dialog";
import { FormSelect, TextField } from "@/design/Field";
import { Money } from "@/design/Money";
import { Pill, type PillTone } from "@/design/Pill";
import { openFile } from "@/features/employees/download";
import { Page } from "@/layout/Page";
import { apiErrors } from "@/lib/apiErrors";
import { useFormat } from "@/lib/useFormat";

const ACCOUNT_TONES: Record<string, PillTone> = { trial: "sky", active: "green", past_due: "amber", suspended: "salmon", cancelled: "neutral" };
const INVOICE_TONES: Record<string, PillTone> = { open: "amber", paid: "green", void: "neutral" };
const ZATCA_TONES: Record<string, PillTone> = { pending: "amber", cleared: "green", rejected: "salmon" };
const BUYER_FIELDS = ["legal_name", "vat_number", "cr_number", "building_no", "street", "district", "city", "postal_code"] as const;

/** /settings/billing — the subscription (task 23): the plan and its price, the period paid, the employees billed and
 * now (the period's peak is trued up on the next invoice), the invoices with their lines. */
export default function BillingPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const data = useQuery({ queryKey: ["billing"], queryFn: billingApi.get });
  const [open, setOpen] = useState<BillingInvoice | null>(null);
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();
  const cards = useQuery({ queryKey: ["billing-cards"], queryFn: billingApi.cards });
  const [params, setParams] = useSearchParams();
  const returned = params.get("id");
  const settle = useMutation({ mutationFn: (ref: string) => billingApi.settle(ref), onSettled: () => queryClient.invalidateQueries({ queryKey: ["billing"] }) });
  const settling = useRef(false);
  useEffect(() => {
    // back from 3-D Secure: ask the gateway (through our API) how it ended, once
    if (!returned || settling.current) return;
    settling.current = true;
    settle.mutate(returned);
    setParams({}, { replace: true });
  }, [returned, settle, setParams]);
  const pay = useMutation({ mutationFn: (id: number) => billingApi.pay(id), onSuccess: async (p) => { if (p.redirect_url) window.location.assign(p.redirect_url); await queryClient.invalidateQueries({ queryKey: ["billing"] }); } });
  const taxInvoice = useMutation({ mutationFn: (id: number) => openFile(() => billingApi.taxInvoice(id)) });
  const [editingBuyer, setEditingBuyer] = useState(false);
  const a = data.data?.account;
  const card = cards.data?.find((c) => c.is_default);
  const columns: Column<BillingInvoice>[] = [
    { id: "number", header: t("billing.number"), cell: (i) => <span dir="ltr" className="num font-semibold">{i.number}</span> },
    { id: "period", header: t("billing.period"), cell: (i) => <span className="num text-sm">{format.dateRange(i.period_start, i.period_end)}</span> },
    { id: "total", header: t("billing.total"), cell: (i) => <Money amount={i.total} currency={i.currency} /> },
    { id: "due", header: t("billing.due"), cell: (i) => <span className="num text-sm">{format.date(i.due_on)}</span> },
    { id: "status", header: t("billing.status"), cell: (i) => <Pill tone={INVOICE_TONES[i.status]}>{t(`billing.invoiceStatuses.${i.status}`)}</Pill> },
    { id: "zatca", header: t("billing.zatca"), cell: (i) => (i.zatca_status ? <span title={i.zatca_message || undefined}><Pill tone={ZATCA_TONES[i.zatca_status]}>{t(`billing.zatcaStatuses.${i.zatca_status}`)}</Pill></span> : <span className="text-muted">—</span>) },
    { id: "open", header: t("common.view"), cell: (i) => (
      <span className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(i)}>{t("common.view")}</Button>
        {i.has_tax_invoice && <Button size="sm" variant="outline" disabled={taxInvoice.isPending} onClick={() => taxInvoice.mutate(i.id)}>{t("billing.taxInvoice")}</Button>}
        {i.status === "open" && card && <Button size="sm" variant="accent" disabled={pay.isPending} onClick={() => pay.mutate(i.id)}>{t("billing.payNow")}</Button>}
      </span>
    ) },
  ];
  return (
    <Page title={t("billing.title")}>
      <div className="flex flex-col gap-4">
        {data.isError && <Alert>{t("common.loadFailed")}</Alert>}
        {data.data && !a && <Card><p className="text-muted">{t("billing.none")}</p></Card>}
        {a && (
          <Card title={format.name(a.plan)} action={<Pill tone={ACCOUNT_TONES[a.status]}>{t(`billing.statuses.${a.status}`)}</Pill>}>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-sm text-muted">{t("billing.price")}</dt><dd className="mt-1 text-sm">{t("billing.priceText", { included: a.price.included_employees, period: t(`billing.periods.${a.price.period}`) })} <Money amount={a.price.base_fee} currency={a.price.currency} /> · {t("billing.perExtra")} <Money amount={a.price.per_employee} currency={a.price.currency} /></dd></div>
              <div><dt className="text-sm text-muted">{a.status === "trial" ? t("billing.trialEnds") : t("billing.paidPeriod")}</dt><dd className="num mt-1 font-semibold">{a.period_start && a.period_end ? format.dateRange(a.period_start, a.period_end) : "—"}</dd></div>
              <div><dt className="text-sm text-muted">{t("billing.employees")}</dt><dd className="num mt-1 font-semibold">{t("billing.employeesText", { billed: a.billed_employees, now: a.employees_now ?? "—" })}</dd></div>
              <div><dt className="text-sm text-muted">{t("billing.vatNote")}</dt><dd className="mt-1 text-sm">{t("billing.peakNote")}</dd></div>
            </dl>
            {a.tenant_status === "read_only" && <Alert tone="warning" className="mt-4">{t("billing.readOnly")}</Alert>}
            {a.status === "suspended" && <Alert className="mt-4">{t("billing.suspended")}</Alert>}
          </Card>
        )}
        {a && (
          <Card title={t("billing.card")} action={<Button size="sm" variant="outline" onClick={() => setAdding(true)}>{card ? t("billing.changeCard") : t("billing.addCard")}</Button>}>
            <p className="text-sm">{card ? t("billing.cardText", { brand: card.brand || "—", last4: card.last4 || "••••" }) : t("billing.noCard")}</p>
            <p className="mt-1 text-sm text-muted">{t("billing.autoNote")}</p>
          </Card>
        )}
        {a && (
          <Card title={t("billing.buyer")} action={<Button size="sm" variant="outline" onClick={() => setEditingBuyer(true)}>{t("common.edit")}</Button>}>
            <p className="text-sm">{[a.buyer.legal_name, a.buyer.vat_number && t("billing.vatNo", { vat: a.buyer.vat_number })].filter(Boolean).join(" · ") || "—"}</p>
            <p className="mt-1 text-sm text-muted">{[a.buyer.building_no, a.buyer.street, a.buyer.district, a.buyer.city, a.buyer.postal_code].filter(Boolean).join(", ") || t("billing.noAddress")}</p>
            <p className="mt-1 text-sm text-muted">{t("billing.buyerNote")}</p>
          </Card>
        )}
        {taxInvoice.error && <Alert>{t("common.loadFailed")}</Alert>}
        {settle.data && <Alert tone={settle.data.status === "paid" ? "info" : "warning"}>{settle.data.status === "paid" ? t("billing.paid") : settle.data.status === "pending" ? t("billing.stillPending") : t("billing.payFailed", { message: settle.data.message })}</Alert>}
        {pay.data && <Alert tone={pay.data.status === "paid" ? "info" : "warning"}>{pay.data.status === "paid" ? t("billing.paid") : t("billing.payFailed", { message: pay.data.message })}</Alert>}
        {pay.error && <Alert>{apiErrors(pay.error, t("common.saveFailed")).general ?? apiErrors(pay.error, "").fields.detail}</Alert>}
        <Card title={t("billing.invoices")}>
          <DataTable caption={t("billing.invoices")} columns={columns} rows={data.data?.invoices ?? []} rowKey={(i) => String(i.id)} rowLabel={(i) => i.number} loading={data.isPending} empty={t("billing.noInvoices")} />
        </Card>
      </div>
      {editingBuyer && a && <BuyerDialog buyer={a.buyer} onClose={() => setEditingBuyer(false)} />}
      {adding && data.data && <AddCard gateway={data.data.gateway.name} onClose={() => setAdding(false)} />}
      {open && (
        <Dialog open size="lg" onClose={() => setOpen(null)} title={t("billing.invoiceTitle", { number: open.number })}>
          <table className="w-full text-sm">
            <tbody>
              {open.lines.map((ln, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-2">{format.pick({ ar: ln.description_ar, en: ln.description_en })}</td>
                  <td className="num py-2 text-center">{ln.quantity}</td>
                  <td className="py-2 text-end"><Money amount={ln.amount} currency={open.currency} /></td>
                </tr>
              ))}
              <tr><td className="py-2 text-muted" colSpan={2}>{t("billing.subtotal")}</td><td className="py-2 text-end"><Money amount={open.subtotal} currency={open.currency} /></td></tr>
              <tr><td className="py-2 text-muted" colSpan={2}>{t("billing.vat", { rate: format.number(open.vat_rate, [0, 2]) })}</td><td className="py-2 text-end"><Money amount={open.vat} currency={open.currency} /></td></tr>
              <tr className="font-semibold"><td className="py-2" colSpan={2}>{t("billing.total")}</td><td className="py-2 text-end"><Money amount={open.total} currency={open.currency} /></td></tr>
            </tbody>
          </table>
        </Dialog>
      )}
    </Page>
  );
}

/** A card from the gateway's own form (the token, never the card). The mock offers its test cards; the Moyasar form
 * appears once the merchant account is set up (open question 14). */
function AddCard({ gateway, onClose }: { gateway: "mock" | "moyasar"; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [token, setToken] = useState("tok_ok");
  const save = useMutation({
    mutationFn: () => billingApi.addCard({ token, brand: "mada", last4: { tok_ok: "4242", tok_fail: "0002", tok_3ds: "3155" }[token] ?? "0000" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["billing-cards"] });
      onClose();
    },
  });
  return (
    <Dialog open onClose={onClose} title={t("billing.addCard")} footer={gateway === "mock" && <Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      {gateway === "mock" ? (
        <div className="flex flex-col gap-3">
          <Alert tone="info">{t("billing.mockNote")}</Alert>
          <FormSelect label={t("billing.testCard")} name="test_card" value={token} onChange={(e) => setToken(e.target.value)} options={(["tok_ok", "tok_fail", "tok_3ds"] as const).map((v) => ({ value: v, label: t(`billing.testCards.${v}`) }))} />
          {save.error && <Alert>{apiErrors(save.error, t("common.saveFailed")).general}</Alert>}
        </div>
      ) : (
        <Alert tone="warning">{t("billing.gatewayPending")}</Alert>
      )}
    </Dialog>
  );
}

/** The buyer on the tax invoice (task 25): ZATCA wants a business buyer's legal name, VAT number and national
 * address; changes apply to the next invoices. */
function BuyerDialog({ buyer, onClose }: { buyer: Buyer; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Buyer>(buyer);
  const save = useMutation({
    mutationFn: () => billingApi.saveBuyer(form),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["billing"] });
      onClose();
    },
  });
  const errors = save.error ? apiErrors(save.error, t("common.saveFailed")) : null;
  return (
    <Dialog open size="lg" onClose={onClose} title={t("billing.buyer")} footer={<Button variant="accent" disabled={save.isPending} onClick={() => save.mutate()}>{t("common.save")}</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {BUYER_FIELDS.map((f) => (
          <TextField key={f} label={t(`billing.buyerFields.${f}`)} name={f} value={form[f]} dir={f === "legal_name" || f === "street" || f === "district" || f === "city" ? undefined : "ltr"} error={errors?.fields[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
        ))}
      </div>
      {errors?.general && <Alert className="mt-3">{errors.general}</Alert>}
    </Dialog>
  );
}
