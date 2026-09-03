import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL ?? 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token to every request
apiClient.interceptors.request.use(cfg => {
  const token = localStorage.getItem('soc_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

apiClient.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      // Token expired or invalid — clear session and redirect to login
      localStorage.removeItem('soc_token');
      localStorage.removeItem('soc_user');
      window.location.href = '/login';
    }
    if (err.response?.status === 429) {
      console.warn('Rate limit hit — slow down requests');
    }
    return Promise.reject(err);
  }
);

export const api = {
  // Auth
  login:   (d) => apiClient.post('/api/auth/login', d),
  // /me now uses Authorization header automatically via interceptor above
  getMe:   ()  => apiClient.get('/api/auth/me'),

  // Logs
  getLogs:       (p={}) => apiClient.get('/api/logs', { params: p }),
  getLogById:    (id)   => apiClient.get(`/api/logs/${id}`),
  createLog:     (d)    => apiClient.post('/api/logs', d),
  getLogStats:   ()     => apiClient.get('/api/logs/stats/summary'),
  refreshLogs:   ()     => apiClient.post('/api/logs/refresh'),

  // Alerts
  getAlerts:        (p={}) => apiClient.get('/api/alerts', { params: p }),
  getAlertById:     (id)   => apiClient.get(`/api/alerts/${id}`),
  createAlert:      (d)    => apiClient.post('/api/alerts', d),
  updateAlert:      (id,d) => apiClient.patch(`/api/alerts/${id}`, d),
  escalateAlert:    (id)   => apiClient.post(`/api/alerts/${id}/escalate`),
  getCriticalAlerts:()     => apiClient.get('/api/alerts/critical/active'),
  getAlertStats:    ()     => apiClient.get('/api/alerts/stats/summary'),
  exportAlertsCsv:  ()     => apiClient.get('/api/alerts/export/csv', { responseType: 'blob' }),

  // Incidents
  getIncidents:       (p={}) => apiClient.get('/api/incidents', { params: p }),
  getIncidentById:    (id)   => apiClient.get(`/api/incidents/${id}`),
  createIncident:     (d)    => apiClient.post('/api/incidents', d),
  updateIncident:     (id,d) => apiClient.patch(`/api/incidents/${id}`, d),
  correlateIncident:  (id)   => apiClient.post(`/api/incidents/${id}/correlate`),
  addIncidentNote:    (id,d) => apiClient.post(`/api/incidents/${id}/notes`, d),
  getIncidentNotes:   (id)   => apiClient.get(`/api/incidents/${id}/notes`),
  getIncidentStats:   ()     => apiClient.get('/api/incidents/stats/summary'),
  exportIncidentsCsv: ()     => apiClient.get('/api/incidents/export/csv', { responseType: 'blob' }),
};

export const downloadCsv = (blob, filename) => {
  const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export default apiClient;
