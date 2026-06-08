import type { SignupFormState } from "@serveos/core-shared/signup-wizard";

/** Address shown on the company summary row. */
export function formatCompanyAddress(form: SignupFormState): string {
  if (!form.bizCompanyFieldsLocked && !form.bizCity.trim()) {
    const line = form.bizAddress.trim();
    return line || "—";
  }

  const parts = [form.bizAddress.trim(), form.bizCity.trim(), form.bizCountry.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

/** Address pre-filled in the change-company modal (single editable line). */
export function companyAddressForEdit(form: SignupFormState): string {
  if (!form.bizCompanyFieldsLocked && !form.bizCity.trim()) {
    return form.bizAddress.trim();
  }

  return [form.bizAddress.trim(), form.bizCity.trim(), form.bizCountry.trim()].filter(Boolean).join(", ");
}

export type CompanyInfoDraft = {
  companyName: string;
  address: string;
  companyForm: string;
};

export function companyInfoDraftFromForm(form: SignupFormState): CompanyInfoDraft {
  return {
    companyName: form.bizName,
    address: companyAddressForEdit(form),
    companyForm: form.bizLegalFormLocked
  };
}

export function applyCompanyInfoDraft(
  draft: CompanyInfoDraft
): Pick<SignupFormState, "bizName" | "bizAddress" | "bizCity" | "bizLegalFormLocked" | "bizCompanyFieldsLocked"> {
  return {
    bizName: draft.companyName.trim(),
    bizAddress: draft.address.trim(),
    bizCity: "",
    bizLegalFormLocked: draft.companyForm.trim(),
    bizCompanyFieldsLocked: false
  };
}
