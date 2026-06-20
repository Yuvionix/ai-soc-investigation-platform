# Offline SOC Dashboard

A comprehensive Security Operations Center (SOC) dashboard for offline incident analysis, forensic investigation, and security event management.

## Features

- **Real-time Security Monitoring**: Monitor logs, alerts, and incidents
- **Incident Correlation**: Advanced correlation engine for security events
- **Timeline Analysis**: Interactive timeline for incident reconstruction
- **Replay Mode**: Simulate and replay security scenarios
- **Analyst Feedback**: Integrated feedback system for continuous improvement
- **Data Integrity**: Built-in encryption and integrity checking

## Architecture

The system consists of:
- **Backend**: FastAPI-based REST API with SQLite database
- **Frontend**: React-based dashboard with real-time updates
- **Security Layer**: Encryption, hashing, and integrity verification
- **Simulation Engine**: Event replay and scenario testing

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Python 3.9+ (for local development)
- Node.js 16+ (for local development)

### Using Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd offline-soc-dashboard

# Copy environment variables
cp .env.example .env

# Start the services
docker-compose up -d

# Access the dashboard
open http://localhost:3000
```

### Local Development

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### Frontend

```bash
cd frontend
npm install
npm start
```

## Documentation

- [System Architecture](docs/architecture/)
- [API Documentation](docs/api_documentation.md)
- [Database Schema](docs/database_schema.md)
- [Final Report](docs/final_report.pdf)

## Project Structure

```
offline-soc-dashboard/
├── backend/          # FastAPI backend
├── frontend/         # React frontend
├── data/            # Database and sample data
├── docs/            # Documentation and diagrams
└── docker-compose.yml
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

For security concerns, please email security@example.com

## Authors

- Your Name - Initial work

## Acknowledgments

- Security research community
- Open source contributors
