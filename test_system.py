#!/usr/bin/env python3
"""
Test script for FINDER_ND system
"""

import os
import sys
import requests
import json
import time
import logging

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

def test_server_connection(server_url='http://localhost:5000'):
    """Test if server is running and responding"""
    logger = logging.getLogger(__name__)
    
    try:
        response = requests.get(f'{server_url}/api/health', timeout=5)
        if response.status_code == 200:
            data = response.json()
            logger.info(f"✓ Server is running")
            logger.info(f"  Available models: {len(data.get('available_models', []))}")
            return True
        else:
            logger.error(f"✗ Server responded with status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        logger.error("✗ Cannot connect to server. Is it running?")
        return False
    except Exception as e:
        logger.error(f"✗ Server test failed: {e}")
        return False

def test_model_loading(server_url='http://localhost:5000'):
    """Test if models can be loaded"""
    logger = logging.getLogger(__name__)
    
    try:
        response = requests.get(f'{server_url}/api/models', timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                models = data.get('models', [])
                logger.info(f"✓ Found {len(models)} models")
                for model in models:
                    logger.info(f"  - {model['name']}")
                return len(models) > 0
            else:
                logger.error(f"✗ Model loading failed: {data.get('error')}")
                return False
        else:
            logger.error(f"✗ Models endpoint returned {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"✗ Model test failed: {e}")
        return False

def test_graph_processing(server_url='http://localhost:5000'):
    """Test graph processing with a simple graph"""
    logger = logging.getLogger(__name__)
    
    # Create a simple test graph
    test_graph = {
        "edges": [
            [0, 1], [1, 2], [2, 3], [3, 0], [1, 3]
        ]
    }
    
    try:
        # Test dismantling
        response = requests.post(
            f'{server_url}/api/dismantle',
            json={
                'graph': test_graph,
                'step_ratio': 0.5,  # Use larger step for small graph
                'max_iterations': 100
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                result = data.get('result', {})
                logger.info("✓ Graph dismantling test passed")
                logger.info(f"  Nodes removed: {len(result.get('solution', []))}")
                logger.info(f"  Execution time: {result.get('execution_time', 0):.2f}s")
                return True
            else:
                logger.error(f"✗ Dismantling failed: {data.get('error')}")
                return False
        else:
            logger.error(f"✗ Dismantling endpoint returned {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"✗ Graph processing test failed: {e}")
        return False

def test_client_files():
    """Test if client files exist"""
    logger = logging.getLogger(__name__)
    
    client_files = [
        'client/index.html',
        'client/app.js',
        'client/styles.css'
    ]
    
    all_exist = True
    for file_path in client_files:
        if os.path.exists(file_path):
            logger.info(f"✓ {file_path} exists")
        else:
            logger.error(f"✗ {file_path} missing")
            all_exist = False
    
    return all_exist

def main():
    setup_logging()
    logger = logging.getLogger(__name__)
    
    logger.info("FINDER_ND System Test")
    logger.info("=" * 40)
    
    # Test client files
    logger.info("Testing client files...")
    if not test_client_files():
        logger.error("Client files test failed")
        return False
    
    # Test server connection
    logger.info("\nTesting server connection...")
    if not test_server_connection():
        logger.error("Server connection test failed")
        logger.error("Please start the server first: python run_server.py")
        return False
    
    # Test model loading
    logger.info("\nTesting model loading...")
    if not test_model_loading():
        logger.warning("Model loading test failed - this is OK if no models are available")
    
    # Test graph processing (only if models are available)
    logger.info("\nTesting graph processing...")
    if not test_graph_processing():
        logger.warning("Graph processing test failed - this might be due to missing models")
    
    logger.info("\n" + "=" * 40)
    logger.info("✓ System test completed!")
    logger.info("\nIf you see warnings about models, make sure to:")
    logger.info("1. Place your trained models in: AAA-NetDQN/code/models/")
    logger.info("2. Restart the server")
    
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)