import React from "react";
import { useAppTheme } from "../../theme/AppThemeContext";
import { createChatTokens, type ChatTokens } from "./chatTheme";

export function useChatTheme(): { tokens: ChatTokens; colors: ReturnType<typeof useAppTheme>["colors"]; isDark: boolean } {
  const { colors, isDark } = useAppTheme();
  const tokens = React.useMemo(() => createChatTokens(colors, isDark), [colors, isDark]);
  return { tokens, colors, isDark };
}
