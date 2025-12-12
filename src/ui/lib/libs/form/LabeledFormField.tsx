import { Alert } from "@/lib/components/alert";
import { clsx } from "@/lib/functions/clsx";
import React from "react";

export type LabeledFormFieldNonInputProps = {
  label: React.ReactNode;
  error?: $Maybe<string>;
  required?: boolean;
};
export type LabeledFormFieldProps = LabeledFormFieldNonInputProps &
  (
    | LabeledFormFieldNoChildrenProps
    | {
        name?: string;
        children: React.ReactNode;
      }
  );
export type LabeledFormFieldNoChildrenProps = {
  name: string;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function LabeledFormField(props: LabeledFormFieldProps) {
  return (
    <div className="w-full">
      <label
        className={clsx(
          "mb-2 input pr-0 w-full",
          props.required && "after:content-['_*']",
        )}
      >
        <span className="label">{props.label}</span>

        {"children" in props ? (
          props.children
        ) : (
          <input
            id={props.name}
            {...props}
            className={clsx("input", props.className)}
          />
        )}
      </label>
      <>{props.error ? <Alert className="mt-3">{props.error}</Alert> : null}</>
    </div>
  );
}

export type LabeledInputProps = React.InputHTMLAttributes<HTMLInputElement> &
  LabeledFormFieldNonInputProps;

export const LabeledFormInputField = React.forwardRef<
  HTMLInputElement,
  LabeledInputProps
>(({ className, type, ...props }, ref) => {
  const { name, ...rest } = props;
  return (
    <LabeledFormField {...rest}>
      <input
        id={props.name}
        ref={ref}
        type={type}
        {...props}
        className={clsx("input", className)}
      />
    </LabeledFormField>
  );
});
LabeledFormInputField.displayName = "LabeledFormInputField";
