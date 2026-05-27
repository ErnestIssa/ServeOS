import React from "react";
import { Switch, type SwitchProps } from "react-native";
import { useAppTheme } from "../theme/AppThemeContext";

type Props = Omit<SwitchProps, "trackColor" | "thumbColor" | "ios_backgroundColor"> & {
  value: boolean;
  onValueChange: (v: boolean) => void;
};

export function ThemedSwitch({ value, onValueChange, disabled, ...rest }: Props) {
  const { colors: t } = useAppTheme();
  const [k, setK] = React.useState(0);

  React.useEffect(() => {
    const id = setTimeout(() => setK((x) => x + 1), 0);
    return () => clearTimeout(id);
  }, [value, disabled, t.bgSubtle, t.accentPurple, t.textMuted]);

  return (
    <Switch
      key={k}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: t.bgSubtle, true: t.accentPurple }}
      thumbColor={value ? "#ffffff" : t.textMuted}
      ios_backgroundColor={t.bgSubtle}
      {...rest}
    />
  );
}
