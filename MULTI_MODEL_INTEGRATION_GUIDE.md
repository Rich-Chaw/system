# Multi-Model Integration Guide

## Overview

This guide explains the engineering approach for integrating models from different projects (AAA-NetDQN, MIND-ND, baselines) that may require different conda environments.

## Architecture Design

### Problem Statement
- Different models (FINDER, MIND-ND, baselines) have different dependencies
- Models may require different Python/conda environments
- Need unified interface for the web system
- Must handle both NetworkX and igraph formats

### Solution: Subprocess-Based Execution with Unified Interface

```
┌─────────────────────────────────────────────────────────┐
│                    Flask Web Server                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │            Model Manager (Unified API)            │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Model Executor                        │  │
│  │  • Subprocess management                           │  │
│  │  • Environment isolation                           │  │
│  │  • Result aggregation                              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   FINDER     │  │   MIND-ND    │  │  Baselines   │
│ (conda: base)│  │ (conda: mind)│  │ (conda: base)│
│              │  │              │  │              │
│ python_      │  │ python_      │  │ baseline_    │
│ interface.py │  │ interface.py │  │ interface.py │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Key Components

### 1. Python Interfaces (Standardized)

Each model type has a standardized Python interface:

**AAA-NetDQN/python_interface.py** (✓ Already exists)
- Input: `--graph_file`, `--model_path`, `--step_ratio`
- Output: JSON with `removals`, `score`, `MaxCCList`

**MIND-ND/python_interface.py** (✓ Created)
- Input: `--graph_file`, `--model_path`, `--budget`
- Output: JSON with `removals`, `robustness`, `lcc_sizes`

**baselines/baseline_interface.py** (✓ Created)
- Input: `--graph_file`, `--method`, `--max_steps`
- Output: JSON with `removals`, `robustness`, `auc`

### 2. Model Executor (`system/server/services/model_executor.py`)

Central service that:
- Manages subprocess execution
- Handles conda environment switching
- Converts between graph formats
- Aggregates results

**Key Methods:**
```python
executor = ModelExecutor()

# Execute any model type
removals, score, lcc_sizes = executor.execute_model(
    model_type='mind',  # or 'finder', 'baseline'
    model_path='/path/to/model.ckpt',
    graph=graph_object,
    budget=0.1  # model-specific params
)

# List available models
models = executor.list_available_models('mind')
```

### 3. Configuration (`system/server/config/model_environments.json`)

Defines:
- Model types and their interfaces
- Conda environment requirements
- Parameter schemas
- Graph format requirements

## Usage Examples

### Example 1: Execute FINDER Model

```python
from services.model_executor import ModelExecutor
from services.graph_processor import GraphProcessor

executor = ModelExecutor()
processor = GraphProcessor()

# Load graph
graph = processor.load_from_file('graph.pkl')

# Execute FINDER model
removals, score, lcc_sizes = executor.execute_model(
    model_type='finder',
    model_path='AAA-NetDQN/code/FINDER/models/graphSage_BA',
    graph=graph,
    step_ratio=0.01
)
```

### Example 2: Execute MIND-ND Model

```python
# MIND-ND requires igraph format
ig_graph = processor.networkx_to_igraph(graph)

removals, score, lcc_sizes = executor.execute_model(
    model_type='mind',
    model_path='MIND-ND/saved/mind/mind.ckpt',
    graph=ig_graph,
    budget=0.1
)
```

### Example 3: Execute Baseline Method

```python
removals, score, lcc_sizes = executor.execute_model(
    model_type='baseline',
    model_path='Degree',  # Method name
    graph=ig_graph,
    max_steps=100
)
```

### Example 4: Compare Multiple Models

```python
models_to_compare = [
    {'type': 'finder', 'path': 'path/to/finder', 'params': {'step_ratio': 0.01}},
    {'type': 'mind', 'path': 'path/to/mind.ckpt', 'params': {'budget': 0.1}},
    {'type': 'baseline', 'path': 'Degree', 'params': {}}
]

results = {}
for model_config in models_to_compare:
    removals, score, lcc_sizes = executor.execute_model(
        model_type=model_config['type'],
        model_path=model_config['path'],
        graph=graph,
        **model_config['params']
    )
    results[model_config['path']] = {
        'removals': removals,
        'score': score,
        'lcc_sizes': lcc_sizes
    }
```

## Conda Environment Setup

### Create MIND-ND Environment

```bash
# Create conda environment for MIND-ND
conda create -n mind python=3.9
conda activate mind
cd MIND-ND
pip install -r requirements.txt
```

### Test Conda Execution

```bash
# Test that conda run works
conda run -n mind python MIND-ND/python_interface.py --graph_file test.pkl --model_path saved/mind/mind.ckpt
```

## Advantages of This Approach

1. **Isolation**: Each model runs in its own environment - no dependency conflicts
2. **Flexibility**: Easy to add new model types
3. **Robustness**: Model crashes don't affect the web server
4. **Scalability**: Can run models in parallel
5. **Maintainability**: Each model interface is independent
6. **Testability**: Each interface can be tested standalone

## Integration with Existing System

### Update Model Manager

The existing `ModelManager` class should delegate to `ModelExecutor`:

```python
class ModelManager:
    def __init__(self):
        self.executor = ModelExecutor()
        self.finder_models = self._discover_finder_models()
        self.mind_models = self.executor.list_available_models('mind')
        self.baseline_methods = self.executor.list_available_models('baseline')
    
    def get_available_models(self):
        """Return all available models from all types"""
        return {
            'finder': self.finder_models,
            'mind': self.mind_models,
            'baselines': self.baseline_methods
        }
    
    def dismantle_graph(self, graph, model_type, model_path, **kwargs):
        """Unified dismantling interface"""
        return self.executor.execute_model(
            model_type=model_type,
            model_path=model_path,
            graph=graph,
            **kwargs
        )
```

### Update API Endpoints

```python
@app.route('/api/dismantle', methods=['POST'])
def dismantle_network():
    data = request.get_json()
    
    model_type = data.get('model_type', 'finder')
    model_path = data['model_path']
    graph_data = data['graph']
    params = data.get('parameters', {})
    
    # Parse graph
    graph = graph_processor.parse_graph(graph_data)
    
    # Execute model
    removals, score, lcc_sizes = model_manager.dismantle_graph(
        graph=graph,
        model_type=model_type,
        model_path=model_path,
        **params
    )
    
    return jsonify({
        'success': True,
        'removals': removals,
        'score': score,
        'lcc_sizes': lcc_sizes
    })
```

## Testing

### Test Individual Interfaces

```bash
# Test FINDER
python AAA-NetDQN/python_interface.py --graph_file test.pkl --model_path models/graphSage_BA

# Test MIND-ND
conda run -n mind python MIND-ND/python_interface.py --graph_file test.pkl --model_path saved/mind/mind.ckpt

# Test Baselines
python baselines/baseline_interface.py --graph_file test.pkl --method Degree
```

### Test Model Executor

```python
import unittest
from services.model_executor import ModelExecutor

class TestModelExecutor(unittest.TestCase):
    def test_finder_execution(self):
        executor = ModelExecutor()
        # Test FINDER model execution
        
    def test_mind_execution(self):
        executor = ModelExecutor()
        # Test MIND-ND model execution
        
    def test_baseline_execution(self):
        executor = ModelExecutor()
        # Test baseline method execution
```

## Troubleshooting

### Issue: Conda command not found
**Solution**: Ensure conda is in PATH or specify full path in config

### Issue: Model execution timeout
**Solution**: Increase timeout in `model_executor.py` or optimize model

### Issue: Graph format mismatch
**Solution**: Use `graph_processor` conversion methods

### Issue: Conda environment not found
**Solution**: Create environment or set `conda_env: null` to use system Python

## Future Enhancements

1. **Async Execution**: Use `AsyncModelExecutor` for non-blocking execution
2. **Caching**: Cache model results for identical inputs
3. **Distributed Execution**: Run models on different machines
4. **GPU Support**: Add GPU allocation for models that support it
5. **Model Versioning**: Track model versions and compatibility

## Summary

This architecture provides a clean, maintainable way to integrate models from different projects with different dependencies. The key insight is to use subprocess isolation with standardized JSON-based communication, allowing each model to run in its optimal environment while presenting a unified interface to the web system.
