import { useRef, useState } from 'react'
import { View, TextInput, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { COLORS, BORDER_RADIUS } from '../../constants/theme'

interface OTPInputProps {
  length?: number
  onComplete: (code: string) => void
}

export function OTPInput({ length = 6, onComplete }: OTPInputProps): React.JSX.Element {
  const [values, setValues] = useState<string[]>(Array.from({ length }, () => ''))
  const [focusedIndex, setFocusedIndex] = useState(0)
  const inputRefs = useRef<(TextInput | null)[]>([])

  const handleChange = (text: string, index: number): void => {
    const digit = text.replace(/\D/g, '').slice(-1)
    const newValues = [...values]
    newValues[index] = digit
    setValues(newValues)

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    const code = newValues.join('')
    if (code.length === length && !code.includes('')) {
      onComplete(code)
    }
  }

  const handleKeyPress = (key: string, index: number): void => {
    if (key === 'Backspace' && !values[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      const newValues = [...values]
      newValues[index - 1] = ''
      setValues(newValues)
    }
  }

  return (
    <View style={styles.container}>
      {values.map((value, index) => (
        <TextInput
          key={index}
          ref={(ref) => { inputRefs.current[index] = ref }}
          style={[
            styles.input,
            focusedIndex === index && styles.inputFocused,
            value ? styles.inputFilled : null,
          ]}
          value={value}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
          onFocus={() => setFocusedIndex(index)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          autoFocus={index === 0}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  input: {
    width: 48,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputFocused: {
    borderColor: COLORS.accent,
  },
  inputFilled: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surfaceElevated,
  },
})
