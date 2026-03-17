"""
End-to-End Integration Test
Tests the complete workflow from graph upload to dismantling with all model types
"""

import sys
import os
import json
import requests
import time
import networkx as nx
import pickle

# Configuration
SERVER_URL = "http://localhost:5000"
TEST_TIMEOUT = 30  # seconds

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def test_server_health():
    """Test if server is running"""
    print_section("Testing Server Health")
    try:
        response = requests.get(f"{SERVER_URL}/api/health", timeout=5)
        if response.status_code == 200:
            print("✓ Server is running")
            return True
        else:
            print(f"✗ Server returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"✗ Server is not accessible: {e}")
        return False

def test_model_discovery():
    """Test model discovery for all types"""
    print_section("Testing Model Discovery")
    
    try:
        response = requests.get(f"{SERVER_URL}/api/models/all", timeout=10)
        data = response.json()
        
        if not data.get('success'):
            print(f"✗ Model discovery failed: {data.get('error')}")
            return False
        
        models = data.get('models', {})
        print(f"✓ Model discovery successful")
        
        for model_type, model_list in models.items():
            print(f"  - {model_type.upper()}: {len(model_list)} models")
            if model_list and len(model_list) > 0:
                print(f"    Example: {model_list[0]['path']}")
        
        return True
        
    except Exception as e:
        print(f"✗ Model discovery failed: {e}")
        return False

def create_test_graph():
    """Create a small test graph"""
    print_section("Creating Test Graph")
    
    # Create a small Barabási-Albert graph
    G = nx.barabasi_albert_graph(50, 2, seed=42)
    
    print(f"✓ Created test graph:")
    print(f"  - Nodes: {G.number_of_nodes()}")
    print(f"  - Edges: {G.number_of_edges()}")
    
    # Convert to edge list format
    edge_list = {
        'nodes': list(G.nodes()),
        'edges': [[u, v] for u, v in G.edges()]
    }
    
    return edge_list

def test_baseline_dismantling(graph):
    """Test baseline method dismantling"""
    print_section("Testing Baseline Dismantling")
    
    try:
        response = requests.get(f"{SERVER_URL}/api/models/all", timeout=10)
        data = response.json()
        baseline_models = data.get('models', {}).get('baseline', [])
        
        if not baseline_models:
            print("⚠ No MIND-ND models available, skipping test")
            return True

        request_data = {
            'graph': graph,
            'model_type': 'baseline',
            'parameters': {
                'method': 'Degree',
                'max_steps': 10
            }
        }
        
        print("Sending request to /api/dismantle/execute...")
        response = requests.post(
            f"{SERVER_URL}/api/dismantle/execute",
            json=request_data,
            timeout=TEST_TIMEOUT
        )
        
        data = response.json()
        
        if not data.get('success'):
            print(f"✗ Baseline dismantling failed: {data.get('error')}")
            return False
        
        # API returns removals and score at top level
        removals = data.get('removals', [])
        score = data.get('score', 0.0)
        
        print(f"✓ Baseline dismantling successful")
        print(f"  - Removed nodes: {len(removals)}")
        print(f"  - Final score: {score:.4f}")
        
        return True
        
    except Exception as e:
        print(f"✗ Baseline dismantling failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_finder_dismantling(graph, model_path=None):
    """Test FINDER model dismantling"""
    print_section("Testing FINDER Dismantling")
    
    # First get available FINDER models
    try:
        response = requests.get(f"{SERVER_URL}/api/models/all", timeout=10)
        data = response.json()
        finder_models = data.get('models', {}).get('finder', [])
        
        if not finder_models:
            print("⚠ No FINDER models available, skipping test")
            return True
        
        if not model_path:
            model_path = finder_models[0]['path']
        
        print(f"Using FINDER model: {model_path}")
        
        request_data = {
            'graph': graph,
            'model_type': 'finder',
            'model_path': model_path,
            'parameters': {
                'step_ratio': 0.02
            }
        }
        
        print("Sending request to /api/dismantle/execute...")
        response = requests.post(
            f"{SERVER_URL}/api/dismantle/execute",
            json=request_data,
            timeout=TEST_TIMEOUT
        )
        
        data = response.json()
        
        if not data.get('success'):
            print(f"✗ FINDER dismantling failed: {data.get('error')}")
            return False
        
        # API returns removals and score at top level
        removals = data.get('removals', [])
        score = data.get('score', 0.0)
        
        print(f"✓ FINDER dismantling successful")
        print(f"  - Removed nodes: {len(removals)}")
        print(f"  - Final score: {score:.4f}")
        
        return True
        
    except Exception as e:
        print(f"✗ FINDER dismantling failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_mind_dismantling(graph, model_path=None):
    """Test MIND-ND model dismantling"""
    print_section("Testing MIND-ND Dismantling")
    
    # First get available MIND models
    try:
        response = requests.get(f"{SERVER_URL}/api/models/all", timeout=10)
        data = response.json()
        mind_models = data.get('models', {}).get('mind', [])
        
        if not mind_models:
            print("⚠ No MIND-ND models available, skipping test")
            return True
        
        if not model_path:
            model_path = mind_models[0]['path']
        
        print(f"Using MIND-ND model: {model_path}")
        
        request_data = {
            'graph': graph,
            'model_type': 'mind',
            'model_path': model_path,
            'parameters': {
                'threshold': 0.1,
                'max_steps': 10
            }
        }
        
        print("Sending request to /api/dismantle/execute...")
        response = requests.post(
            f"{SERVER_URL}/api/dismantle/execute",
            json=request_data,
            timeout=TEST_TIMEOUT
        )
        
        data = response.json()
        
        if not data.get('success'):
            print(f"✗ MIND-ND dismantling failed: {data.get('error')}")
            return False
        
        # API returns removals and score at top level
        removals = data.get('removals', [])
        score = data.get('score', 0.0)
        
        print(f"✓ MIND-ND dismantling successful")
        print(f"  - Removed nodes: {len(removals)}")
        print(f"  - Final score: {score:.4f}")
        
        return True
        
    except Exception as e:
        print(f"✗ MIND-ND dismantling failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "="*60)
    print("  END-TO-END INTEGRATION TEST")
    print("="*60)
    print(f"Server URL: {SERVER_URL}")
    print(f"Timeout: {TEST_TIMEOUT}s")
    
    results = {
        'server_health': False,
        'model_discovery': False,
        'baseline': False,
        'finder': False,
        'mind': False
    }
    
    # Test 1: Server Health
    results['server_health'] = test_server_health()
    if not results['server_health']:
        print("\n✗ Server is not running. Please start the server first:")
        print("  python start_system.py")
        return False
    
    # Test 2: Model Discovery
    results['model_discovery'] = test_model_discovery()
    
    # Create test graph
    graph = create_test_graph()
    
    # Test 3: Baseline Dismantling
    results['baseline'] = test_baseline_dismantling(graph)
    
    # Test 4: FINDER Dismantling (if available)
    results['finder'] = test_finder_dismantling(graph)
    
    # Test 5: MIND-ND Dismantling (if available)
    results['mind'] = test_mind_dismantling(graph)
    
    # Summary
    print_section("Test Summary")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! The system is fully operational.")
        return True
    else:
        print(f"\n⚠ {total - passed} test(s) failed.")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
