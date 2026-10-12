import { requireTeamMember } from "@/lib/auth"
import { addDays, isIsoDate, todayEt } from "@/lib/dates"
import { taskReturnPath } from "./links"
import { pickOption } from "./options"
import { getTaskFormOptions } from "./queries"
import { TaskForm } from "./task-form"

/** Days from today a new task is due unless the link says otherwise. */
const DEFAULT_DUE_IN_DAYS = 7

type SearchParams = Record<string, string | string[] | undefined>

/**
 * The /tasks/new form, prefilled from the link that opened it:
 * ?owner=, ?due=YYYY-MM-DD, ?org=, ?session=, ?kr=, ?team_meeting=,
 * ?org_meeting= and ?return_to= (see newTaskHref). Unknown ids are ignored;
 * the owner defaults to you and the due date to a week from today.
 */
export async function NewTaskForm({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const person = await requireTeamMember()
  const today = todayEt()
  const [params, options] = await Promise.all([searchParams, getTaskFormOptions(today)])

  const people = options.people.map((p) => ({ value: p.id, label: p.name }))
  const due = Array.isArray(params.due) ? params.due[0] : params.due

  return (
    <TaskForm
      mode="create"
      returnTo={taskReturnPath(params.return_to)}
      options={options}
      defaults={{
        owner_id: pickOption(people, params.owner) || person.id,
        due_date: due && isIsoDate(due) ? due : addDays(today, DEFAULT_DUE_IN_DAYS),
        priority: "medium",
        organization_id: pickOption(options.organizations, params.org),
        synthe6_session_id: pickOption(options.sessions, params.session),
        key_result_id: pickOption(options.keyResults, params.kr),
        team_meeting_id: pickOption(options.teamMeetings, params.team_meeting),
        org_meeting_id: pickOption(options.orgMeetings, params.org_meeting),
      }}
    />
  )
}
