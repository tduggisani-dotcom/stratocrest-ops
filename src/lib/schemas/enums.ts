import { z } from "zod"
import {
  AVAILABILITY_LABELS,
  CANDIDATE_STAGES,
  CONTACT_METHODS,
  DEBRIEF_KINDS,
  DEBRIEF_STATUSES,
  HYPOTHESIS_DECISIONS,
  HYPOTHESIS_STATUSES,
  ORG_KINDS,
  ORG_REGIONS,
  ORG_SUBTYPES,
  SESSION_EMPHASES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TEAM_MEETING_STATUSES,
  TEST_OUTCOMES,
} from "@/lib/labels"

/** Zod versions of the database enums, built from the same value lists as the labels. */
export const orgKindSchema = z.enum(ORG_KINDS)
export const orgRegionSchema = z.enum(ORG_REGIONS)
export const orgSubtypeSchema = z.enum(ORG_SUBTYPES)
export const contactMethodSchema = z.enum(CONTACT_METHODS)
export const hypothesisStatusSchema = z.enum(HYPOTHESIS_STATUSES)
export const hypothesisDecisionSchema = z.enum(HYPOTHESIS_DECISIONS)
export const testOutcomeSchema = z.enum(TEST_OUTCOMES)
export const taskStatusSchema = z.enum(TASK_STATUSES)
export const taskPrioritySchema = z.enum(TASK_PRIORITIES)
export const debriefKindSchema = z.enum(DEBRIEF_KINDS)
export const debriefStatusSchema = z.enum(DEBRIEF_STATUSES)
export const availabilityLabelSchema = z.enum(AVAILABILITY_LABELS)
export const sessionEmphasisSchema = z.enum(SESSION_EMPHASES)
export const teamMeetingStatusSchema = z.enum(TEAM_MEETING_STATUSES)
export const candidateStageSchema = z.enum(CANDIDATE_STAGES)
