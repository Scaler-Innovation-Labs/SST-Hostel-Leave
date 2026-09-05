/**
 * How many requests sit at one workflow step, counted over the whole queue.
 *
 * This is a facet, not a page statistic: it is counted with every filter
 * applied EXCEPT the waiting-on filter itself, so selecting a step never
 * changes the counts the chips report.
 */
export type ApprovalStepBreakdownEntry = {
  stepKey: string;
  count: number;
};
