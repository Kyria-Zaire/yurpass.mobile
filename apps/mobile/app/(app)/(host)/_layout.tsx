import { Stack } from 'expo-router'
import { COLORS } from '../../../constants/theme'

export default function HostLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.bg },
        animation: 'slide_from_right',
      }}
    />
  )
}
