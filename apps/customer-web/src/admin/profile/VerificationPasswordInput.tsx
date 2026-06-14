import { useId, useState, type InputHTMLAttributes } from "react";
import { AdminInput } from "../AdminUi";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "autoComplete"> & {
  /** When true, allows browser new-password hints (change-password flow only). */
  allowNewPasswordHints?: boolean;
};

/** Password field that avoids browser / manager autofill on verification steps. */
export function VerificationPasswordInput({ allowNewPasswordHints = false, onFocus, ...props }: Props) {
  const id = useId();
  const [editable, setEditable] = useState(false);

  return (
    <>
      <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden readOnly />
      <AdminInput
        id={props.id ?? id}
        type="password"
        autoComplete={allowNewPasswordHints ? "new-password" : "off"}
        name={props.name ?? `verification-${id}`}
        readOnly={!editable && !allowNewPasswordHints}
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        onFocus={(e) => {
          if (!allowNewPasswordHints) setEditable(true);
          onFocus?.(e);
        }}
        {...props}
      />
    </>
  );
}
