/**
 * AI Investigation Center — API client
 * All calls go through the existing apiClient interceptor (Bearer token auto-attached).
 */
import apiClient from './apiClient';

export const aiApi = {
  status:            ()          => apiClient.get('/api/ai/status'),
  sessions:          ()          => apiClient.get('/api/ai/sessions'),
  upload:            (formData)  => apiClient.post('/api/ai/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,   // 3 min — local AI inference can be slow on CPU
  }),
  getInvestigation:  (sid)       => apiClient.get(`/api/ai/investigation/${sid}`),
  chat:              (body)      => apiClient.post('/api/ai/chat', body, { timeout: 120000 }),
  chatHistory:       (sid)       => apiClient.get(`/api/ai/chat/history/${sid}`),
  explainBeginner:   (body)      => apiClient.post('/api/ai/explain', body, { timeout: 60000 }),
  generateReport:    (body)      => apiClient.post('/api/ai/report', body, { timeout: 120000 }),
  regenerateStory:   (sid, model)=> apiClient.post(`/api/ai/story/${sid}?model=${model}`),
};
