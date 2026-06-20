# Contributing to Offline SOC Dashboard

Thank you for considering contributing to the Offline SOC Dashboard project!

## How to Contribute

### Reporting Bugs
- Use the GitHub issue tracker
- Describe the bug in detail
- Include steps to reproduce
- Specify your environment (OS, Python version, etc.)

### Suggesting Features
- Open an issue with the "enhancement" label
- Clearly describe the feature and its benefits
- Provide examples if possible

### Pull Requests
1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write or update tests as needed
5. Ensure all tests pass
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Development Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

## Code Style

### Python
- Follow PEP 8
- Use type hints where appropriate
- Write docstrings for functions and classes

### JavaScript/React
- Use ES6+ syntax
- Follow React best practices
- Use functional components with hooks

## Testing
- Write tests for new features
- Ensure existing tests pass
- Aim for good test coverage

## Commit Messages
- Use clear, descriptive commit messages
- Follow conventional commits format:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation
  - `test:` for tests
  - `refactor:` for code refactoring

## Questions?
Feel free to open an issue for any questions or clarifications.
