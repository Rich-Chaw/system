# System Architecture

## Overview

FINDER_ND is a web-based network dismantling system with a Flask backend and component-based frontend.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Client Application                    │  │
│  │                                                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │  │
│  │  │   Config     │  │  Event Bus   │  │  Component  │ │  │
│  │  │              │  │              │  │   Manager   │ │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │              UI Components                        │ │  │
│  │  │  • GraphUpload  • ModelSelection                 │ │  │
│  │  │  • Visualization • ProgressControl               │ │  │
│  │  │  • Statistics   • MultiView                      │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │              API Client                           │ │  │
│  │  │  • HTTP requests  • Error handling               │ │  │
│  │  │  • Timeout mgmt   • Response parsing             │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Flask Server                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   API Layer                            │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  Routes: /api/health, /api/models, etc.         │ │  │
│  │  │  • Request validation                             │ │  │
│  │  │  • Response formatting                            │ │  │
│  │  │  • Error handling                                 │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Core Layer                            │  │
│  │  ┌──────────────┐  ┌──────────────┐                  │  │
│  │  │    Config    │  │  Exceptions  │                  │  │
│  │  │              │  │              │                  │  │
│  │  └──────────────┘  └──────────────┘                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Services Layer                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │    Model     │  │    Graph     │  │ Dismantling│  │  │
│  │  │   Manager    │  │  Processor   │  │   Engine   │  │  │
│  │  │              │  │              │  │            │  │  │
│  │  │ • Load models│  │ • Parse      │  │ • Execute  │  │  │
│  │  │ • Cache      │  │ • Validate   │  │ • Metrics  │  │  │
│  │  │ • Manage     │  │ • Generate   │  │ • Compare  │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    GraphDQN Models                           │
│  • Trained neural networks                                   │
│  • Graph neural network encoders                             │
│  • Policy networks                                           │
└─────────────────────────────────────────────────────────────┘
```

## Component Flow

### 1. Graph Upload Flow

```
User → GraphUploadComponent → API Client → Server
                                              ↓
                                    GraphProcessor
                                              ↓
                                    Validation & Stats
                                              ↓
                                    Response → Client
                                              ↓
                                    GraphStatisticsComponent
                                              ↓
                                    SimpleVisualizationComponent
```

### 2. Dismantling Flow

```
User → ModelSelectionComponent → API Client → Server
                                                 ↓
                                       ModelManager (load model)
                                                 ↓
                                       DismantlingEngine
                                                 ↓
                                       Execute dismantling
                                                 ↓
                                       Calculate metrics
                                                 ↓
                                       Response → Client
                                                 ↓
                                       MultiViewVisualizationComponent
                                                 ↓
                                       ProgressControlComponent
```

### 3. Multi-Model Flow

```
User → ModelSelectionComponent (multiple models)
         ↓
    API Client → Server
                   ↓
         DismantlingEngine.dismantle_multi_model()
                   ↓
         For each model:
           • Load model
           • Execute dismantling
           • Calculate metrics
                   ↓
         Compare results
                   ↓
         Response → Client
                   ↓
         MultiViewVisualizationComponent (multiple views)
                   ↓
         ProgressControlComponent (synchronized)
```

## Data Flow

### Request Flow
```
Client Component
    ↓ (emit event)
EventBus
    ↓ (notify listeners)
API Client
    ↓ (HTTP request)
Flask Server
    ↓ (route to handler)
Service Layer
    ↓ (business logic)
Response
```

### Response Flow
```
Service Layer
    ↓ (return data)
Flask Server
    ↓ (format response)
API Client
    ↓ (parse response)
EventBus
    ↓ (emit event)
Component
    ↓ (update UI)
User
```

## Component Communication

### Event-Based Communication

```
Component A                EventBus                Component B
    │                         │                         │
    │──emit('graph:loaded')──>│                         │
    │                         │──notify listeners──────>│
    │                         │                         │
    │                         │<──emit('viz:ready')─────│
    │<──notify listeners──────│                         │
```

### State Management

```
Component
    │
    ├─ setState(newState)
    │     ↓
    ├─ onStateChange(oldState, newState)
    │     ↓
    └─ render()
```

## Server Architecture

### Layered Architecture

```
┌─────────────────────────────────────┐
│         API Layer (app.py)          │  ← Routes, validation
├─────────────────────────────────────┤
│      Core Layer (core/)             │  ← Config, exceptions
├─────────────────────────────────────┤
│    Services Layer (services/)       │  ← Business logic
├─────────────────────────────────────┤
│    External Layer (GraphDQN)        │  ← ML models
└─────────────────────────────────────┘
```

### Service Dependencies

```
DismantlingEngine
    ↓ depends on
ModelManager
    ↓ depends on
GraphDQN (external)

GraphProcessor
    ↓ independent
NetworkX
```

## Client Architecture

### Component Hierarchy

```
BaseComponent (abstract)
    │
    ├─ GraphUploadComponent
    │     ├─ File upload
    │     ├─ Manual input
    │     └─ Preset generation
    │
    ├─ GraphStatisticsComponent
    │     └─ Display stats
    │
    ├─ ModelSelectionComponent
    │     ├─ Model selection
    │     └─ Parameter config
    │
    ├─ SimpleVisualizationComponent
    │     └─ D3.js visualization
    │
    ├─ MultiViewVisualizationComponent
    │     └─ Multiple synchronized views
    │
    └─ ProgressControlComponent
          └─ Step-by-step control
```

### Component Lifecycle

```
Constructor
    ↓
init()
    ↓
setupEventListeners()
    ↓
render()
    ↓
[User Interaction]
    ↓
setState()
    ↓
onStateChange()
    ↓
render()
    ↓
destroy()
```

## Technology Stack

### Backend
- **Framework**: Flask
- **Language**: Python 3.7+
- **Libraries**: 
  - NetworkX (graph processing)
  - NumPy (numerical operations)
  - TensorFlow (ML models)

### Frontend
- **Framework**: Vanilla JavaScript (ES6+)
- **Libraries**:
  - D3.js (visualization)
  - Chart.js (charts)
  - Bootstrap 5 (UI)

### Communication
- **Protocol**: HTTP/REST
- **Format**: JSON
- **CORS**: Enabled for development

## Security Considerations

### Server
- Input validation
- File size limits
- Request timeouts
- Error handling (no sensitive data in responses)

### Client
- XSS prevention (sanitize inputs)
- CSRF protection (for production)
- Secure API communication

## Performance Optimizations

### Server
- Model caching (loaded models stay in memory)
- Efficient graph processing
- Parallel model execution (future)

### Client
- Component-based rendering (only update changed parts)
- Event-driven architecture (efficient communication)
- Lazy loading (future)

## Scalability

### Horizontal Scaling
- Stateless server design
- Can run multiple server instances
- Load balancer (future)

### Vertical Scaling
- Efficient memory management
- Model caching
- Optimized algorithms

## Monitoring & Logging

### Server Logging
```
INFO: Normal operations
WARNING: Non-critical issues
ERROR: Failures
DEBUG: Detailed information
```

### Client Logging
```
Console logs (development)
Error tracking (production)
Performance metrics (future)
```

## Deployment

### Development
```
python scripts/start_system.py
```

### Production (Future)
```
Docker containers
Nginx reverse proxy
Gunicorn WSGI server
```

## Future Enhancements

1. **API Versioning** (v1, v2)
2. **Authentication** (JWT tokens)
3. **Database** (PostgreSQL for results)
4. **Job Queue** (Celery for long tasks)
5. **WebSockets** (real-time updates)
6. **Docker** (containerization)
7. **CI/CD** (automated testing & deployment)
8. **Monitoring** (Prometheus, Grafana)

---

This architecture provides a solid foundation for a maintainable, scalable network dismantling system.
