import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AuthUser } from "../../api";
import { ThemedSwitch } from "../../components/ThemedSwitch";
import { useAppTheme } from "../../theme/AppThemeContext";
import { hapticSelect } from "./ProfileUi";
import type { AppNavHighlightKey } from "./profileNavHighlight";
import {
  FadeSection,
  ProfileCard,
  ProfileScreenContainer,
  SectionLabel,
  SectionRow,
  TopChip
} from "./ProfileUi";

type Props = {
  user: AuthUser | null;
  topInset: number;
  bottomInset: number;
  /** Measured top chrome (back row + safe padding) for frosted glass bleed. */
  chromeTopBleed: number;
  onScrollEdges?: (edges: { atTop: boolean; atBottom: boolean }) => void;
  onNavigateHelp: () => void;
  onNavigateSafety: () => void;
  onNavigateAppSettings: () => void;
  onNavigateSection: (title: string, subtitle: string | undefined, key: AppNavHighlightKey) => void;
  onChooseVenue: () => void;
};

export function AppControlCenterHome(props: Props) {
  const { colors: t, scheme, setScheme } = useAppTheme();
  const role = String(props.user?.role ?? "CUSTOMER").toUpperCase();
  const appearanceStyles = React.useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between"
        },
        label: { fontSize: 16, fontWeight: "700", color: t.text, flex: 1, paddingRight: 12 }
      }),
    [t]
  );

  return (
    <ProfileScreenContainer
      topInset={props.topInset}
      bottomInset={props.bottomInset}
      frostedScrollEdges
      frostedTopBleed={props.chromeTopBleed}
      frostedExternalTopChrome
      onScrollEdges={props.onScrollEdges}
    >
      <FadeSection>
        <View style={{ flexDirection: "row", marginBottom: t.space.sm, marginHorizontal: -4 }}>
          <TopChip
            variant="help"
            label="Help"
            highlightKey="app:chip:help"
            onPress={props.onNavigateHelp}
          />
          <TopChip
            variant="safety"
            label="Safety"
            highlightKey="app:chip:safety"
            onPress={props.onNavigateSafety}
          />
          <TopChip
            variant="settings"
            label="App settings"
            highlightKey="app:chip:settings"
            onPress={props.onNavigateAppSettings}
          />
        </View>
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Access & venues</SectionLabel>
        <ProfileCard noPad>
          <SectionRow
            title="Switch role / mode"
            subtitle={role === "CUSTOMER" ? "Guest · customer mode" : role}
            highlightKey="app:role"
            onPress={() => props.onNavigateSection("Switch role", "Customer, owner, and staff modes", "app:role")}
          />
          <SectionRow
            title="Venues"
            subtitle="Manage or select restaurants"
            highlightKey="app:venues"
            last
            onPress={props.onChooseVenue}
          />
        </ProfileCard>
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Business & operations</SectionLabel>
        <ProfileCard noPad>
          <SectionRow
            title="Business dashboard"
            subtitle="Owner and staff overview"
            highlightKey="app:dashboard"
            onPress={() => props.onNavigateSection("Business dashboard", "Web admin and analytics", "app:dashboard")}
          />
          <SectionRow
            title="Staff tools"
            subtitle="KDS, checkout, floor operations"
            highlightKey="app:staff_tools"
            last
            onPress={() => props.onNavigateSection("Staff tools", "Operational shortcuts", "app:staff_tools")}
          />
        </ProfileCard>
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Resources</SectionLabel>
        <ProfileCard noPad>
          <SectionRow
            title="Tutorials & help center"
            subtitle="Docs and how-to guides"
            highlightKey="app:resources"
            last
            onPress={() => props.onNavigateSection("Resources", "Tutorials and documentation", "app:resources")}
          />
        </ProfileCard>
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Privacy & app</SectionLabel>
        <ProfileCard noPad>
          <SectionRow
            title="Safety & privacy"
            subtitle="Policies and data controls"
            highlightKey="app:safety_privacy"
            onPress={props.onNavigateSafety}
          />
          <SectionRow
            title="App settings"
            subtitle="Theme, language, device"
            highlightKey="app:chip:settings"
            onPress={props.onNavigateAppSettings}
          />
          <SectionRow
            title="Connected devices"
            subtitle="Printers, KDS, displays"
            highlightKey="app:connected"
            onPress={() => props.onNavigateSection("Connected devices", "Hardware pairing", "app:connected")}
          />
          <SectionRow
            title="Integrations"
            subtitle="Stripe, Swish, and partners"
            highlightKey="app:integrations"
            last
            onPress={() => props.onNavigateSection("Integrations", "Payment and platform links", "app:integrations")}
          />
        </ProfileCard>
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Platform</SectionLabel>
        <ProfileCard noPad>
          <SectionRow
            title="Session management"
            subtitle="Active sessions and devices"
            highlightKey="app:sessions"
            onPress={() => props.onNavigateSection("Session management", "Devices signed in", "app:sessions")}
          />
          <SectionRow
            title="Developer / advanced"
            subtitle="Logs, debug, and tools"
            highlightKey="app:developer"
            onPress={() => props.onNavigateSection("Developer tools", "Diagnostics", "app:developer")}
          />
          <SectionRow
            title="About ServeOS"
            subtitle="Platform version and legal"
            highlightKey="app:about"
            last
            onPress={() => props.onNavigateSection("About ServeOS", "System information", "app:about")}
          />
        </ProfileCard>
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Appearance</SectionLabel>
        <ProfileCard>
          <View style={appearanceStyles.row}>
            <Text style={appearanceStyles.label}>Dark mode</Text>
            <ThemedSwitch
              value={scheme === "dark"}
              onValueChange={(v) => {
                hapticSelect();
                setScheme(v ? "dark" : "light");
              }}
            />
          </View>
        </ProfileCard>
      </FadeSection>
    </ProfileScreenContainer>
  );
}
