import { ErrorState as SstErrorState } from "@/design-system/sst";

type ErrorStateProps = {
  /** What failed, named. Never "Something went wrong". */
  message?: string;
  /** The next step, where there is one beyond retrying. */
  description?: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * An error state says what failed and offers a way forward. The default names
 * the layer that broke rather than blaming the user or apologising — a message
 * the reader can act on beats a shrug.
 */
export function ErrorState({
  message = "We couldn't load this",
  description = "The request didn't come back from the server. Try again in a moment.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <SstErrorState
      title={message}
      description={description}
      onRetry={onRetry}
      className={className}
    />
  );
}
