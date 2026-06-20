/**
 * Timeline Viewer Component
 */
import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';

function TimelineViewer({ isReplayMode = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, []);

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const response = await api.getTimeline();
      setEvents(response.data);
    } catch (error) {
      console.error('Error loading timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading timeline...</div>;

  return (
    <div className="panel timeline-viewer">
      <h3 className="panel-title">Timeline {isReplayMode && '(Replay Mode)'}</h3>
      <div className="timeline-content">
        {events.length === 0 ? (
          <div className="no-events">No events to display</div>
        ) : (
          <div className="timeline-events">
            {events.map((event, index) => (
              <div key={index} className="timeline-event">
                <div className="event-time">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </div>
                <div className="event-type">{event.event_type}</div>
                <div className="event-description">{event.description || 'No description'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TimelineViewer;
