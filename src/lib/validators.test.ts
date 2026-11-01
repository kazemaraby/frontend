import { describe, expect, it } from "vitest";

import {
  checkArabicName,
  checkEnglishName,
  checkFile,
  checkIdNumber,
  checkSaudiIban,
  checkSaudiMobile,
  checkSpreadsheet,
  formatIban,
  ibanBankCode,
  luhnOk,
  MAX_FILE_BYTES,
  normalizeDigits,
} from "./validators";

// The same cases as backend/tests/test_validators.py, so both sides agree on what is valid.

const withCheckDigit = (nine: string) => [..."0123456789"].map((d) => nine + d).find(luhnOk)!;

function saudiIban(bank: string, account: string) {
  const bban = bank + account;
  let remainder = 0;
  for (const ch of bban + "SA00") for (const d of parseInt(ch, 36).toString()) remainder = (remainder * 10 + Number(d)) % 97;
  return `SA${String(98 - remainder).padStart(2, "0")}${bban}`;
}

describe("digits", () => {
  it("normalises Arabic-Indic and Persian digits", () => {
    expect(normalizeDigits("١٠٠٠٠٠٠٠٠٨")).toBe("1000000008");
    expect(normalizeDigits("۰۵۰۱۲۳۴۵۶۷")).toBe("0501234567");
  });
});

describe("national ID / iqama", () => {
  it.each(["1000000008", "2000000006", withCheckDigit("104567891"), withCheckDigit("245678912")])("accepts %s", (n) => {
    expect(checkIdNumber(n)).toEqual({ value: n, error: null });
  });

  it("accepts Arabic digits and spaces", () => {
    expect(checkIdNumber("١٠٠٠ ٠٠٠ ٠٠٨").value).toBe("1000000008");
  });

  it.each([
    ["1000000009", "id_checksum"],
    ["2000000005", "id_checksum"],
    ["100000000", "id_format"],
    ["10000000081", "id_format"],
    ["10000O0008", "id_format"],
    ["", "id_format"],
    [withCheckDigit("504567891"), "id_prefix"],
  ])("rejects %s (%s)", (value, code) => {
    expect(checkIdNumber(value).error).toBe(code);
  });

  it("must match the expected type", () => {
    expect(checkIdNumber("2000000006", "national_id").error).toBe("id_type");
    expect(checkIdNumber("1000000008", "iqama").error).toBe("id_type");
    expect(checkIdNumber("1000000008", "national_id").error).toBeNull();
  });

  it("checks border numbers by format only", () => {
    expect(checkIdNumber("3012345678", "border_no").error).toBeNull();
    expect(checkIdNumber("4123456789").error).toBeNull();
  });
});

describe("IBAN", () => {
  it("accepts the known Al Rajhi IBAN with spaces", () => {
    const { value, error } = checkSaudiIban("SA03 8000 0000 6080 1016 7519");
    expect(error).toBeNull();
    expect(value).toBe("SA0380000000608010167519");
    expect(ibanBankCode(value)).toBe("80");
    expect(formatIban(value)).toBe("SA03 8000 0000 6080 1016 7519");
  });

  it.each(["05", "10", "20", "45", "80"])("accepts a generated IBAN of bank %s in lower case", (bank) => {
    const iban = saudiIban(bank, "000000608010167519");
    expect(checkSaudiIban(iban.toLowerCase())).toEqual({ value: iban, error: null });
  });

  it.each([
    ["SA0480000000608010167519", "iban_checksum"],
    ["SA0380000000608010167518", "iban_checksum"],
    ["SA038000000060801016751", "iban_format"],
    ["SA03800000006080101675199", "iban_format"],
    ["AE070331234567890123456", "iban_country"],
    ["", "iban_country"],
  ])("rejects %s (%s)", (value, code) => {
    expect(checkSaudiIban(value).error).toBe(code);
  });

  it("accepts Arabic digits", () => {
    expect(checkSaudiIban("SA٠٣٨٠٠٠٠٠٠٠٦٠٨٠١٠١٦٧٥١٩").value).toBe("SA0380000000608010167519");
  });
});

describe("Saudi mobile", () => {
  it.each(["0501234567", "+966501234567", "00966501234567", "966 50 123 4567", "٠٥٠١٢٣٤٥٦٧", "050-123-4567"])(
    "normalises %s to E.164",
    (value) => {
      expect(checkSaudiMobile(value)).toEqual({ value: "+966501234567", error: null });
    },
  );

  it.each(["0112345678", "+971501234567", "05012345"])("is not a Saudi mobile: %s", (value) => {
    expect(checkSaudiMobile(value).error).toBe("saudi_mobile");
  });
});

describe("names", () => {
  it("wants Arabic letters in Arabic fields and Latin letters in English ones", () => {
    expect(checkArabicName("محمد").error).toBeNull();
    expect(checkArabicName("Mohammed").error).toBe("arabic_name");
    expect(checkArabicName("محمد Ali").error).toBe("arabic_name");
    expect(checkEnglishName("Mohammed Al-Qahtani").error).toBeNull();
    expect(checkEnglishName("محمد").error).toBe("english_name");
    expect(checkArabicName("").error).toBeNull(); // empty = not given
  });
});

describe("files", () => {
  const file = (name: string, bytes: number[] | string, size?: number) => {
    const blob = new File([typeof bytes === "string" ? bytes : new Uint8Array(bytes)], name);
    return size === undefined ? blob : Object.defineProperty(blob, "size", { value: size });
  };

  it("accepts real PDF, JPEG and PNG files", async () => {
    expect(await checkFile(file("scan.pdf", "%PDF-1.4\n%%EOF"))).toBeNull();
    expect(await checkFile(file("photo.JPG", [0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    expect(await checkFile(file("card.png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
  });

  it("rejects other types, renamed files and files over the limit", async () => {
    expect(await checkFile(file("tool.exe", "MZ"))).toBe("file_type");
    expect(await checkFile(file("page.pdf", "<html><script>"))).toBe("file_content");
    expect(await checkFile(file("big.pdf", "%PDF-1.4", MAX_FILE_BYTES + 1))).toBe("file_size");
  });
});

describe("spreadsheets (imports)", () => {
  it("accepts an .xlsx (zip) file and nothing else", async () => {
    expect(await checkSpreadsheet(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1])], "staff.xlsx"))).toBeNull();
    expect(await checkSpreadsheet(new File(["a,b"], "staff.csv"))).toBe("file_xlsx");
    expect(await checkSpreadsheet(new File(["not a zip"], "staff.xlsx"))).toBe("file_xlsx");
  });
});
