import { AdminBubbleDropdown, type BubbleDropdownOption } from "../AdminBubbleDropdown";

export type PickOption = BubbleDropdownOption;

type Props = {
  label: string;
  value: string;
  options: PickOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export function ProfilePickDropdown(props: Props) {
  return <AdminBubbleDropdown {...props} />;
}
