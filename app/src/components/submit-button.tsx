"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./ui/button";

/** Submit button that disables itself while its form's server action runs. */
export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
