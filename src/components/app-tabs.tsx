import { NativeTabs } from 'expo-router/native-tabs';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      iconColor={{ default: colors.textSecondary, selected: colors.text }}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Compose</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="paperplane" md="send" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="diff">
        <NativeTabs.Trigger.Label>Diff</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" md="compare_arrows" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="webhooks">
        <NativeTabs.Trigger.Label>Webhooks</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="antenna.radiowaves.left.and.right"
          md="sensors"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
