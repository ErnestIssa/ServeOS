import { StyleSheet } from "react-native";

/** Shared Book tab step 1 / step 2 section typography. */
export const reservationBookStyles = StyleSheet.create({
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 10,
    marginBottom: 6
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
    marginBottom: 12
  },
  sectionSubtitleFollow: {
    marginTop: 20
  },
  backLink: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
    marginBottom: 4,
    alignSelf: "flex-start"
  }
});
