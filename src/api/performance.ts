/** Performance (Phase 6). Shapes follow apps/performance views: the setup (task 8). */

import { api, type Named, type Page } from "./index";

export type RatingLevel = Named & { value: number; description_ar: string; description_en: string };
export type RatingScale = Named & { id: number; is_active: boolean; levels: RatingLevel[] };
export type CompetencyCategory = "core" | "leadership" | "technical";
export type Competency = Named & { id: number; code: string; category: CompetencyCategory; description_ar: string; description_en: string; job_titles: number[]; grades: number[]; is_active: boolean };
export type TemplateItem = { competency: number; weight: string };
export type OpenQuestion = { key?: string; text_ar: string; text_en: string };
export type AppraisalTemplate = Named & { id: number; scale: number; goals_weight: string; competencies_weight: string; competency_items: TemplateItem[]; questions: OpenQuestion[]; is_active: boolean };
export type CycleKind = "annual" | "semi_annual" | "probation";
export type CycleStatus = "draft" | "active" | "closed";
export const CYCLE_DATES = ["period_start", "period_end", "goals_from", "goals_until", "self_from", "self_until", "manager_from", "manager_until", "calibration_from", "calibration_until", "release_on"] as const;
export type CycleDate = (typeof CYCLE_DATES)[number];
export type CycleBody = Named & Record<CycleDate, string> & { kind: CycleKind; template: number | null; departments: number[]; branches: number[]; grades: number[]; min_service_days: number };
export type Cycle = CycleBody & { id: number; status: CycleStatus; open_phases: string[]; population_count: number };
export type PopulationRow = Named & { id: number; employee_no: string; department: string; hire_date: string | null };

const crud = <T, B>(path: string) => ({
  list: () => api.get<Page<T>>(path, { page_size: 100 }),
  save: (body: B & { id?: number }) => (body.id ? api.patch<T>(`${path}/${body.id}`, body) : api.post<T>(path, body)),
  remove: (id: number) => api.del(`${path}/${id}`),
});

export const performance = {
  scales: crud<RatingScale, Omit<RatingScale, "id">>("/rating-scales"),
  competencies: crud<Competency, Omit<Competency, "id">>("/competencies"),
  templates: crud<AppraisalTemplate, Omit<AppraisalTemplate, "id">>("/appraisal-templates"),
  cycles: {
    ...crud<Cycle, CycleBody>("/appraisal-cycles"),
    activate: (id: number) => api.post<Cycle>(`/appraisal-cycles/${id}/activate`, {}),
    close: (id: number) => api.post<Cycle>(`/appraisal-cycles/${id}/close`, {}),
    population: (id: number) => api.get<PopulationRow[]>(`/appraisal-cycles/${id}/population`),
  },
};

// --- task 9: goals and KPIs ------------------------------------------------------------------------------------

export type Measure = "up" | "down" | "done";
export type GoalStatus = "draft" | "submitted" | "agreed";
export type SheetStatus = GoalStatus | "empty";
export type GoalBody = { cycle: number; employee?: number; title_ar: string; title_en: string; description: string; measure: Measure; unit: string; baseline: string; target: string | null; weight: string; due_date: string };
export type Goal = GoalBody & {
  id: number;
  employee: number;
  parent: number | null;
  parent_title: { ar: string; en: string } | null;
  status: GoalStatus;
  current: string | null;
  progress: string;
  returned_note: string;
  can_edit: boolean;
  check_ins: { id: number; value: string; note: string; by: Named | null; at: string }[];
};
export type GoalSheet = { employee: Named & { id: number; employee_no: string }; goals: Goal[]; status: SheetStatus; total: string; can_add: boolean; can_submit: boolean; can_agree: boolean };
export type TeamRow = Named & { id: number; employee_no: string; status: SheetStatus; total: string };
export type DepartmentGoal = { id: number; cycle: number; department: number; title_ar: string; title_en: string; measure: Measure; unit: string; baseline: string; target: string | null; due_date: string; progress: string; goals_count: number };

export const goalsApi = {
  sheet: (cycle: number, employee?: number) => api.get<GoalSheet>("/goals/sheet", { cycle, employee }),
  team: (cycle: number) => api.get<TeamRow[]>("/goals/team", { cycle }),
  save: (body: GoalBody & { id?: number }) => (body.id ? api.patch<Goal>(`/goals/${body.id}`, body) : api.post<Goal>("/goals", body)),
  remove: (id: number) => api.del(`/goals/${id}`),
  checkIn: (id: number, value: string, note: string) => api.post<Goal>(`/goals/${id}/check-in`, { value, note }),
  submit: (cycle: number, employee?: number) => api.post<{ status: SheetStatus }>("/goals/submit", { cycle, employee }),
  agree: (cycle: number, employee: number) => api.post<{ status: SheetStatus }>("/goals/agree", { cycle, employee }),
  sendBack: (cycle: number, employee: number, note: string) => api.post<{ status: SheetStatus }>("/goals/send-back", { cycle, employee, note }),
  departmentGoals: (cycle: number) => api.get<Page<DepartmentGoal>>("/department-goals", { cycle, page_size: 100 }),
  saveDepartmentGoal: (body: Omit<DepartmentGoal, "id" | "progress" | "goals_count"> & { id?: number }) => (body.id ? api.patch<DepartmentGoal>(`/department-goals/${body.id}`, body) : api.post<DepartmentGoal>("/department-goals", body)),
  removeDepartmentGoal: (id: number) => api.del(`/department-goals/${id}`),
  cascade: (id: number, weight: string) => api.post<{ made: number }>(`/department-goals/${id}/cascade`, { weight }),
};

// --- task 10: appraisals and calibration -----------------------------------------------------------------------

export type AppraisalStep = "self" | "manager" | "calibration" | "released" | "acknowledged";
export type AppraisalItem = { id: number; kind: "goal" | "competency"; title_ar: string; title_en: string; weight: string; progress: string | null; self_rating?: number | null; self_note?: string; manager_rating?: number | null; manager_note?: string };
export type Level = Named & { value: number };
export type Appraisal = {
  id: number;
  cycle: number;
  employee: Named & { id: number; employee_no: string; department: Named | null; reviewer: Named | null };
  step: AppraisalStep;
  items: AppraisalItem[];
  questions: { key: string; text_ar: string; text_en: string }[];
  levels: Level[];
  self_answers?: Record<string, string>;
  self_comment?: string;
  self_submitted_at: string | null;
  self_skipped: boolean;
  manager_answers?: Record<string, string>;
  manager_comment?: string;
  manager_submitted_at: string | null;
  score?: string | null;
  level?: number | null;
  final_score?: string | null;
  final_level?: number | null;
  calibration_reason?: string;
  released_at: string | null;
  employee_comment: string;
  acknowledged_at: string | null;
  can: { self: boolean; manager: boolean; calibrate: boolean; acknowledge: boolean };
};
export type Distribution = {
  top: number;
  levels: Level[];
  managers: Record<string, number>;
  final: Record<string, number>;
  steps: Record<AppraisalStep, number>;
  rows: { id: number; employee: Named & { id: number; employee_no: string }; department: string; step: AppraisalStep; score: string | null; level: number | null; final_level: number | null; changed: boolean }[];
};
export type AppraisalForm = { ratings: Record<string, { rating: number | null; note: string }>; answers: Record<string, string>; comment: string };

export const appraisalsApi = {
  list: (query: { cycle: number; mine?: "1"; reviews?: "1" }) => api.get<Page<Appraisal>>("/appraisals", { ...query, page_size: 200 }),
  get: (id: number) => api.get<Appraisal>(`/appraisals/${id}`),
  save: (id: number, side: "self" | "manager", body: AppraisalForm) => api.post<Appraisal>(`/appraisals/${id}/${side}`, body),
  submit: (id: number, side: "self" | "manager") => api.post<Appraisal>(`/appraisals/${id}/submit-${side}`, {}),
  calibrate: (id: number, final_level: number, reason: string) => api.post<Appraisal>(`/appraisals/${id}/calibrate`, { final_level, reason }),
  acknowledge: (id: number, comment: string) => api.post<Appraisal>(`/appraisals/${id}/acknowledge`, { comment }),
  start: (cycle: number) => api.post<{ made: number }>(`/appraisal-cycles/${cycle}/start-reviews`, {}),
  release: (cycle: number) => api.post<{ released: number; still_open: number }>(`/appraisal-cycles/${cycle}/release`, {}),
  distribution: (cycle: number, department?: number) => api.get<Distribution>(`/appraisal-cycles/${cycle}/distribution`, { department }),
};

// --- task 11: probation evaluation -----------------------------------------------------------------------------

export type ProbationState = "open" | "sent" | "returned" | "decided";
export type ProbationRecommendation = "" | "confirm" | "extend" | "end";
export type ProbationForm = { ratings: Record<string, number>; strengths: string; improvements: string; recommendation: ProbationRecommendation; new_end_date: string | null; notes: string };
export type ProbationEvaluation = ProbationForm & {
  id: number;
  employee: Named & { id: number; employee_no: string; hire_date: string | null; department: Named | null };
  contract: { id: number; start_date: string; end_date: string | null; probation_days: number };
  probation_end: string;
  criteria: (Named & { id: number; weight: string })[];
  top: number;
  score: string | null;
  submitted_at: string | null;
  state: ProbationState;
  can_edit: boolean;
};

export const probationApi = {
  list: (state?: string) => api.get<Page<ProbationEvaluation>>("/probation-evaluations", { state, page_size: 100 }),
  save: (id: number, body: ProbationForm) => api.post<ProbationEvaluation>(`/probation-evaluations/${id}/save`, body),
  submit: (id: number) => api.post<ProbationEvaluation>(`/probation-evaluations/${id}/submit`, {}),
};

// --- task 12: improvement plans --------------------------------------------------------------------------------

export type PipStatus = "draft" | "active" | "closed";
export type PipOutcome = "" | "succeeded" | "extended" | "ended";
export type PipObjective = { id?: number; description: string; success: string; support: string; due_date: string };
export type PipBody = { employee: number | null; reason: string; start_date: string; end_date: string; objectives: PipObjective[] };
export type Pip = PipBody & {
  id: number;
  status: PipStatus;
  issued_at: string | null;
  acknowledged_at: string | null;
  employee_comment: string;
  extensions: number;
  outcome: PipOutcome;
  outcome_note: string;
  closed_at: string | null;
  check_ins: { id: number; on_track: boolean; note: string; at: string; by: Named | null }[];
  info: { employee: Named & { employee_no: string }; owner: Named | null; can: { edit: boolean; issue: boolean; acknowledge: boolean; check_in: boolean; close: boolean } };
};

export const pipsApi = {
  list: () => api.get<Page<Pip>>("/pips", { page_size: 100 }),
  save: (body: PipBody & { id?: number }) => (body.id ? api.patch<Pip>(`/pips/${body.id}`, body) : api.post<Pip>("/pips", body)),
  remove: (id: number) => api.del(`/pips/${id}`),
  issue: (id: number) => api.post<Pip>(`/pips/${id}/issue`, {}),
  acknowledge: (id: number, comment: string) => api.post<Pip>(`/pips/${id}/acknowledge`, { comment }),
  checkIn: (id: number, on_track: boolean, note: string) => api.post<Pip>(`/pips/${id}/check-in`, { on_track, note }),
  close: (id: number, outcome: string, note: string, until: string | null) => api.post<Pip & { suggest_offboarding: boolean }>(`/pips/${id}/close`, { outcome, note, until }),
};

// --- task 13: merit raises and bonuses ---------------------------------------------------------------------------

export type Third = "lower" | "middle" | "upper";
export const THIRDS: Third[] = ["lower", "middle", "upper"];
export type RaiseMatrix = Record<string, Record<Third, string>>;
export type ReviewStatus = "draft" | "pending" | "returned" | "approved" | "rejected" | "cancelled";
export type ReviewBody = { cycle: number; effective_date: string; bonus_month: string; raise_budget: string; bonus_budget: string; raise_matrix?: RaiseMatrix; bonus_matrix?: Record<string, string> };
/** Money totals are left out without employees.view_salary. */
export type ReviewTotals = { count: string; raise_total?: string; bonus_total?: string; raise_budget?: string; bonus_budget?: string };
export type CompensationReview = Required<ReviewBody> & {
  id: number;
  status: ReviewStatus;
  generated_at: string | null;
  applied_at: string | null;
  submitted_at: string | null;
  info: { cycle: Named; levels: (Named & { value: number })[]; totals: ReviewTotals; editable: boolean };
};
/** Amounts (current_basic, raise_amount, new_basic, bonus_amount) only with employees.view_salary. */
export type Proposal = {
  id: number;
  review: number;
  review_info: { cycle: Named; status: ReviewStatus; editable: boolean; effective_date: string; bonus_month: string };
  employee: Named & { id: number; employee_no: string; department: Named | null; grade: Named | null; manager: Named | null };
  level: number;
  position: Third;
  in_range: boolean;
  current_basic?: string;
  matrix_raise_pct: string;
  raise_pct: string;
  raise_amount?: string;
  new_basic?: string;
  matrix_bonus_pct: string;
  bonus_pct: string;
  bonus_amount?: string;
  note: string;
  adjusted_by: Named | null;
  adjusted_at: string | null;
};
export type TeamShare = { count: number; raise_used?: string | null; bonus_used?: string | null; raise_total?: string; raise_share?: string; bonus_total?: string; bonus_share?: string };

export const compensationApi = {
  reviews: (cycle: number) => api.get<Page<CompensationReview>>("/compensation-reviews", { cycle, page_size: 20 }),
  save: (body: Partial<ReviewBody> & { id?: number }) => (body.id ? api.patch<CompensationReview>(`/compensation-reviews/${body.id}`, body) : api.post<CompensationReview>("/compensation-reviews", body)),
  generate: (id: number) => api.post<CompensationReview>(`/compensation-reviews/${id}/generate`, {}),
  submit: (id: number) => api.post<CompensationReview>(`/compensation-reviews/${id}/submit`, {}),
  proposals: (query: { review?: number; open?: "1" }) => api.get<Proposal[]>("/compensation-proposals", query),
  adjust: (id: number, body: { raise_pct: string; bonus_pct: string; note: string }) => api.patch<Proposal>(`/compensation-proposals/${id}`, body),
  share: (review: number) => api.get<TeamShare>("/compensation-proposals/share", { review }),
};
