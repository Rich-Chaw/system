# FINDER_ND Network Dismantling System

A modern web-based system for network dismantling using deep reinforcement learning models (GraphDQN). Features a Flask backend and component-based frontend architecture.

## 🏗️ Architecture

### Server (Backend)
```
server/
├── core/               # Core functionality
│   ├── config.py      # Configuration management
│   └── exceptions.py  # Custom exceptions
├── services/          # Business logic
│   ├── model_manager.py
│   ├── graph_processor.py
│   └── dismantling_engine.py
└── app.py            # Flask application
```

### Client (Frontend)
```
client/
├── js/
│   ├── core/          # Core architecture
│   │   ├── BaseComponent.js
│   │   ├── EventBus.js
│   │   └── ComponentManager.js
│   ├── components/    # UI components
│   │   ├── GraphUploadComponent.js
│   │   ├── GraphStatisticsComponent.js
│   │   ├── ModelSelectionComponent.js
│   │   ├── SimpleVisualizationComponent.js
│   │   ├── MultiViewVisualizationComponent.js
│   │   └── ProgressControlComponent.js
│   ├── utils/         # Utilities
│   │   └── api.js     # API client
│   ├── config.js      # Configuration
│   └── app.js         # Main application
├── index.html
└── styles.css
```

## 🚀 Quick Start

### Prerequisites
- Python 3.7+
- NetworkX, Flask, Flask-CORS
- Trained GraphDQN models in `FINDER/code/FINDER/models/`

### Installation

1. **Install dependencies:**
   ```bash
   cd system/server
   pip install -r requirements.txt
   ```

2. **Start the system:**
   ```bash
   python system/start_system.py
   ```

   This will start both the backend server (port 5000) and frontend client (port 8080).

### Manual Start

Start components separately:

```bash
# Backend server
cd system
python run_server.py --config development

# Frontend client (in another terminal)
cd system
python run_client.py --port 8080
```

## 📋 Features

### Graph Input
- **File Upload**: EdgeList, JSON, GML, GraphML formats
- **Manual Input**: Direct edge list entry
- **Preset Generation**: Barabási-Albert, Erdős-Rényi graphs

### Visualization
- Interactive D3.js-based graph visualization
- Multi-model comparison views
- Step-by-step dismantling playback
- Real-time statistics and metrics

### Model Execution
- Single or multiple model execution
- Configurable parameters (step ratio, iterations)
- Parallel model comparison
- Performance metrics and analysis

## 🔧 Configuration

### Server Configuration
Edit `server/core/config.py`:

```python
class Config:
    HOST = '0.0.0.0'
    PORT = 5000
    DEBUG = True
    MODELS_DIR = './FINDER/code/FINDER/models'
    DEFAULT_STEP_RATIO = 0.0025
    MAX_GRAPH_SIZE = 10000
```

### Client Configuration
Edit `client/js/config.js`:

```javascript
const Config = {
    API_BASE_URL: 'http://localhost:5000/api',
    REQUEST_TIMEOUT: 300000,
    MODEL: {
        DEFAULT_STEP_RATIO: 0.0025,
        DEFAULT_MAX_ITERATIONS: 1000
    }
};
```

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### Models
```
GET /api/models
```

### Graph Operations
```
POST /api/upload_graph
POST /api/generate_preset_graph
```

### Dismantling
```
POST /api/dismantle
POST /api/dismantle_multi_model
POST /api/evaluate_solution
```

## 🧪 Testing

Run system tests:
```bash
cd system/scripts
python test_system.py
```

## 📁 Project Structure

```
system/
├── server/            # Backend application
├── client/            # Frontend application
├── scripts/           # Launcher and utility scripts
├── .gitignore        # Git ignore rules
└── README.md         # This file
```

## 🔄 Component Architecture

The frontend uses a component-based architecture:

1. **BaseComponent**: Base class for all components
2. **EventBus**: Inter-component communication
3. **ComponentManager**: Lifecycle management
4. **Specialized Components**: Graph upload, visualization, model selection, etc.

## 🐛 Troubleshooting

### Server won't start
- Check if port 5000 is available
- Verify Python dependencies are installed
- Check models directory exists

### Client won't connect
- Ensure server is running
- Check API_BASE_URL in config.js
- Verify CORS is enabled

### Models not loading
- Place trained models in `FINDER/code/FINDER/models/`
- Check model directory permissions
- Verify model file formats

## 📝 Development

### Adding New Components

1. Create component in `client/js/components/`
2. Extend `BaseComponent`
3. Implement required methods
4. Add to `index.html`

### Adding New API Endpoints

1. Add route in `server/app.py`
2. Implement service logic in `server/services/`
3. Update `client/js/utils/api.js`
4. Handle in components

## 📄 License

This system is part of the FINDER_ND research project.

## 🤝 Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Submit pull requests

## 📧 Support

For issues or questions, please refer to the project documentation or create an issue in the repository.
