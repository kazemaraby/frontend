import { useQuery } from "@tanstack/react-query";

import { endpoints } from "@/api";
import { hr } from "@/api/hr";
import { useScopeKey, useSession } from "@/auth/session";
import { useFormat } from "@/lib/useFormat";

const DAY = 24 * 60 * 60 * 1000;

/** Master and reference data the employee screens use for pickers and to show names instead of ids.
 * Job titles, contract and document types are tenant-wide; grades, departments and policies per company. */
export function useMasterData() {
  const format = useFormat();
  const { company } = useSession();
  const [companyId] = useScopeKey();
  const jobTitles = useQuery({ queryKey: ["master", "job-titles"], queryFn: hr.jobTitles, staleTime: DAY });
  const contractTypes = useQuery({ queryKey: ["master", "contract-types"], queryFn: hr.contractTypes, staleTime: DAY });
  const documentTypes = useQuery({ queryKey: ["master", "document-types"], queryFn: hr.documentTypes, staleTime: DAY });
  const countries = useQuery({ queryKey: ["reference", "countries"], queryFn: hr.countries, staleTime: DAY });
  const banks = useQuery({ queryKey: ["reference", "banks"], queryFn: hr.banks, staleTime: DAY });
  const grades = useQuery({ queryKey: ["master", "grades", companyId], queryFn: hr.grades });
  const departments = useQuery({ queryKey: ["departments", companyId], queryFn: endpoints.departments });

  const options = <T extends { name_ar: string; name_en: string }>(rows: T[] | undefined, key: (row: T) => string | number) =>
    (rows ?? []).map((row) => ({ value: String(key(row)), label: format.name(row) }));
  const nameOf = <T extends { name_ar: string; name_en: string }>(rows: T[] | undefined, key: (row: T) => unknown) => {
    const map = new Map((rows ?? []).map((row) => [String(key(row)), format.name(row)]));
    return (value: unknown) => (value === null || value === undefined || value === "" ? "" : (map.get(String(value)) ?? ""));
  };

  const active = <T extends { is_active: boolean }>(rows: T[] | undefined) => (rows ?? []).filter((r) => r.is_active);
  const branches = company?.branches ?? [];
  return {
    ready: [jobTitles, contractTypes, documentTypes, countries, banks, grades, departments].every((q) => !q.isPending),
    jobTitles: jobTitles.data?.results ?? [],
    contractTypes: contractTypes.data?.results ?? [],
    documentTypes: documentTypes.data?.results ?? [],
    countries: countries.data ?? [],
    banks: banks.data ?? [],
    grades: grades.data?.results ?? [],
    departments: departments.data?.results ?? [],
    branches,
    options: {
      jobTitles: options(active(jobTitles.data?.results), (r) => r.id),
      grades: options(active(grades.data?.results), (r) => r.id),
      contractTypes: options(active(contractTypes.data?.results), (r) => r.id),
      countries: options(countries.data, (r) => r.code),
      departments: options(departments.data?.results.filter((d) => d.is_active), (r) => r.id),
      branches: options(branches, (r) => r.id),
    },
    name: {
      jobTitle: nameOf(jobTitles.data?.results, (r) => r.id),
      grade: nameOf(grades.data?.results, (r) => r.id),
      department: nameOf(departments.data?.results, (r) => r.id),
      branch: nameOf(branches, (r) => r.id),
      country: nameOf(countries.data, (r) => r.code),
      bank: nameOf(banks.data, (r) => r.code),
      contractType: nameOf(contractTypes.data?.results, (r) => r.id),
      documentType: nameOf(documentTypes.data?.results, (r) => r.code),
    },
  };
}

export type MasterData = ReturnType<typeof useMasterData>;
