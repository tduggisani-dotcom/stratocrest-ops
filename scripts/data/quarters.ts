/**
 * OKR quarters on Synthe6's own labels (spec §6.8). Goals are set at W2
 * (2026-10-14) and first shared at W5 (2026-11-04). Each quarter ends on its
 * share-out session; Q4 ends at graduation (W47). The quarters are contiguous.
 * `pnpm seed` upserts on label and links share_out_session_id by week label.
 */
export type QuarterSeed = {
  label: "Q1" | "Q2" | "Q3" | "Q4"
  start_date: string
  end_date: string
  share_out_date: string
  share_out_week_label: string
}

export const QUARTERS: readonly QuarterSeed[] = [
  {
    label: "Q1",
    start_date: "2026-10-14",
    end_date: "2027-01-13",
    share_out_date: "2027-01-13",
    share_out_week_label: "W10",
  },
  {
    label: "Q2",
    start_date: "2027-01-14",
    end_date: "2027-04-07",
    share_out_date: "2027-04-07",
    share_out_week_label: "W22",
  },
  {
    label: "Q3",
    start_date: "2027-04-08",
    end_date: "2027-07-07",
    share_out_date: "2027-07-07",
    share_out_week_label: "W35",
  },
  {
    label: "Q4",
    start_date: "2027-07-08",
    end_date: "2027-09-29",
    share_out_date: "2027-09-29",
    share_out_week_label: "W47",
  },
]
