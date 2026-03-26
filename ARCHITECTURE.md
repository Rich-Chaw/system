# System Architecture

## Overview

NetworkDismantling is a web-based network dismantling system with a Flask backend and component-based frontend. Models run in isolated conda environments and are invoked via subprocess through a unified `ModelExecutor` interface.

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
│  │                   API Layer (app.py)                   │  │
│  │  Routes: /api/health, /api/models, /api/dismantle,    │  │
│  │          /api/dismantle_multi, /api/dismantle/execute  │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              config/ (Config & Exceptions)             │  │
│  │  config.py  •  exceptions.py                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Services Layer                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │    Model     │  │    Graph     │  │Dismantling │  │  │
│  │  │   Manager    │  │  Processor   │  │   Engine   │  │  │
│  │  │              │  │              │  │            │  │  │
│  │  │ • List models│  │ • Parse      │  │ • Execute  │  │  │
│  │  │ • Delegate   │  │ • Validate   │  │ • Metrics  │  │  │
│  │  │   to executor│  │ • Generate   │  │ • Compare  │  │  │
│  │  └──────┬───────┘  └──────────────┘  └────────────┘  │  │
│  │         │                                              │  │
│  │  ┌──────▼───────┐                                     │  │
│  │  │    Model     │                                     │  │
│  │  │   Executor   │                                     │  │
│  │  │              │                                     │  │
│  │  │ • subprocess │                                     │  │
│  │  │ • conda envs │                                     │  │
│  │  │ • pkl I/O    │                                     │  │
│  │  └──────────────┘                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        FINDER (tf_py37)  MIND-ND        Baselines
        python_interface  (torch_py38)   (torch_py38)
```

## Component Flow

### Graph Upload Flow

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

### Dismantling Flow

```
User → ModelSelectionComponent → API Client → /api/dismantle/execute
                                                       ↓
                                             ModelManager
                                                       ↓
                                             ModelExecutor
                                                       ↓
                                        subprocess (conda run -n <env>)
                                                       ↓
                                        python_interface.py
                                                       ↓
                                        JSON result → Client
                                                       ↓
                                        MultiViewVisualizationComponent
                                                       ↓
                                        ProgressControlComponent
```

## Directory Structure

```
system/
├── server/
│   ├── app.py                  # Flask routes
│   ├── config/                 # Config & exceptions
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── exceptions.py
│   │   └── model_environments.json
│   └── services/
│       ├── model_manager.py    # Lists models, delegates to executor
│       ├── model_executor.py   # subprocess + conda execution
│       ├── dismantling_engine.py
│       └── graph_processor.py
└── client/
    ├── index.html
    ├── app.js
    └── js/
        ├── core/               # EventBus, ComponentManager, BaseComponent
        ├── components/         # UI components
        └── utils/              # API client
```

## Model Execution

All models run in isolated conda environments via `ModelExecutor`:

| Model Type | Conda Env   | Interface                        | Graph Format |
|------------|-------------|----------------------------------|--------------|
| finder     | tf_py37     | FINDER/python_interface.py       | networkx     |
| mind       | torch_py38  | MIND-ND/python_interface.py      | igraph       |
| baseline   | torch_py38  | baselines/baseline_interface.py  | igraph       |

The executor serializes the graph to a `.pkl` file, calls the interface script, and reads back a JSON result file.

## Technology Stack

### Backend
- Framework: Flask + flask-cors
- Language: Python 3.7+
- Libraries: NetworkX, NumPy, igraph

### Frontend
- Framework: Vanilla JavaScript (ES6+)
- Libraries: D3.js, Chart.js, Bootstrap 5

## Security Considerations

- Input validation on all endpoints
- File size limits (16MB)
- Request timeouts (5 min)
- No sensitive data in error responses

## Deployment

### Development
```
python system/run_server.py --config development
python system/run_client.py
```

### Production (Future)
```
Docker containers
Nginx reverse proxy
Gunicorn WSGI server
```

## Future Enhancements

1. WebSockets for real-time progress updates
2. Job queue (Celery) for long-running tasks
3. Authentication (JWT)
4. Docker containerization
5. CI/CD pipeline
