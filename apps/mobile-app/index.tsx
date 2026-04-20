import "react-native-gesture-handler";
import "react-native-reanimated";
import { registerRootComponent } from "expo";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import App from "./App";

function Root() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <App />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }
});

registerRootComponent(Root);
