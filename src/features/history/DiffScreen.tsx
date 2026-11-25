import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppScreen,
  Badge,
  EmptyState,
  ScreenHeading,
  Surface,
  UiButton,
} from '@/components/inspector-ui';
import { useInspectorTheme } from '@/constants/inspector-theme';
import { diffJson } from '@/core/diff/jsonDiff';
import { listHistory, type HistoryRecord } from '@/core/storage/apiStorage';
import type { JsonDiffEntry } from '@/core/types';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function prettyValue(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? 'undefined';
}

export default function DiffScreen() {
  const colors = useInspectorTheme();
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [entries, setEntries] = useState<JsonDiffEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listHistory({ savedOnly: true })
        .then((savedRecords) => {
          if (active) {
            setRecords(savedRecords);
            setLoading(false);
          }
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(`Could not load saved responses: ${errorText(loadError)}`);
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, []),
  );

  function toggleSelection(id: string): void {
    setEntries(null);
    setError('');
    if (leftId === id) {
      setLeftId(rightId);
      setRightId(null);
      return;
    }
    if (rightId === id) {
      setRightId(null);
      return;
    }
    if (leftId === null) {
      setLeftId(id);
    } else {
      setRightId(id);
    }
  }

  function compareResponses(): void {
    const leftRecord = records.find(({ id }) => id === leftId);
    const rightRecord = records.find(({ id }) => id === rightId);
    if (leftRecord === undefined || rightRecord === undefined) {
      setError('Choose two saved responses to compare.');
      return;
    }

    try {
      const leftJson: unknown = JSON.parse(leftRecord.response.body);
      const rightJson: unknown = JSON.parse(rightRecord.response.body);
      setEntries(diffJson(leftJson, rightJson));
      setError('');
    } catch (parseError: unknown) {
      setEntries(null);
      setError(`Both saved responses must contain valid JSON: ${errorText(parseError)}`);
    }
  }

  return (
    <AppScreen>
      <ScreenHeading
        eyebrow="STRUCTURAL COMPARE"
        title="Response diff"
        subtitle="Select two saved JSON responses to see what changed."
        accessory={<Badge label={`${records.length} SAVED`} />}
      />

      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? (
        <Surface style={styles.errorCard}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </Surface>
      ) : null}

      {records.length < 2 && !loading ? (
        <EmptyState
          body="Save at least two request responses from History before comparing."
          title="Not enough saved responses"
        />
      ) : null}

      {records.map((record) => {
        const selectedAs = leftId === record.id ? 'A' : rightId === record.id ? 'B' : null;
        return (
          <Pressable
            accessibilityRole="button"
            key={record.id}
            onPress={() => toggleSelection(record.id)}>
            <Surface
              style={[
                styles.selectCard,
                selectedAs !== null && {
                  borderColor: colors.accent,
                  backgroundColor: colors.accentSurface,
                },
              ]}>
              <View style={styles.recordLine}>
                <Badge label={selectedAs === null ? record.request.method : `RESPONSE ${selectedAs}`} />
                <Text style={[styles.date, { color: colors.muted }]}>
                  {new Date(record.createdAt).toLocaleString()}
                </Text>
              </View>
              <Text numberOfLines={2} style={[styles.url, { color: colors.text }]}>
                {record.request.url}
              </Text>
              <Text style={[styles.status, { color: record.response.ok ? colors.accent : colors.danger }]}>
                {record.response.status} {record.response.statusText}
              </Text>
            </Surface>
          </Pressable>
        );
      })}

      {records.length >= 2 ? (
        <UiButton
          disabled={leftId === null || rightId === null}
          label="Compare responses"
          onPress={compareResponses}
          variant="primary"
        />
      ) : null}

      {entries !== null ? (
        <Surface>
          <View style={styles.resultsHeading}>
            <Text style={[styles.resultsTitle, { color: colors.text }]}>Changes</Text>
            <Badge label={`${entries.length} ${entries.length === 1 ? 'CHANGE' : 'CHANGES'}`} />
          </View>
          {entries.length === 0 ? (
            <Text style={[styles.noChanges, { color: colors.muted }]}>
              These responses are structurally identical.
            </Text>
          ) : (
            entries.map((entry, index) => {
              const entryColor =
                entry.type === 'added'
                  ? colors.accent
                  : entry.type === 'removed'
                    ? colors.danger
                    : colors.warning;
              return (
                <View
                  key={`${entry.path}-${entry.type}-${index}`}
                  style={[styles.changeItem, { borderLeftColor: entryColor }]}>
                  <View style={styles.changeHeading}>
                    <Badge color={entryColor} label={entry.type.toUpperCase()} />
                    <Text selectable style={[styles.path, { color: colors.text }]}>
                      {entry.path}
                    </Text>
                  </View>
                  {entry.type !== 'added' ? (
                    <Text selectable style={[styles.value, { color: colors.muted }]}>
                      - {prettyValue(entry.left)}
                    </Text>
                  ) : null}
                  {entry.type !== 'removed' ? (
                    <Text selectable style={[styles.value, { color: entryColor }]}>
                      + {prettyValue(entry.right)}
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </Surface>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  errorCard: {
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
  selectCard: {
    gap: 9,
  },
  recordLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  date: {
    fontSize: 11,
  },
  url: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  status: {
    fontSize: 11,
    fontWeight: '700',
  },
  resultsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  resultsTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  noChanges: {
    fontSize: 13,
    lineHeight: 19,
  },
  changeItem: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    gap: 7,
  },
  changeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  path: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
});
