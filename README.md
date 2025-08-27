# FINDER_ND 网络拆解系统

基于深度强化学习模型的复杂网络分析和拆解Web系统。

## 概述

FINDER_ND系统提供了一个直观的界面，用于上传图形、分析其属性，并使用各种AI模型执行网络拆解。该系统由Flask后端服务器和现代Web前端组成。

## 功能特性

- **图形上传**: 支持多种图形格式 (EdgeList, JSON, GML, GraphML)
- **手动图形输入**: 直接以边列表形式输入图形数据
- **模型选择**: 从可用的训练模型中选择
- **实时可视化**: 使用D3.js的交互式图形可视化
- **拆解分析**: 包含指标和进度跟踪的综合分析
- **结果导出**: 导出解决方案和详细结果

## Architecture

```
system/
├── client/                 # Frontend web application
│   ├── index.html         # Main HTML interface
│   ├── app.js            # JavaScript application logic
│   └── styles.css        # CSS styling
├── server/                # Backend Flask application
│   ├── app.py            # Main Flask application
│   ├── config.py         # Configuration settings
│   ├── dismantling_engine.py  # Core dismantling logic
│   ├── graph_processor.py     # Graph processing utilities
│   └── model_manager.py       # Model loading and management
├── run_client.py          # Client server launcher
├── run_server.py          # Backend server launcher
└── start_system.py        # System launcher (starts both)
```

## Quick Start

1. **Start the complete system:**
   ```bash
   python system/start_system.py
   ```

2. **Access the web interface:**
   - Open your browser to `http://localhost:8080`
   - The backend API runs on `http://localhost:5000`

3. **Upload a graph:**
   - Use the file upload for supported formats
   - Or enter edge list data manually
   - View graph statistics and visualization

4. **Run dismantling analysis:**
   - Select a model and configure parameters
   - Click "Start Dismantling" to begin analysis
   - View results, charts, and export data

## API Endpoints

- `GET /api/health` - Server health check
- `GET /api/models` - List available models
- `POST /api/upload_graph` - Upload graph file
- `POST /api/dismantle` - Start dismantling analysis

## Configuration

The system supports development and production configurations:

- **Development**: Debug mode enabled, verbose logging
- **Production**: Optimized for deployment, minimal logging

## Requirements

- Python 3.7+
- Flask and dependencies (see `server/requirements.txt`)
- Modern web browser with JavaScript enabled
- Trained FINDER_ND models (place in `../AAA-NetDQN/code/models/`)

## Development

To run components separately:

```bash
# Backend only
python system/run_server.py --config development

# Frontend only  
python system/run_client.py --port 8080
```

## Troubleshooting

- Ensure all dependencies are installed
- Check that model files are available in the expected directory
- Verify ports 5000 and 8080 are available
- Check browser console for JavaScript errors

## License

This system is part of the FINDER_ND research project.