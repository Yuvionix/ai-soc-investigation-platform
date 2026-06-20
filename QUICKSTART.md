# Quick Start Guide - Offline SOC Dashboard

## Prerequisites
- Python 3.9 or higher
- Node.js 16 or higher
- Docker & Docker Compose (optional)

## Option 1: Using Docker (Recommended)

1. **Clone and Navigate**
   ```bash
   cd offline-soc-dashboard
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

3. **Start Services**
   ```bash
   docker-compose up -d
   ```

4. **Access the Dashboard**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Option 2: Local Development

1. **Run Setup Script**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

2. **Start Backend**
   ```bash
   cd backend
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   uvicorn app.main:app --reload
   ```

3. **Start Frontend** (in new terminal)
   ```bash
   cd frontend
   npm start
   ```

## Initial Configuration

### Update .env File
```bash
# Generate secure keys
SECRET_KEY=your-secure-secret-key-here
ENCRYPTION_KEY=your-secure-encryption-key-here

# Enable/disable features
ENABLE_ENCRYPTION=True
ENABLE_INTEGRITY_CHECK=True
```

### Database Initialization
The database will be automatically initialized on first run. The schema is created from `backend/app/database/schema.sql`.

## Testing the Setup

1. **Health Check**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Create Sample Data**
   ```bash
   # Use the sample_events.json for testing
   python scripts/load_sample_data.py  # (create this script as needed)
   ```

3. **Access Frontend**
   Open http://localhost:3000 in your browser

## Troubleshooting

### Backend Issues
- Check logs: `docker-compose logs backend` or check `backend/logs/app.log`
- Verify Python version: `python --version` (should be 3.9+)
- Check database: Ensure `data/soc_database.db` exists

### Frontend Issues
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node version: `node --version` (should be 16+)
- Check console for errors in browser DevTools

### Docker Issues
- Rebuild containers: `docker-compose down && docker-compose up --build`
- Check container status: `docker-compose ps`
- View logs: `docker-compose logs -f`

## Next Steps

1. **Explore the API**: Visit http://localhost:8000/docs for interactive API documentation
2. **Load Test Data**: Use the sample scenarios in `data/sample_events.json`
3. **Try Replay Mode**: Navigate to http://localhost:3000/replay
4. **Read Documentation**: Check `docs/` folder for detailed guides

## Common Tasks

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Reset Database
```bash
rm data/soc_database.db
docker-compose restart backend
```

### Run Tests
```bash
cd backend
pytest
```

## Support
For issues, check:
- GitHub Issues
- Documentation in `docs/`
- API documentation at http://localhost:8000/docs
