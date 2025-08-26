#!/usr/bin/env python3
"""
FINDER_ND Network Dismantling Server
Main Flask application serving the GraphDQN models
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import sys
import json
import tempfile
import networkx as nx
import numpy as np
from datetime import datetime
import logging
import traceback

# Add the FINDER_ND code path
sys.path.append('./AAA-NetDQN/code/FINDER_ND')
sys.path.append('./AAA-NetDQN/code')

from model_manager import ModelManager
from graph_processor import GraphProcessor
from dismantling_engine import DismantlingEngine

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize components
model_manager = ModelManager('./AAA-NetDQN/code/models')
graph_processor = GraphProcessor()
dismantling_engine = DismantlingEngine(model_manager)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'available_models': model_manager.get_available_models()
    })

@app.route('/api/models', methods=['GET'])
def get_models():
    """Get list of available models"""
    try:
        models = model_manager.get_available_models()
        return jsonify({
            'success': True,
            'models': models
        })
    except Exception as e:
        logger.error(f"Error getting models: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/dismantle', methods=['POST'])
def dismantle_network():
    """Main endpoint for network dismantling"""
    try:
        # Parse request
        data = request.get_json()
        
        # Validate required fields
        if 'graph' not in data:
            return jsonify({
                'success': False,
                'error': 'Graph data is required'
            }), 400
        
        # Extract parameters
        graph_data = data['graph']
        model_name = data.get('model', 'default')
        step_ratio = data.get('step_ratio', 0.0025)
        max_iterations = data.get('max_iterations', 1000)
        
        # Debug: log the graph data format
        logger.info(f"Received graph data type: {type(graph_data)}")
        logger.info(f"Graph data keys: {list(graph_data.keys()) if isinstance(graph_data, dict) else 'Not a dict'}")
        
        # Process graph
        graph = graph_processor.parse_graph(graph_data)
        
        # Validate graph
        if graph.number_of_nodes() == 0:
            return jsonify({
                'success': False,
                'error': 'Empty graph provided'
            }), 400
        
        # Execute dismantling
        result = dismantling_engine.dismantle(
            graph=graph,
            model_name=model_name,
            step_ratio=step_ratio,
            max_iterations=max_iterations
        )
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        logger.error(f"Error in dismantling: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/upload_graph', methods=['POST'])
def upload_graph():
    """Upload graph file endpoint"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        # Save temporary file
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.txt')
        try:
            file.save(tmp_file.name)
            tmp_file.close()  # Close the file before processing
            
            # Process graph file
            graph = graph_processor.load_from_file(tmp_file.name)
            
        finally:
            # Clean up
            try:
                os.unlink(tmp_file.name)
            except OSError:
                pass  # File might already be deleted
        
        # Return graph info
        return jsonify({
            'success': True,
            'graph_info': {
                'nodes': graph.number_of_nodes(),
                'edges': graph.number_of_edges(),
                'is_connected': nx.is_connected(graph),
                'density': nx.density(graph)
            },
            'graph_data': graph_processor.graph_to_dict(graph)
        })
        
    except Exception as e:
        logger.error(f"Error uploading graph: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/evaluate', methods=['POST'])
def evaluate_solution():
    """Evaluate a dismantling solution"""
    try:
        data = request.get_json()
        
        graph_data = data['graph']
        solution = data['solution']
        
        graph = graph_processor.parse_graph(graph_data)
        metrics = dismantling_engine.evaluate_solution(graph, solution)
        
        return jsonify({
            'success': True,
            'metrics': metrics
        })
        
    except Exception as e:
        logger.error(f"Error evaluating solution: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)