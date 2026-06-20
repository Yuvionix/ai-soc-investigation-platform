"""
Test cases for API endpoints
"""
import pytest


def test_root_endpoint(client):
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()
    assert response.json()["status"] == "operational"


def test_health_check(client):
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_get_logs(auth_client):
    """Test get logs endpoint (requires authentication)"""
    response = auth_client.get("/api/logs/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_alerts(auth_client):
    """Test get alerts endpoint (requires authentication)"""
    response = auth_client.get("/api/alerts/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_incidents(auth_client):
    """Test get incidents endpoint (requires authentication)"""
    response = auth_client.get("/api/incidents/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_protected_routes_reject_unauthenticated_requests(client):
    """ADDED: confirms the auth guard is actually enforced — these must return 401, not 200."""
    for path in ("/api/logs/", "/api/alerts/", "/api/incidents/"):
        response = client.get(path)
        assert response.status_code == 401


# Add more tests as needed
