/** Recruitment (Phase 6). Shapes follow apps/recruitment views: manpower requisitions and the headcount budget
 * (task 1). Money fields are left out by the server for users without salary access. */

import { api, type Named, type Page } from "./index";

export type RequisitionReason = "new" | "replacement";
export type RequisitionNationality = "any" | "saudi" | "non_saudi";
export type BudgetResult = "within" | "over" | "none";
export type NitaqatEffect = "keeps" | "drops" | "unknown";
export type RequestStatus = "draft" | "pending" | "returned" | "approved" | "rejected" | "cancelled";

export type BudgetDetail = {
  result?: BudgetResult;
  positions?: number | null;
  headcount?: number;
  committed?: number;
  asking?: number;
  available?: number | null;
  salaries?: string | null;
  salaries_now?: string | null;
  salaries_committed?: string | null;
  salaries_asked?: string | null;
  salaries_used?: string | null;
};

export type NitaqatScenario = { before: string; after: string; before_percent: string | null; after_percent: string | null };
export type NitaqatDetail = {
  reason?: "not_in_plan" | "no_establishment" | "no_thresholds" | "missing_rule";
  number?: string;
  wage?: string;
  scenarios?: Partial<Record<"saudi" | "non_saudi", NitaqatScenario>>;
};

export type RequisitionBody = {
  department: number | null;
  branch: number | null;
  job_title: number | null;
  grade: number | null;
  positions: number;
  reason: RequisitionReason;
  replaces: number | null;
  employment_type: "full_time" | "part_time";
  nationality: RequisitionNationality;
  target_start: string;
  basic_min: string;
  basic_max: string;
  housing: string;
  justification: string;
};

export type Requisition = RequisitionBody & {
  id: number;
  budget: BudgetResult | "";
  budget_detail: BudgetDetail;
  monthly_cost?: string | null;
  nitaqat: NitaqatEffect | "";
  nitaqat_detail: NitaqatDetail;
  filled: number;
  closed_at: string | null;
  status: RequestStatus;
  submitted_at: string | null;
  decided_at: string | null;
  workflow_id: number | null;
  names: {
    department: Named;
    branch: Named | null;
    job_title: Named;
    grade: Named | null;
    replaces: (Named & { employee_no: string }) | null;
    requester: Named;
    hiring_manager: Named | null;
  };
};

export type RequisitionPreview = {
  budget: BudgetResult | "";
  budget_detail: BudgetDetail;
  monthly_cost: string | null;
  nitaqat: NitaqatEffect | "";
  nitaqat_detail: NitaqatDetail;
  errors: Record<string, string[]>;
};

export type HeadcountBudget = {
  id: number;
  department: number;
  department_name: Named;
  year: number;
  positions: number;
  monthly_salaries?: string | null;
  note: string;
  use: BudgetDetail;
};

export type BudgetBody = { department: number | null; year: number; positions: number; monthly_salaries?: string | null; note: string };

export const recruitment = {
  requisitions: (query: { status?: string; mine?: "1"; page?: number }) => api.get<Page<Requisition>>("/requisitions", query),
  requisition: (id: number) => api.get<Requisition>(`/requisitions/${id}`),
  preview: (body: RequisitionBody, editId?: number) => api.post<RequisitionPreview>(`/requisitions/preview${editId ? `?id=${editId}` : ""}`, body),
  createRequisition: (body: RequisitionBody) => api.post<Requisition>("/requisitions", body),
  updateRequisition: (id: number, body: RequisitionBody) => api.patch<Requisition>(`/requisitions/${id}`, body),
  resubmitRequisition: (id: number) => api.post<Requisition>(`/requisitions/${id}/submit`, {}),
  budgets: (year: number) => api.get<Page<HeadcountBudget>>("/headcount-budgets", { year, page_size: 100 }),
  createBudget: (body: BudgetBody) => api.post<HeadcountBudget>("/headcount-budgets", body),
  updateBudget: (id: number, body: BudgetBody) => api.patch<HeadcountBudget>(`/headcount-budgets/${id}`, body),
  deleteBudget: (id: number) => api.del(`/headcount-budgets/${id}`),
};

// --- task 2: openings, the privacy notice, the public careers page -----------------------------------------------

export type QuestionKind = "text" | "yes_no" | "number" | "choice";
export type Question = { key?: string; text_ar: string; text_en: string; kind: QuestionKind; required: boolean; choices: { ar: string; en: string }[] };
export type OpeningStatus = "draft" | "published" | "closed";
export type OpeningBody = {
  requisition?: number | null;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  requirements_ar: string;
  requirements_en: string;
  questions: Question[];
  publish_on: string | null;
  close_on: string | null;
  talent_pool: boolean;
};
export type Opening = OpeningBody & {
  id: number;
  requisition: number;
  public_id: string;
  status: OpeningStatus;
  hiring_manager: number | null;
  counts: { total: number } & Partial<Record<string, number>>;
  names: { department: Named; branch: Named | null; open_positions: number; hiring_manager: Named | null };
  created_at: string;
};
export type PrivacyNotice = { version: number; text_ar: string; text_en: string; created_at: string; consents: number };

export type CareerBrief = {
  id: string;
  title_ar: string;
  title_en: string;
  company: Named;
  city: Named | null;
  employment_type: "full_time" | "part_time";
  publish_on: string | null;
  close_on: string | null;
};
export type CareerOpening = CareerBrief & {
  description_ar: string;
  description_en: string;
  requirements_ar: string;
  requirements_en: string;
  questions: Question[];
  talent_pool: boolean;
  notice: { version: number; text_ar: string; text_en: string };
  countries: (Named & { code: string })[];
  captcha_site_key: string;
};

export const openings = {
  list: (query: { status?: string; page?: number }) => api.get<Page<Opening>>("/openings", query),
  create: (body: OpeningBody & { requisition: number }) => api.post<Opening>("/openings", body),
  update: (id: number, body: Partial<OpeningBody>) => api.patch<Opening>(`/openings/${id}`, body),
  remove: (id: number) => api.del(`/openings/${id}`),
  publish: (id: number) => api.post<Opening>(`/openings/${id}/publish`, {}),
  close: (id: number) => api.post<Opening>(`/openings/${id}/close`, {}),
  notice: () => api.get<PrivacyNotice>("/recruitment/privacy-notice"),
  newNotice: (body: { text_ar: string; text_en: string }) => api.post<PrivacyNotice>("/recruitment/privacy-notice", body),
};

export const careersApi = {
  list: () => api.get<{ openings: CareerBrief[] }>("/careers"),
  opening: (id: string) => api.get<CareerOpening>(`/careers/${encodeURIComponent(id)}`),
  apply: (id: string, body: FormData) => api.post<{ received: true }>(`/careers/${encodeURIComponent(id)}/apply`, body),
};

// --- task 3: the pipeline, candidates, the talent pool -----------------------------------------------------------

export type Stage = "applied" | "screening" | "interview" | "offer" | "hired" | "rejected" | "withdrawn";
export const STAGES: Stage[] = ["applied", "screening", "interview", "offer", "hired", "rejected", "withdrawn"];
export type RejectionReason = "not_qualified" | "other_candidate" | "salary" | "no_show" | "position_filled" | "other";
export const REJECTIONS: RejectionReason[] = ["not_qualified", "other_candidate", "salary", "no_show", "position_filled", "other"];

export type CandidateBrief = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  nationality: (Named & { code: string }) | null;
  tags: string[];
  talent_pool: boolean;
  last_activity_at: string | null;
  /** Only with recruitment.view_candidate_personal over the record. */
  id_number?: string;
  expected_salary?: string | null;
};
export type Application = {
  id: number;
  opening: { id: number; title_ar: string; title_en: string };
  candidate: CandidateBrief;
  stage: Stage;
  source: "careers" | "referral" | "agency" | "manual";
  language: "ar" | "en";
  matched_on: "" | "email" | "phone" | "id_number";
  rejection_reason: RejectionReason | "";
  has_cv: boolean;
  created_at: string;
};
export type ApplicationEvent = { from: Stage | ""; to: Stage; reason: RejectionReason | ""; note: string; told: boolean; at: string; by: Named | null };
export type ApplicationDetail = Application & {
  answers: { key: string; text_ar: string; text_en: string; kind: QuestionKind; answer: string }[];
  submitted: Record<string, string>;
  cover_letter: string;
  events: ApplicationEvent[];
  duplicates: { id: number; full_name: string; email: string; phone: string }[];
  employee: { id: number; employee_no: string; status: string } | null;
};
export type Candidate = CandidateBrief & { erase_on: string; protected: boolean; applications: { id: number; opening: { id: number; title_ar: string; title_en: string }; stage: Stage; created_at: string }[] };

export const pipelineApi = {
  applications: (query: { opening?: number; stage?: string; search?: string; candidate?: number; page_size?: number }) => api.get<Page<Application>>("/applications", query),
  application: (id: number) => api.get<ApplicationDetail>(`/applications/${id}`),
  move: (id: number, body: { stage: Stage; reason?: string; note?: string; tell?: boolean }) => api.post<ApplicationDetail>(`/applications/${id}/move`, body),
  cv: (id: number) => api.get<{ url: string; expires_in: number }>(`/applications/${id}/cv`),
  take: (id: number, fields: string[]) => api.post<ApplicationDetail>(`/applications/${id}/take`, { fields }),
  candidates: (query: { pool?: "1"; search?: string; tag?: string; page?: number }) => api.get<Page<Candidate>>("/candidates", query),
  setTags: (id: number, tags: string[]) => api.patch<Candidate>(`/candidates/${id}`, { tags }),
  duplicates: (id: number) => api.get<Candidate[]>(`/candidates/${id}/duplicates`),
  merge: (keep: number, drop: number) => api.post<Candidate>(`/candidates/${keep}/merge`, { drop }),
  addToOpening: (id: number, opening: number) => api.post<{ application: number }>(`/candidates/${id}/add-to-opening`, { opening }),
};

// --- task 4: interviews and scorecards ---------------------------------------------------------------------------

export type InterviewKind = "in_person" | "video" | "phone";
export type Recommendation = "strong_yes" | "yes" | "no" | "strong_no";
export const RECOMMENDATIONS: Recommendation[] = ["strong_yes", "yes", "no", "strong_no"];
export type Criterion = { key?: string; text_ar: string; text_en: string };
export type InterviewTemplate = { id: number; name_ar: string; name_en: string; criteria: Criterion[]; scale_max: number; is_active: boolean };
export type Person = Named & { id: number; email?: string };
export type InterviewBody = { kind: InterviewKind; starts_at: string; minutes: number; location: string; link: string; template: number | null; interviewers: number[]; invite_candidate?: boolean };
export type Interview = InterviewBody & {
  id: number;
  application: number;
  round: number;
  status: "scheduled" | "done" | "cancelled";
  candidate_invited: boolean;
  info: {
    candidate: string;
    stage: Stage;
    has_cv: boolean;
    opening: { id: number; title_ar: string; title_en: string };
    interviewers: Person[];
    template: { name_ar: string; name_en: string; criteria: Criterion[]; scale_max: number } | null;
    is_interviewer: boolean;
    my_scorecard: { scores: Record<string, number>; recommendation: Recommendation | ""; comments: string; submitted_at: string | null } | null;
  };
};
export type Scorecard = { id: number; interview: number; round: number; interviewer: Person; scores: Record<string, number>; recommendation: Recommendation; comments: string; submitted_at: string };
export type Scorecards = {
  cards: Scorecard[];
  summary: { criteria: (Criterion & { average: string | null })[]; overall: string | null; recommendations: Partial<Record<Recommendation, number>>; count: number };
  hidden_until_you_score: boolean;
};

export const interviewsApi = {
  list: (query: { application?: number; mine?: "1"; upcoming?: "1"; page_size?: number }) => api.get<Page<Interview>>("/interviews", query),
  create: (body: InterviewBody & { application: number }) => api.post<Interview>("/interviews", body),
  update: (id: number, body: Partial<InterviewBody>) => api.patch<Interview>(`/interviews/${id}`, body),
  cancel: (id: number) => api.post<Interview>(`/interviews/${id}/cancel`, {}),
  ics: (id: number) => api.download(`/interviews/${id}/ics`),
  cv: (id: number) => api.get<{ url: string }>(`/interviews/${id}/cv`),
  submit: (id: number, body: { scores: Record<string, number>; recommendation: Recommendation; comments: string }) => api.post<Scorecard>(`/interviews/${id}/scorecard`, body),
  scorecards: (id: number) => api.get<Scorecards>(`/interviews/${id}/scorecards`),
  people: (search: string) => api.get<Person[]>("/interviews/people", { search }),
  templates: () => api.get<Page<InterviewTemplate>>("/interview-templates", { page_size: 100 }),
  saveTemplate: (body: Omit<InterviewTemplate, "id"> & { id?: number }) => (body.id ? api.patch<InterviewTemplate>(`/interview-templates/${body.id}`, body) : api.post<InterviewTemplate>("/interview-templates", body)),
  deleteTemplate: (id: number) => api.del(`/interview-templates/${id}`),
};

// --- task 5: job offers ----------------------------------------------------------------------------------------

export type OfferResponse = "" | "waiting" | "accepted" | "declined" | "expired" | "withdrawn";
export type OfferLine = { code?: string; name_ar: string; name_en: string; kind: "earning" | "deduction" | "employer_cost"; amount: string };
export type OfferBody = {
  application: number;
  contract_type: number | null;
  contract_months: number | null;
  start_date: string;
  probation_days: number;
  basic_salary: string;
  housing_allowance: string;
  transport_allowance: string;
  other_allowances: string;
  valid_until: string;
  terms_ar: string;
  terms_en: string;
};
export type Offer = OfferBody & {
  id: number;
  reference: string;
  sent_at: string | null;
  response: OfferResponse;
  responded_at: string | null;
  decline_reason: string;
  has_letter: boolean;
  /** Left out for users who don't make offers. */
  lines?: OfferLine[];
  monthly_total?: string | null;
  currency: string;
  structure_name: string;
  status: RequestStatus;
  workflow_id: number | null;
  names: { candidate: string; job_title: Named; department: Named; contract_type: Named; grade: Named | null };
};
export type OfferPreview = { lines: OfferLine[]; monthly_total: string | null; currency: string; structure_name: string; errors: Record<string, string[]> };
export type OfferPage = {
  reference: string;
  candidate: string;
  company: Named;
  job_title: Named;
  department: Named;
  branch: Named | null;
  contract_type: Named;
  contract_months: number | null;
  start_date: string;
  probation_days: number;
  lines: OfferLine[];
  monthly_total: string;
  currency: string;
  terms_ar: string;
  terms_en: string;
  valid_until: string;
  response: OfferResponse;
  responded_at: string | null;
  language: "ar" | "en";
};

export const offersApi = {
  list: (application: number) => api.get<Page<Offer>>("/offers", { application }),
  preview: (body: OfferBody) => api.post<OfferPreview>("/offers/preview", body),
  create: (body: OfferBody) => api.post<Offer>("/offers", body),
  letter: (id: number) => api.get<{ url: string }>(`/offers/${id}/letter`),
  resend: (id: number) => api.post<Offer>(`/offers/${id}/resend`, {}),
  withdraw: (id: number, reason: string, tell: boolean) => api.post<Offer>(`/offers/${id}/withdraw`, { reason, tell }),
  page: (token: string) => api.get<OfferPage>(`/offer/${encodeURIComponent(token)}`),
  respond: (token: string, decision: "accept" | "decline", reason: string) => api.post<{ response: OfferResponse }>(`/offer/${encodeURIComponent(token)}/respond`, { decision, reason }),
  letterUrl: (token: string) => `/api/v1/offer/${encodeURIComponent(token)}/letter`,
};

// --- task 6: the hire ------------------------------------------------------------------------------------------

export type HireValues = {
  first_name_ar: string;
  father_name_ar: string;
  grandfather_name_ar: string;
  family_name_ar: string;
  first_name_en: string;
  father_name_en: string;
  grandfather_name_en: string;
  family_name_en: string;
  nationality: string;
  id_type: "" | "national_id" | "iqama" | "border_no";
  id_number: string;
  gender: "" | "male" | "female";
  date_of_birth: string | null;
  mobile: string;
  personal_email: string;
  manager: number | null;
  signed_on: string | null;
};

export const hireApi = {
  form: (offer: number) => api.get<HireValues>(`/offers/${offer}/hire-form`),
  hire: (offer: number, body: HireValues) => api.post<{ employee: number; employee_no: string; status: string }>(`/offers/${offer}/hire`, body),
};

// --- task 7: candidates' data (PDPL) ----------------------------------------------------------------------------

export type CandidateData = {
  company: { ar: string; en: string };
  you: { full_name: string; email: string; phone: string; id_number: string; city: string; nationality: string; expected_salary: string | null };
  applications: { job: { ar: string; en: string }; applied_at: string; stage: Stage; source: string; answers: Record<string, string>; cover_letter: string; what_you_typed: Record<string, string>; has_cv: boolean; interviews: { round: number; at: string; kind: InterviewKind; status: string }[] }[];
  consents: { purpose: "application" | "talent_pool"; notice_version: number; given_at: string; withdrawn_at: string | null }[];
  talent_pool: boolean;
  kept_until: string;
  can_delete: boolean;
  notice_version: number;
  language: "ar" | "en";
  notice: { version: number; text_ar: string; text_en: string };
};
export type RecruitmentSettings = { candidate_retention_months: number; renewal_notice_days: number };

export const candidateDataApi = {
  request: (email: string) => api.post<{ sent: true }>("/careers/my-data", { email }),
  get: (token: string) => api.get<CandidateData>(`/candidate-data/${encodeURIComponent(token)}`),
  downloadUrl: (token: string) => `/api/v1/candidate-data/${encodeURIComponent(token)}?download=1`,
  renew: (token: string, notice_version: number) => api.post<CandidateData>(`/candidate-data/${encodeURIComponent(token)}/renew`, { notice_version }),
  withdrawPool: (token: string) => api.post<CandidateData>(`/candidate-data/${encodeURIComponent(token)}/withdraw-pool`, {}),
  remove: (token: string) => api.post<{ deleted: true }>(`/candidate-data/${encodeURIComponent(token)}/delete`, {}),
  erase: (candidate: number) => api.post<void>(`/candidates/${candidate}/erase`, {}),
  settings: () => api.get<RecruitmentSettings>("/recruitment/settings"),
  saveSettings: (body: Partial<RecruitmentSettings>) => api.request<RecruitmentSettings>("/recruitment/settings", { method: "PUT", body }),
};
