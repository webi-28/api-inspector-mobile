import type { ApiRequest, EnvVariable, HttpMethod } from '../types';

const HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: "'" | '"' | undefined;
  let tokenStarted = false;

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];

    if (quote === "'") {
      if (character === "'") {
        quote = undefined;
      } else {
        token += character;
      }
      continue;
    }

    if (character === '\\') {
      const nextCharacter = command[index + 1];
      if (nextCharacter === undefined) {
        throw new Error('Invalid cURL command: trailing escape character.');
      }
      if (nextCharacter === '\n') {
        index += 1;
        continue;
      }
      if (nextCharacter === '\r' && command[index + 2] === '\n') {
        index += 2;
        continue;
      }
      token += nextCharacter;
      tokenStarted = true;
      index += 1;
      continue;
    }

    if (quote === '"') {
      if (character === '"') {
        quote = undefined;
      } else {
        token += character;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      tokenStarted = true;
    } else if (/\s/.test(character)) {
      if (tokenStarted) {
        tokens.push(token);
        token = '';
        tokenStarted = false;
      }
    } else {
      token += character;
      tokenStarted = true;
    }
  }

  if (quote !== undefined) {
    throw new Error('Invalid cURL command: unmatched quote.');
  }
  if (tokenStarted) {
    tokens.push(token);
  }

  return tokens;
}

function parseMethod(value: string): HttpMethod {
  const method = value.toUpperCase();
  if (!HTTP_METHODS.has(method as HttpMethod)) {
    throw new Error(`Unsupported HTTP method: ${value}`);
  }
  return method as HttpMethod;
}

function setHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
): void {
  const existingName = Object.keys(headers).find(
    (headerName) => headerName.toLowerCase() === name.toLowerCase(),
  );
  headers[existingName ?? name] = value;
}

function appendQuery(url: string, query: string): string {
  if (query.length === 0) {
    return url;
  }
  const separator = url.includes('?') ? (/[?&]$/.test(url) ? '' : '&') : '?';
  return `${url}${separator}${query}`;
}

export function parseCurl(command: string): ApiRequest {
  const tokens = tokenize(command.trim());
  if (tokens.length === 0) {
    throw new Error('Invalid cURL command: command is empty.');
  }

  let method: HttpMethod | undefined;
  let url: string | undefined;
  let getData = false;
  const headers: Record<string, string> = {};
  const bodyParts: string[] = [];

  const readOptionValue = (option: string, index: number): [string, number] => {
    const value = tokens[index + 1];
    if (value === undefined) {
      throw new Error(`Invalid cURL command: ${option} requires a value.`);
    }
    return [value, index + 1];
  };

  for (let index = tokens[0].toLowerCase().startsWith('curl') ? 1 : 0;
    index < tokens.length;
    index += 1
  ) {
    const token = tokens[index];
    let value: string;

    if (token === '--') {
      if (index + 1 < tokens.length) {
        url = tokens[index + 1];
      }
      break;
    }

    if (token === '-X' || token === '--request') {
      [value, index] = readOptionValue(token, index);
      method = parseMethod(value);
    } else if (token.startsWith('--request=')) {
      method = parseMethod(token.slice('--request='.length));
    } else if (token.startsWith('-X') && token.length > 2) {
      method = parseMethod(token.slice(2));
    } else if (token === '-H' || token === '--header') {
      [value, index] = readOptionValue(token, index);
      const separator = value.indexOf(':');
      if (separator <= 0) {
        throw new Error(`Invalid cURL header: ${value}`);
      }
      setHeader(headers, value.slice(0, separator).trim(), value.slice(separator + 1).trim());
    } else if (token.startsWith('--header=')) {
      value = token.slice('--header='.length);
      const separator = value.indexOf(':');
      if (separator <= 0) {
        throw new Error(`Invalid cURL header: ${value}`);
      }
      setHeader(headers, value.slice(0, separator).trim(), value.slice(separator + 1).trim());
    } else if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary' ||
      token === '--data-urlencode'
    ) {
      [value, index] = readOptionValue(token, index);
      bodyParts.push(value);
    } else if (token.startsWith('--data=')) {
      bodyParts.push(token.slice('--data='.length));
    } else if (token.startsWith('--data-raw=')) {
      bodyParts.push(token.slice('--data-raw='.length));
    } else if (token === '--url') {
      [url, index] = readOptionValue(token, index);
    } else if (token.startsWith('--url=')) {
      url = token.slice('--url='.length);
    } else if (token === '-G' || token === '--get') {
      getData = true;
    } else if (token === '-I' || token === '--head') {
      method = 'HEAD';
    } else if (token === '-A' || token === '--user-agent') {
      [value, index] = readOptionValue(token, index);
      setHeader(headers, 'User-Agent', value);
    } else if (token === '-b' || token === '--cookie') {
      [value, index] = readOptionValue(token, index);
      setHeader(headers, 'Cookie', value);
    } else if (
      token === '--compressed' ||
      token === '--insecure' ||
      token === '--location' ||
      token === '--silent' ||
      token === '--show-error' ||
      token === '--fail' ||
      token === '--fail-with-body' ||
      token === '-k' ||
      token === '-L' ||
      token === '-s' ||
      token === '-S'
    ) {
      continue;
    } else if (token.startsWith('-')) {
      throw new Error(`Unsupported cURL option: ${token}`);
    } else if (url === undefined) {
      url = token;
    } else {
      throw new Error(`Unexpected cURL argument: ${token}`);
    }
  }

  if (url === undefined || url.length === 0) {
    throw new Error('Invalid cURL command: URL is missing.');
  }

  const body = bodyParts.length > 0 ? bodyParts.join('&') : undefined;
  if (getData && body !== undefined) {
    url = appendQuery(url, body);
  }

  return {
    method: method ?? (body !== undefined && !getData ? 'POST' : 'GET'),
    url,
    headers,
    ...(body !== undefined && !getData ? { body } : {}),
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function toCurl(request: ApiRequest): string {
  const parts = [
    'curl',
    '--request',
    shellQuote(request.method),
    shellQuote(request.url),
  ];

  for (const [name, value] of Object.entries(request.headers ?? {})) {
    parts.push('--header', shellQuote(`${name}: ${value}`));
  }

  if (request.body !== undefined) {
    parts.push('--data-raw', shellQuote(request.body));
  }

  return parts.join(' ');
}

export function interpolateEnv(text: string, vars: EnvVariable[]): string {
  const values = new Map(vars.map(({ name, value }) => [name, value]));
  return text.replace(/\{\{([^{}]+)\}\}/g, (match, variableName: string) => {
    const value = values.get(variableName.trim());
    return value === undefined ? match : value;
  });
}
