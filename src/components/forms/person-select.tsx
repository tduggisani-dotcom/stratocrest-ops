import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Person = { id: string; name: string }

/**
 * Pick one teammate (owner, facilitator…). A native <select>: fast, accessible and
 * the phone's own picker on mobile. Pass `emptyLabel` to allow "nobody".
 */
export function PersonSelect({
  people,
  emptyLabel,
  ...props
}: Omit<React.ComponentProps<typeof NativeSelect>, "children"> & {
  people: readonly Person[]
  emptyLabel?: string
}) {
  return (
    <NativeSelect {...props}>
      {emptyLabel !== undefined || !props.defaultValue ? (
        <NativeSelectOption value="">{emptyLabel ?? "Choose a teammate"}</NativeSelectOption>
      ) : null}
      {people.map((person) => (
        <NativeSelectOption key={person.id} value={person.id}>
          {person.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
