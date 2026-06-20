-- SOC Dashboard Database Schema

-- Logs Table
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    raw_data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL,
    source VARCHAR(255) NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'open',
    assigned_to VARCHAR(255),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);

-- Incidents Table
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL,
    incident_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'open',
    assigned_to VARCHAR(255),
    notes TEXT,
    resolution TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    resolved_at DATETIME
);

-- Incident-Alert Correlation Table
CREATE TABLE IF NOT EXISTS incident_alert_correlation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL,
    alert_id INTEGER NOT NULL,
    correlation_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES incidents(id),
    FOREIGN KEY (alert_id) REFERENCES alerts(id)
);

-- Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER,
    incident_id INTEGER,
    feedback_type VARCHAR(100) NOT NULL,
    rating INTEGER CHECK(rating >= 1 AND rating <= 5),
    comments TEXT NOT NULL,
    analyst_name VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(id),
    FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

-- Timeline Events Table
CREATE TABLE IF NOT EXISTS timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type VARCHAR(100) NOT NULL,
    event_data TEXT NOT NULL,
    incident_id INTEGER,
    alert_id INTEGER,
    log_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES incidents(id),
    FOREIGN KEY (alert_id) REFERENCES alerts(id),
    FOREIGN KEY (log_id) REFERENCES logs(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_severity ON logs(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline_events(timestamp);

-- ── AI Investigation Center (added in v5) ────────────────────────────────────

-- Persisted investigation sessions (optional — currently in-memory; use this for DB persistence)
CREATE TABLE IF NOT EXISTS ai_investigations (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT     NOT NULL UNIQUE,
    filename      TEXT     NOT NULL,
    event_count   INTEGER  DEFAULT 0,
    attack_types  TEXT,                    -- JSON array string
    source_ips    TEXT,                    -- JSON array string
    target_ips    TEXT,                    -- JSON array string
    severity      TEXT     DEFAULT 'low',
    timeline      TEXT,
    ai_analysis   TEXT,
    attack_story  TEXT,
    mitre_mapping TEXT,                    -- JSON array string
    model_used    TEXT     DEFAULT 'llama3',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by    TEXT
);

-- Chat messages per investigation session
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT     NOT NULL,
    role          TEXT     NOT NULL CHECK(role IN ('user','assistant')),
    content       TEXT     NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES ai_investigations(session_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_investigations_session ON ai_investigations(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_session           ON ai_chat_messages(session_id);
