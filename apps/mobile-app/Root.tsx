import "react-native-gesture-handler";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import App from "./App";
import { AppErrorHost } from "./src/errors/AppErrorHost";
import { AppThemeProvider } from "./src/theme/AppThemeContext";

function Root() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <AppErrorHost>
            <App />
          </AppErrorHost>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }
});

export default Root;
