import { StyleSheet, Text, View } from "react-native";

export default function LedgersScreen() {
  return (
    <View style={styles.container}>
      <Text>Ledgers</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
