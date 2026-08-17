import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/store/authStore';

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  const isErrander = user?.role === 'errander';

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary[500],
      tabBarInactiveTintColor: colors.neutral[400],
      tabBarStyle: {
        height: 74,
        borderTopWidth: 1,
        borderTopColor: colors.neutral[100],
        backgroundColor: 'rgba(255,255,255,0.92)',
        paddingTop: 6,
        paddingBottom: 8,
      },
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      tabBarIconStyle: { marginTop: 2 },
    }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: isErrander ? 'Browse' : 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name={isErrander ? 'search-outline' : 'home-outline'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          href: isErrander ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          href: isErrander ? null : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="newspaper-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bids"
        options={{
          title: isErrander ? 'My errands' : 'My Bids',
          href: isErrander ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: isErrander ? 'Earnings' : 'Wallet',
          href: isErrander ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          href: isErrander ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
