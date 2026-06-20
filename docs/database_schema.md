# Database Schema Documentation

## Overview
The SOC Dashboard uses SQLite as its database, with the following tables:

## Tables

### logs
Stores all security log entries

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique identifier |
| source | VARCHAR(255) | Source of the log |
| severity | VARCHAR(50) | Severity level (info, warning, error, critical) |
| message | TEXT | Log message |
| raw_data | TEXT | Raw log data (optional) |
| timestamp | DATETIME | When the log was created |
| created_at | DATETIME | Record creation timestamp |

**Indexes:**
- `idx_logs_timestamp` on `timestamp`
- `idx_logs_severity` on `severity`

### alerts
Stores security alerts generated from logs

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique identifier |
| title | VARCHAR(500) | Alert title |
| description | TEXT | Detailed description |
| severity | VARCHAR(50) | Severity level (low, medium, high, critical) |
| source | VARCHAR(255) | Alert source |
| alert_type | VARCHAR(100) | Type of alert |
| status | VARCHAR(50) | Current status (default: 'open') |
| assigned_to | VARCHAR(255) | Analyst assigned (optional) |
| notes | TEXT | Analysis notes (optional) |
| created_at | DATETIME | When alert was created |
| updated_at | DATETIME | Last update timestamp |

**Indexes:**
- `idx_alerts_status` on `status`
- `idx_alerts_severity` on `severity`

### incidents
Stores security incidents (escalated from alerts)

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique identifier |
| title | VARCHAR(500) | Incident title |
| description | TEXT | Detailed description |
| severity | VARCHAR(50) | Severity level |
| incident_type | VARCHAR(100) | Type of incident |
| status | VARCHAR(50) | Current status (default: 'open') |
| assigned_to | VARCHAR(255) | Analyst assigned (optional) |
| notes | TEXT | Investigation notes (optional) |
| resolution | TEXT | Resolution details (optional) |
| created_at | DATETIME | When incident was created |
| updated_at | DATETIME | Last update timestamp |
| resolved_at | DATETIME | When incident was resolved |

**Indexes:**
- `idx_incidents_status` on `status`

### incident_alert_correlation
Maps relationships between incidents and alerts

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique identifier |
| incident_id | INTEGER | Foreign key to incidents |
| alert_id | INTEGER | Foreign key to alerts |
| correlation_score | REAL | Correlation confidence score |
| created_at | DATETIME | When correlation was created |

### feedback
Stores analyst feedback on alerts and incidents

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique identifier |
| alert_id | INTEGER | Related alert (optional) |
| incident_id | INTEGER | Related incident (optional) |
| feedback_type | VARCHAR(100) | Type (false_positive, true_positive, improvement) |
| rating | INTEGER | Rating 1-5 (optional) |
| comments | TEXT | Feedback comments |
| analyst_name | VARCHAR(255) | Analyst name (optional) |
| created_at | DATETIME | When feedback was submitted |

### timeline_events
Stores chronological events for timeline visualization

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Unique identifier |
| event_type | VARCHAR(100) | Type of event |
| event_data | TEXT | Event data (JSON) |
| incident_id | INTEGER | Related incident (optional) |
| alert_id | INTEGER | Related alert (optional) |
| log_id | INTEGER | Related log (optional) |
| timestamp | DATETIME | When event occurred |

**Indexes:**
- `idx_timeline_timestamp` on `timestamp`

## Relationships

```
logs (1) ─────< (many) alerts
alerts (many) >─────< (many) incidents (via incident_alert_correlation)
alerts (1) ─────< (many) feedback
incidents (1) ─────< (many) feedback
logs (1) ─────< (many) timeline_events
alerts (1) ─────< (many) timeline_events
incidents (1) ─────< (many) timeline_events
```

## Data Integrity

### Constraints
- All foreign keys are properly defined
- Rating values in feedback must be between 1 and 5
- Timestamps default to CURRENT_TIMESTAMP

### Encryption
- Sensitive data fields can be encrypted using the encryption service
- Encrypted fields are stored as base64-encoded strings

### Integrity Checking
- Database file hashes are stored for integrity verification
- Hash verification is performed on startup (if enabled in config)
