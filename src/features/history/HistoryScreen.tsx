import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
import {
  deleteHistoryRecord,
  listHistory,
  setHistorySaved,
  type HistoryRecord,
} from '@/core/storage/apiStorage';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

export default function HistoryScreen() {
  const colors = useInspectorTheme();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [search, setSearch] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextRecords = await listHistory({ search, savedOnly });
      setRecords(nextRecords);
      setError('');
    } catch (loadError: unknown) {
      setError(`Could not load request history: ${errorText(loadError)}`);
    } finally {
      setLoading(false);
    }
  }, [savedOnly, search]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      listHistory({ search, savedOnly })
        .then((nextRecords) => {
          if (active) {
            setRecords(nextRecords);
            setError('');
          }
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(`Could not load request history: ${errorText(loadError)}`);
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [savedOnly, search]),
  );

  async function toggleSaved(record: HistoryRecord): Promise<void> {
    try {
      await setHistorySaved(record.id, !record.isSaved);
      await refresh();
    } catch (saveError: unknown) {
      setError(`Could not update saved request: ${errorText(saveError)}`);
    }
  }

  async function removeRecord(id: string): Promise<void> {
    try {
      await deleteHistoryRecord(id);
      await refresh();
    } catch (deleteError: unknown) {
      setError(`Could not delete history entry: ${errorText(deleteError)}`);
    }
  }

  return (
    <AppScreen>
      <ScreenHeading
        eyebrow="REQUEST ARCHIVE"
        title="History"
        subtitle="Find previous runs and reopen them in the composer."
        accessory={<Badge label={`${records.length} RUNS`} />}
      />

      <Field
        autoCapitalize="none"
        autoCorrect={false}
        label="Search requests"
        onChangeText={setSearch}
        placeholder="Search URL, headers, or response..."
        value={search}
      />

      <View style={styles.filterRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSavedOnly((onlySaved) => !onlySaved)}
          style={[
            styles.filterChip,
            {
              backgroundColor: savedOnly ? colors.accentSurface : colors.surface,
              borderColor: savedOnly ? colors.accent : colors.border,
            },
          ]}>
          <Text style={[styles.filterText, { color: savedOnly ? colors.accent : colors.muted }]}>
            {savedOnly ? 'Saved only' : 'All requests'}
          </Text>
        </Pressable>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {error ? (
        <Surface style={styles.errorCard}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </Surface>
      ) : null}

      {!loading && records.length === 0 ? (
        <EmptyState
          body={
            savedOnly
              ? 'Save a request from the composer to keep it here.'
              : 'Run a request in the composer and it will be recorded here automatically.'
          }
          title={savedOnly ? 'No saved requests yet' : 'Your history is empty'}
        />
      ) : null}

      {records.map((record) => (
        <Surface key={record.id} style={styles.recordCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.navigate({
                pathname: '/',
                params: { historyId: String(record.id) },
              })
            }
            style={styles.recordMain}>
            <View style={styles.recordTopline}>
              <Badge label={record.request.method} />
              <Text style={[styles.date, { color: colors.muted }]}>
                {new Date(record.createdAt).toLocaleString()}
              </Text>
            </View>
            <Text
              numberOfLines={2}
              selectable
              style={[styles.url, { color: colors.text }]}>
              {record.request.url}
            </Text>
            <View style={styles.recordMetrics}>
              <Text
                style={[
                  styles.metric,
                  { color: record.response.ok ? colors.accent : colors.danger },
                ]}>
                {record.response.status} {record.response.statusText}
              </Text>
              <Text style={[styles.metric, { color: colors.muted }]}>
                {record.response.durationMs.toFixed(0)} ms
              </Text>
              <Text style={[styles.metric, { color: colors.muted }]}>
                {(record.response.sizeBytes / 1024).toFixed(2)} KB
              </Text>
            </View>
          </Pressable>
          <View style={styles.recordActions}>
            <UiButton
              compact
              label={record.isSaved ? 'Saved' : 'Save'}
              onPress={() => void toggleSaved(record)}
              variant="quiet"
            />
            <UiButton
              compact
              label="Remove"
              onPress={() => void removeRecord(record.id)}
              variant="danger"
            />
          </View>
        </Surface>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  filterText: {
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
  recordCard: {
    gap: 12,
  },
  recordMain: {
    gap: 10,
  },
  recordTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  date: {
    fontSize: 11,
  },
  url: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  recordMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metric: {
    fontSize: 11,
    fontWeight: '600',
  },
  recordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
