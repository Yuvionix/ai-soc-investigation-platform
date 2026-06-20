# Architecture Documentation

## Overview
This directory contains architectural diagrams and documentation for the SOC Dashboard.

## Files

- **system_architecture.png**: High-level system architecture diagram
- **sequence_diagram.png**: Sequence diagrams for key operations
- **end_to_end_flow.png**: End-to-end data flow visualization
- **dashboard_components.png**: Frontend component architecture

## To Generate Diagrams

You can use tools like:
- draw.io / diagrams.net for general diagrams
- PlantUML for sequence and component diagrams
- Mermaid for markdown-based diagrams

## System Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼────────┐
│   Backend API   │
│   (FastAPI)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐
│SQLite │ │Security │
│  DB   │ │ Layer   │
└───────┘ └─────────┘
```

## Component Interaction

Frontend Components → API Client → Backend Routes → Services → Database

Security features (encryption, hashing, integrity checks) are applied at the service layer.
