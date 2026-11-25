CREATE TABLE IF NOT EXISTS history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  request_headers JSONB NOT NULL DEFAULT '{}'::JSONB,
  request_body TEXT,
  status_code INT NOT NULL,
  status_text TEXT NOT NULL DEFAULT '',
  duration_ms INT NOT NULL CHECK (duration_ms >= 0),
  size_bytes INT NOT NULL CHECK (size_bytes >= 0),
  response_headers JSONB NOT NULL DEFAULT '{}'::JSONB,
  response_body TEXT NOT NULL DEFAULT '',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}'::JSONB,
  query_params JSONB NOT NULL DEFAULT '{}'::JSONB,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  history_id UUID UNIQUE REFERENCES history(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS env_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_requests_collection_id_idx
  ON saved_requests(collection_id);
CREATE INDEX IF NOT EXISTS history_executed_at_idx
  ON history(executed_at DESC);
