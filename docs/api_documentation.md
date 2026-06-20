# API Documentation

## Base URL
```
http://localhost:8000/api
```

## Authentication
Currently, no authentication is required. Authentication will be added in future versions.

## Endpoints

### Logs

#### GET /logs/
Get all logs with optional filters

**Query Parameters:**
- `skip` (integer): Number of records to skip (default: 0)
- `limit` (integer): Maximum number of records to return (default: 50, max: 1000)
- `severity` (string): Filter by severity level
- `source` (string): Filter by source
- `start_time` (datetime): Filter by start time
- `end_time` (datetime): Filter by end time

**Response:**
```json
[
  {
    "id": 1,
    "source": "firewall",
    "severity": "warning",
    "message": "Suspicious traffic detected",
    "raw_data": "192.168.1.100 -> 10.0.0.1",
    "timestamp": "2026-02-11T10:30:00"
  }
]
```

#### GET /logs/{log_id}
Get a specific log by ID

#### POST /logs/
Create a new log entry

#### GET /logs/stats/summary
Get log statistics

### Alerts

#### GET /alerts/
Get all alerts with optional filters

**Query Parameters:**
- `skip`, `limit`: Pagination
- `severity`: Filter by severity
- `status`: Filter by status

#### GET /alerts/{alert_id}
Get a specific alert

#### POST /alerts/
Create a new alert

#### PATCH /alerts/{alert_id}
Update an alert

#### GET /alerts/critical/active
Get all active critical alerts

#### GET /alerts/stats/summary
Get alert statistics

### Incidents

#### GET /incidents/
Get all incidents with optional filters

#### GET /incidents/{incident_id}
Get a specific incident

#### POST /incidents/
Create a new incident

#### PATCH /incidents/{incident_id}
Update an incident

#### POST /incidents/{incident_id}/correlate
Correlate incident with related alerts and logs

#### GET /incidents/stats/summary
Get incident statistics

### Timeline

#### GET /timeline/
Get timeline events with optional filters

**Query Parameters:**
- `start_time`: Start time filter
- `end_time`: End time filter
- `incident_id`: Filter by incident
- `event_types`: Comma-separated list of event types

#### GET /timeline/incident/{incident_id}
Get timeline for a specific incident

#### GET /timeline/export
Export timeline events

**Query Parameters:**
- `start_time`: Required
- `end_time`: Required
- `format`: Export format (json, csv)

### Feedback

#### GET /feedback/
Get all feedback entries

#### GET /feedback/{feedback_id}
Get a specific feedback entry

#### POST /feedback/
Submit new feedback

#### GET /feedback/alert/{alert_id}
Get feedback for a specific alert

#### GET /feedback/stats/summary
Get feedback statistics

## Error Responses

All endpoints return standard HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

Error response format:
```json
{
  "detail": "Error message description"
}
```
