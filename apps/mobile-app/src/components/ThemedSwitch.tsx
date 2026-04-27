import React from "react";
import { Switch, type SwitchProps } from "react-native";
import { R } from "../theme";

type Props = Omit<SwitchProps, "trackColor" | "thumbColor" | "ios_backgroundColor"> & {
  value: boolean;
  onValueChange: (v: boolean) => void;
};

/**
 * ThemedSwitch
 * - Track colors: off=R.bgSubtle, on=R.accentPurple (brand)
 * - Thumb colors: off=R.textMuted, on=#ffffff
 * - iOS background: R.bgSubtle
 * - Remount trick: bump key when value changes to avoid incorrect initial native paint
 */
export function ThemedSwitch({ value, onValueChange, disabled, ...rest }: Props) {
  const [k, setK] = React.useState(0);

  // Remount workaround for native Switch occasionally painting stale colors on first render.
  React.useEffect(() => {
    const id = setTimeout(() => setK((x) => x + 1), 0);
    return () => clearTimeout(id);
  }, [value, disabled]);

  return (
    <Switch
      key={k}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: R.bgSubtle, true: R.accentPurple }}
      thumbColor={value ? "#ffffff" : R.textMuted}
      ios_backgroundColor={R.bgSubtle}
      {...rest}
    />
  );
}

