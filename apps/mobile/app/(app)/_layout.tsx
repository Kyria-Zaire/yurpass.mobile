import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/theme'

type TabIconName = 'flame-outline' | 'add-circle-outline' | 'person-outline'

interface TabConfig {
  name: string
  title: string
  icon: TabIconName
}

const TABS: TabConfig[] = [
  { name: 'index', title: 'Feed', icon: 'flame-outline' },
  { name: 'create', title: 'Créer', icon: 'add-circle-outline' },
  { name: 'profile', title: 'Profil', icon: 'person-outline' },
]

export default function AppLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 0.5,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  )
}
