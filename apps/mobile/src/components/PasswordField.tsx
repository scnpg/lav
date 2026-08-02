import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, TextInput, View, type StyleProp, type TextStyle } from "react-native";

import { useTheme } from "../theme";

interface PasswordFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  style: StyleProp<TextStyle>;
  textContentType?: "password" | "newPassword";
  returnKeyType?: "next" | "go" | "done";
  onSubmitEditing?: () => void;
}

// Every password field in the app (sign-in, sign-up x2, reset-password x2)
// gets the same show/hide toggle - one Ionicons eye/eye-off button
// absolutely positioned inside the input, reusing whatever `style` the
// caller already passes for its own themed input box (background/border/
// height/etc.) rather than each screen re-implementing the toggle itself.
export function PasswordField({
  value,
  onChangeText,
  placeholder,
  style,
  textContentType = "password",
  returnKeyType,
  onSubmitEditing,
}: PasswordFieldProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={{ justifyContent: "center" }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[style, { paddingRight: 44 }]}
        secureTextEntry={!visible}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      <Pressable
        onPress={() => setVisible((prev) => !prev)}
        hitSlop={8}
        style={{ position: "absolute", right: 12, padding: 4 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
      >
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={19} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}
