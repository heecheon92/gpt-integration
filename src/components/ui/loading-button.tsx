import { Loader2 } from "lucide-react";
import { ComponentProps } from "react";
import { Button } from "./button";

type LoadingButtonProps = {
  loading: boolean;
} & ComponentProps<typeof Button>;

export function LoadingButton({
  loading,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button {...props} disabled={loading || props.disabled}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}
