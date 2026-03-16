import { View, Text } from 'react-native'

export default function HomeScreen(): React.JSX.Element {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#F5F5F5', fontSize: 24 }}>Yurpass</Text>
    </View>
  )
}
