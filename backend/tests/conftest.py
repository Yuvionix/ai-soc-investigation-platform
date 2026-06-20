"""
Test configuration and fixtures
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    """Unauthenticated test client fixture — used for /, /health, and 401-rejection tests."""
    return TestClient(app)


@pytest.fixture
def auth_client():
    """
    Authenticated test client fixture.
    FIX: previously, test_get_logs / test_get_alerts / test_get_incidents called
    the unauthenticated `client` fixture against routes that correctly require a
    JWT (per the auth-guard fix applied to alerts.py/incidents.py/logs.py).
    Those three tests were failing with 401 until this fixture was added.
    """
    c = TestClient(app)
    resp = c.post("/api/auth/login", json={"username": "admin", "password": "Admin@123"})
    token = resp.json()["access_token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


@pytest.fixture
def sample_log_data():
    """Sample log data for testing"""
    return {
        "source": "firewall",
        "severity": "warning",
        "message": "Suspicious traffic detected",
        "raw_data": "192.168.1.100 -> 10.0.0.1"
    }


@pytest.fixture
def sample_alert_data():
    """Sample alert data for testing"""
    return {
        "title": "Potential Brute Force Attack",
        "description": "Multiple failed login attempts detected",
        "severity": "high",
        "source": "authentication_system",
        "alert_type": "brute_force"
    }


@pytest.fixture
def sample_incident_data():
    """Sample incident data for testing"""
    return {
        "title": "Data Exfiltration Attempt",
        "description": "Unusual outbound traffic detected",
        "severity": "critical",
        "incident_type": "data_breach"
    }
