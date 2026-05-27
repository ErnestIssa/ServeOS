import React from "react";
import { StyleSheet, Text } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { FadeSection, ProfileCard, ProfileScreenContainer } from "./ProfileUi";

type Props = {
  title: string;
  subtitle?: string;
  topInset: number;
  bottomInset: number;
};

export function ProfilePlaceholderScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        title: { fontSize: 20, fontWeight: "900", color: t.text },
        sub: { marginTop: 6, fontSize: 14, fontWeight: "600", color: t.textSecondary },
        body: { marginTop: 14, fontSize: 15, fontWeight: "600", color: t.textMuted, lineHeight: 22 }
      }),
    [t]
  );

  return (
    <ProfileScreenContainer topInset={props.topInset} bottomInset={props.bottomInset}>
      <FadeSection>
        <ProfileCard>
          <Text style={styles.title}>{props.title}</Text>
          {props.subtitle ? <Text style={styles.sub}>{props.subtitle}</Text> : null}
          <Text style={styles.body}>This section will connect to live data soon. Layout follows the ServeOS profile pattern.</Text>
        </ProfileCard>
      </FadeSection>
    </ProfileScreenContainer>
  );
}

