import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AppScreen,
  Badge,
  EmptyState,
  Field,
  ScreenHeading,
  Surface,
  UiButton,
} from '@/components/inspector-ui';
import { useInspectorTheme } from '@/constants/inspector-theme';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface WebhookMessage {
  id: number;
  receivedAt: number;
  payload: string;
}

function formatPayload(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload) as unknown, null, 2);
  } catch {
    return payload;
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export default function WebhookScreen() {
  const colors = useInspectorTheme();
  const socketRef = useRef<WebSocket | null>(null);
  const messageId = useRef(0);
  const [url, setUrl] = useState('');
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [messages, setMessages] = useState<WebhookMessage[]>([]);
  const [error, setError] = useState('');

  useEffect(
    () => () => {
      socketRef.current?.close();
      socketRef.current = null;
    },
    [],
  );

  function connect(): void {
    const socketUrl = url.trim();
    if (!/^wss?:\/\//i.test(socketUrl)) {
      setError('Enter a valid ws:// or wss:// URL.');
      return;
    }

    setError('');
    setState('connecting');
    try {
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;
      socket.onopen = () => {
        setState('connected');
        setError('');
      };
      socket.onmessage = (event) => {
        const payload = typeof event.data === 'string' ? event.data : String(event.data);
        const newMessage: WebhookMessage = {
          id: messageId.current + 1,
          receivedAt: Date.now(),
          payload,
        };
        messageId.current = newMessage.id;
        setMessages((currentMessages) => [newMessage, ...currentMessages].slice(0, 60));
      };
      socket.onerror = () => {
        setError('WebSocket connection error. Check the URL and server availability.');
      };
      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
          setState('disconnected');
        }
      };
    } catch (connectError: unknown) {
      socketRef.current = null;
      setState('disconnected');
      setError(`Could not connect: ${errorText(connectError)}`);
    }
  }

  function disconnect(): void {
    const socket = socketRef.current;
    socketRef.current = null;
    socket?.close();
    setState('disconnected');
  }

  return (
    <AppScreen>
      <ScreenHeading
        eyebrow="LIVE EVENT STREAM"
        title="Webhook viewer"
        subtitle="Connect to a WebSocket and inspect incoming payloads."
        accessory={
          <Badge
            color={state === 'connected' ? colors.accent : colors.muted}
            label={state.toUpperCase()}
          />
        }
      />

      <Surface>
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          editable={state === 'disconnected'}
          label="WebSocket URL"
          onChangeText={setUrl}
          placeholder="wss://your-webhook-stream.example.com"
          value={url}
        />
        <View style={styles.actionRow}>
          <View style={styles.flexAction}>
            <UiButton
              disabled={state !== 'disconnected'}
              label={state === 'connecting' ? 'Connecting...' : 'Connect'}
              onPress={connect}
              variant="primary"
            />
          </View>
          <UiButton
            disabled={state === 'disconnected'}
            label="Disconnect"
            onPress={disconnect}
            variant="secondary"
          />
        </View>
        <View style={styles.streamControls}>
          <Text style={[styles.helperText, { color: colors.muted }]}>
            Showing the latest {messages.length} messages (up to 60).
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setMessages([])}>
            <Text style={[styles.clearText, { color: colors.accent }]}>Clear</Text>
          </Pressable>
        </View>
      </Surface>

      {error ? (
        <Surface style={styles.errorCard}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </Surface>
      ) : null}

      {messages.length === 0 ? (
        <EmptyState
          body="When the connection receives a frame, its timestamp and payload will appear here."
          title="Listening for events"
        />
      ) : (
        messages.map((message, index) => (
          <Surface key={message.id} style={styles.messageCard}>
            <View style={styles.messageHeading}>
              <Badge label={`EVENT ${messages.length - index}`} />
              <Text style={[styles.timestamp, { color: colors.muted }]}>
                {new Date(message.receivedAt).toLocaleTimeString()}
              </Text>
            </View>
            <Text selectable style={[styles.payload, { color: colors.text }]}>
              {formatPayload(message.payload)}
            </Text>
          </Surface>
        ))
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flexAction: {
    flex: 1,
  },
  streamControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  helperText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorCard: {
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
  messageCard: {
    gap: 12,
  },
  messageHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  payload: {
    fontSize: 12,
    lineHeight: 19,
    fontFamily: 'monospace',
  },
});
