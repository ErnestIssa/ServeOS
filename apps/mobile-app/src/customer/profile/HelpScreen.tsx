import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeContext";
import { FadeSection, ProfileCard, ProfileScreenContainer, RowItem, SectionLabel } from "./ProfileUi";
import type { AppNavHighlightKey } from "./profileNavHighlight";

type Props = {
  bottomInset: number;
  onOpenSupport: () => void;
  onOpenSection: (title: string, subtitle: string | undefined, key: AppNavHighlightKey) => void;
};

function GuideTip(props: { title: string; body: string }) {
  const { colors: t } = useAppTheme();
  return (
    <View style={{ paddingHorizontal: t.space.sm, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: t.text }}>{props.title}</Text>
      <Text style={{ marginTop: 4, fontSize: 13, fontWeight: "600", color: t.textSecondary, lineHeight: 19 }}>
        {props.body}
      </Text>
    </View>
  );
}

export function HelpScreen(props: Props) {
  const { colors: t } = useAppTheme();
  const introStyles = React.useMemo(
    () =>
      StyleSheet.create({
        intro: {
          fontSize: 14,
          fontWeight: "600",
          color: t.textSecondary,
          lineHeight: 20,
          paddingHorizontal: t.space.sm,
          paddingTop: 4,
          paddingBottom: 12
        }
      }),
    [t]
  );

  return (
    <ProfileScreenContainer topInset={0} bottomInset={props.bottomInset}>
      <FadeSection>
        <Text style={introStyles.intro}>
          Support, guides, and answers — everything that used to live under Help on your profile is here.
        </Text>
        <SectionLabel variant="me">Support</SectionLabel>
        <ProfileCard noPad>
          <RowItem
            icon="💬"
            title="Support chat"
            subtitle="Message the venue or ServeOS support"
            highlightKey="app:help:support"
            onPress={props.onOpenSupport}
          />
          <RowItem
            icon="🆘"
            title="Report a problem"
            subtitle="Orders, payments, or app issues"
            highlightKey="app:help:report"
            onPress={() =>
              props.onOpenSection("Report a problem", "Describe what went wrong", "app:help:report")
            }
          />
          <RowItem
            icon="❓"
            title="FAQs & troubleshooting"
            subtitle="Common questions and fixes"
            highlightKey="app:help:faq"
            last
            onPress={() => props.onOpenSection("FAQs & troubleshooting", "Quick answers", "app:help:faq")}
          />
        </ProfileCard>
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Guides</SectionLabel>
        <ProfileCard noPad>
          <GuideTip
            title="Getting started"
            body="Browse menus, book a table, track orders, and manage your profile from the bottom tabs."
          />
          <GuideTip
            title="Orders & reservations"
            body="Place orders from the menu tab, watch live status under Activity, and view bookings in Upcoming reservations."
          />
          <GuideTip
            title="Payments & receipts"
            body="Pay with card or Swish at checkout. Receipts and order history are under Activity on your profile."
          />
          <RowItem
            icon="📖"
            title="Full getting-started guide"
            subtitle="Step-by-step walkthrough"
            highlightKey="app:help:getting_started"
            onPress={() =>
              props.onOpenSection("Getting started", "Basics for new users", "app:help:getting_started")
            }
          />
          <RowItem
            icon="🍽️"
            title="Orders & reservations help"
            subtitle="Detailed ordering and booking help"
            highlightKey="app:help:orders"
            onPress={() =>
              props.onOpenSection("Orders & reservations", "How ordering works", "app:help:orders")
            }
          />
          <RowItem
            icon="💳"
            title="Payments & receipts help"
            subtitle="Billing, Swish, and receipts"
            highlightKey="app:help:payments"
            last
            onPress={() =>
              props.onOpenSection("Payments & receipts", "Payment methods and history", "app:help:payments")
            }
          />
        </ProfileCard>
      </FadeSection>

      <FadeSection>
        <SectionLabel variant="me">Platform</SectionLabel>
        <ProfileCard noPad>
          <RowItem
            icon="ℹ️"
            title="About ServeOS"
            subtitle="Version, legal, and policies"
            highlightKey="app:help:about"
            last
            onPress={() =>
              props.onOpenSection("About ServeOS", "Platform version and legal", "app:help:about")
            }
          />
        </ProfileCard>
      </FadeSection>
    </ProfileScreenContainer>
  );
}
