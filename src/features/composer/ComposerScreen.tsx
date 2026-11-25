import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { executeRequest } from '@/core/http/client';
import { interpolateEnv, parseCurl, toCurl } from '@/core/http/curl';
import {
  deleteEnvVariable,
  getHistoryRecord,
  listEnvVariables,
  recordRequestExecution,
  saveEnvVariable,
  setHistorySaved,
  type EnvVariableRecord,
} from '@/core/storage/apiStorage';
import type { ApiRequest, ApiResponse, HttpMethod } from '@/core/types';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function parseLines(value: string, separator: '=' | ':'): [string, string][] {
  return value
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => line.length > 0)
    .map(({ line, index }) => {
      const separatorIndex = line.indexOf(separator);
      if (separatorIndex <= 0) {
        throw new Error(`Line ${index + 1} must contain a name${separator}value pair.`);
      }
      return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
    });
}

function appendQuery(url: string, params: [string, string][]): string {
  if (params.length === 0) {
    return url;
  }
  const query = params
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
  const separator = url.includes('?') ? (/[?&]$/.test(url) ? '' : '&') : '?';
  return `${url}${separator}${query}`;
}

function formatBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body) as unknown, null, 2);
  } catch {
    return body || '(empty response body)';
  }
}

export default function ComposerScreen() {
  const params = useLocalSearchParams<{ historyId?: string }>();
  const colors = useInspectorTheme();
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [headersText, setHeadersText] = useState('');
  const [paramsText, setParamsText] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [envVariables, setEnvVariables] = useState<EnvVariableRecord[]>([]);
  const [envText, setEnvText] = useState('');
  const [showEnvironment, setShowEnvironment] = useState(false);
  const [curlModalVisible, setCurlModalVisible] = useState(false);
  const [curlText, setCurlText] = useState('');
  const [curlError, setCurlError] = useState('');

  useEffect(() => {
    let active = true;
    listEnvVariables()
      .then((variables) => {
        if (active) {
          setEnvVariables(variables);
          setEnvText(variables.map(({ name, value }) => `${name}=${value}`).join('\n'));
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(`Could not load environment variables: ${errorText(loadError)}`);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const historyRecordId = params.historyId;
    if (historyRecordId === undefined || historyRecordId.length === 0) {
      return;
    }

    let active = true;
    getHistoryRecord(historyRecordId)
      .then((record) => {
        if (!active) {
          return;
        }
        if (record === null) {
          setError('That history entry could not be found.');
          return;
        }
        setMethod(record.request.method);
        setUrl(record.request.url);
        setHeadersText(
          Object.entries(record.request.headers ?? {})
            .map(([name, value]) => `${name}: ${value}`)
            .join('\n'),
        );
        setParamsText('');
        setBody(record.request.body ?? '');
        setResponse(record.response);
        setResponseTab('body');
        setHistoryId(record.id);
        setIsSaved(record.isSaved);
        setError('');
        router.setParams({ historyId: undefined });
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(`Could not load the saved request: ${errorText(loadError)}`);
        }
      });

    return () => {
      active = false;
    };
  }, [params.historyId]);

  const responseBody = useMemo(
    () => (response === null ? '' : formatBody(response.body)),
    [response],
  );

  function buildRequest(): ApiRequest {
    const interpolatedUrl = interpolateEnv(url.trim(), envVariables);
    if (interpolatedUrl.length === 0) {
      throw new Error('Enter a request URL.');
    }

    const parsedHeaders = parseLines(headersText, ':').map(([name, value]) => [
      name,
      interpolateEnv(value, envVariables),
    ] as const);
    const parsedParams = parseLines(paramsText, '=').map(([name, value]) => [
      interpolateEnv(name, envVariables),
      interpolateEnv(value, envVariables),
    ] as [string, string]);
    const requestBody = interpolateEnv(body, envVariables);

    return {
      method,
      url: appendQuery(interpolatedUrl, parsedParams),
      headers: Object.fromEntries(parsedHeaders),
      ...(requestBody.length > 0 ? { body: requestBody } : {}),
    };
  }

  async function sendRequest(): Promise<void> {
    setError('');
    setIsLoading(true);
    setResponse(null);
    setHistoryId(null);
    setIsSaved(false);

    try {
      const request = buildRequest();
      const result = await executeRequest(request);
      setResponse(result);
      setResponseTab('body');
      try {
        const newHistoryId = await recordRequestExecution(request, result);
        setHistoryId(newHistoryId);
      } catch (saveError: unknown) {
        setError(`Response received, but history could not be saved: ${errorText(saveError)}`);
      }
    } catch (requestError: unknown) {
      setError(`Request failed: ${errorText(requestError)}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleSaved(): Promise<void> {
    if (historyId === null) {
      return;
    }
    const nextSavedState = !isSaved;
    try {
      await setHistorySaved(historyId, nextSavedState);
      setIsSaved(nextSavedState);
      setError('');
    } catch (saveError: unknown) {
      setError(`Could not update saved request: ${errorText(saveError)}`);
    }
  }

  async function saveEnvironment(): Promise<void> {
    try {
      const variables = parseLines(envText, '=');
      const names = new Set(variables.map(([name]) => name));
      for (const [name, value] of variables) {
        const existing = envVariables.find((variable) => variable.name === name);
        await saveEnvVariable({ name, value }, existing?.isSecret ?? false);
      }
      for (const variable of envVariables) {
        if (!names.has(variable.name)) {
          await deleteEnvVariable(variable.id);
        }
      }
      const updatedVariables = await listEnvVariables();
      setEnvVariables(updatedVariables);
      setEnvText(
        updatedVariables.map(({ name, value }) => `${name}=${value}`).join('\n'),
      );
      setError('');
    } catch (saveError: unknown) {
      setError(`Could not save environment variables: ${errorText(saveError)}`);
    }
  }

  function openCurlModal(): void {
    setCurlError('');
    try {
      setCurlText(toCurl(buildRequest()));
    } catch (exportError: unknown) {
      setCurlText('');
      setCurlError(errorText(exportError));
    }
    setCurlModalVisible(true);
  }

  function importCurl(): void {
    try {
      const request = parseCurl(curlText);
      setMethod(request.method);
      setUrl(request.url);
      setHeadersText(
        Object.entries(request.headers ?? {})
          .map(([name, value]) => `${name}: ${value}`)
          .join('\n'),
      );
      setParamsText('');
      setBody(request.body ?? '');
      setResponse(null);
      setHistoryId(null);
      setIsSaved(false);
      setCurlModalVisible(false);
      setError('');
    } catch (importError: unknown) {
      setCurlError(errorText(importError));
    }
  }

  return (
    <AppScreen>
      <ScreenHeading
        eyebrow="API WORKBENCH"
        title="Request composer"
        subtitle="Build, send, and inspect HTTP requests."
        accessory={<Badge label="LOCAL HISTORY" />}
      />

      <Surface>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Request</Text>
          <Pressable accessibilityRole="button" onPress={openCurlModal}>
            <Text style={[styles.link, { color: colors.accent }]}>cURL import / export</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.methodList}>
          {METHODS.map((item) => {
            const selected = method === item;
            return (
              <Pressable
                accessibilityRole="button"
                key={item}
                onPress={() => setMethod(item)}
                style={[
                  styles.methodChip,
                  {
                    backgroundColor: selected ? colors.accentSurface : colors.elevated,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}>
                <Text
                  style={[
                    styles.methodText,
                    { color: selected ? colors.accent : colors.muted },
                  ]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Field
          autoCapitalize="none"
          autoCorrect={false}
          label="Request URL"
          keyboardType="url"
          onChangeText={setUrl}
          placeholder="https://api.example.com/v1/resource"
          value={url}
        />
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          label="Headers"
          hint="One Name: value per line"
          multiline
          onChangeText={setHeadersText}
          placeholder={'Accept: application/json\nAuthorization: Bearer {{token}}'}
          style={styles.multilineInput}
          value={headersText}
        />
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          label="Query parameters"
          hint="One key=value per line"
          multiline
          onChangeText={setParamsText}
          placeholder={'page=1\nlimit=20'}
          style={styles.multilineInput}
          value={paramsText}
        />
        {method !== 'GET' && method !== 'HEAD' ? (
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            label="Request body"
            hint="JSON or raw text"
            multiline
            onChangeText={setBody}
            placeholder={'{\n  "message": "Hello, API"\n}'}
            style={[styles.multilineInput, styles.bodyInput]}
            value={body}
          />
        ) : null}

        <View style={styles.actionRow}>
          <View style={styles.flexAction}>
            <UiButton
              disabled={isLoading}
              label={isLoading ? 'Sending...' : 'Send request'}
              onPress={() => void sendRequest()}
              variant="primary"
            />
          </View>
          <UiButton
            compact
            disabled={historyId === null || isLoading}
            label={isSaved ? 'Saved' : 'Save'}
            onPress={() => void toggleSaved()}
            variant="secondary"
          />
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : null}
      </Surface>

      <Surface>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowEnvironment((visible) => !visible)}
          style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Environment</Text>
            <Text style={[styles.helperText, { color: colors.muted }]}>
              {envVariables.length} variables available for {'{{name}}'} substitution
            </Text>
          </View>
          <Text style={[styles.link, { color: colors.accent }]}>
            {showEnvironment ? 'Hide' : 'Edit'}
          </Text>
        </Pressable>
        {showEnvironment ? (
          <>
            <Field
              autoCapitalize="none"
              autoCorrect={false}
              label="Variables"
              hint="One NAME=value per line"
              multiline
              onChangeText={setEnvText}
              placeholder={'baseUrl=https://api.example.com\ntoken=your-token'}
              style={styles.multilineInput}
              value={envText}
            />
            <UiButton label="Save environment" onPress={() => void saveEnvironment()} />
          </>
        ) : null}
      </Surface>

      {error ? (
        <Surface style={styles.errorCard}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </Surface>
      ) : null}

      {response ? (
        <Surface>
          <View style={styles.responseHeading}>
            <View style={styles.responseSummary}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Response</Text>
              <Badge
                color={response.ok ? colors.accent : colors.danger}
                label={`${response.status} ${response.statusText}`.trim()}
              />
            </View>
            <Text style={[styles.metrics, { color: colors.muted }]}>
              {response.durationMs.toFixed(0)} ms  /  {(response.sizeBytes / 1024).toFixed(2)} KB
            </Text>
          </View>

          <View style={styles.responseTabs}>
            {(['body', 'headers'] as const).map((tab) => {
              const selected = responseTab === tab;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={tab}
                  onPress={() => setResponseTab(tab)}
                  style={[
                    styles.responseTab,
                    selected && { borderBottomColor: colors.accent },
                  ]}>
                  <Text
                    style={[
                      styles.responseTabText,
                      { color: selected ? colors.accent : colors.muted },
                    ]}>
                    {tab === 'body' ? 'Body' : `Headers (${Object.keys(response.headers).length})`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {responseTab === 'body' ? (
            <Text selectable style={[styles.code, { color: colors.text }]}>
              {responseBody}
            </Text>
          ) : (
            <View style={styles.headerList}>
              {Object.entries(response.headers).length === 0 ? (
                <Text style={[styles.helperText, { color: colors.muted }]}>
                  No response headers.
                </Text>
              ) : (
                Object.entries(response.headers).map(([name, value]) => (
                  <View key={name} style={styles.headerItem}>
                    <Text style={[styles.headerName, { color: colors.accent }]}>{name}</Text>
                    <Text selectable style={[styles.headerValue, { color: colors.text }]}>
                      {value}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </Surface>
      ) : (
        <EmptyState
          body="Your status, response body, headers, timing, and payload size will appear here."
          title="Ready when you are"
        />
      )}

      <Modal
        animationType="slide"
        onRequestClose={() => setCurlModalVisible(false)}
        transparent
        visible={curlModalVisible}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalBackdrop, { backgroundColor: colors.background + 'D9' }]}>
          <Surface style={styles.modalCard}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>cURL</Text>
              <Pressable onPress={() => setCurlModalVisible(false)}>
                <Text style={[styles.link, { color: colors.accent }]}>Close</Text>
              </Pressable>
            </View>
            <Text style={[styles.helperText, { color: colors.muted }]}>
              Paste a cURL command to import it, or copy the generated command below.
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              onChangeText={setCurlText}
              placeholder="curl --request GET https://api.example.com"
              placeholderTextColor={colors.muted}
              style={[
                styles.curlInput,
                {
                  backgroundColor: colors.elevated,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={curlText}
            />
            {curlError ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{curlError}</Text>
            ) : null}
            <View style={styles.actionRow}>
              <View style={styles.flexAction}>
                <UiButton label="Import command" onPress={importCurl} variant="primary" />
              </View>
              <UiButton
                compact
                label="Export current"
                onPress={() => {
                  try {
                    setCurlText(toCurl(buildRequest()));
                    setCurlError('');
                  } catch (exportError: unknown) {
                    setCurlError(errorText(exportError));
                  }
                }}
              />
            </View>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
  },
  methodList: {
    gap: 8,
    paddingVertical: 2,
  },
  methodChip: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  bodyInput: {
    minHeight: 140,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flexAction: {
    flex: 1,
  },
  loader: {
    paddingVertical: 4,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  responseHeading: {
    gap: 7,
  },
  responseSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  metrics: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  responseTabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#56617455',
  },
  responseTab: {
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  responseTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 19,
  },
  headerList: {
    gap: 12,
  },
  headerItem: {
    gap: 4,
  },
  headerName: {
    fontSize: 11,
    fontWeight: '800',
  },
  headerValue: {
    fontSize: 12,
    lineHeight: 17,
  },
  errorCard: {
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
  },
  modalBackdrop: {
    flex: 1,
    padding: 18,
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  curlInput: {
    minHeight: 180,
    maxHeight: 340,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
  },
});
