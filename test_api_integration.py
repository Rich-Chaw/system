#!/usr/bin/env python3
"""
Test API integration with ModelExecutor
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from services.model_manager import ModelManager
from services.graph_processor import GraphProcessor
import networkx as nx

def test_model_manager_integration():
    """Test ModelManager with ModelExecutor"""
    print("\n=== Testing ModelManager Integration ===")
    
    manager = ModelManager()
    processor = GraphProcessor()
    
    # Test 1: Get all models
    print("\n1. Testing get_all_models()...")
    try:
        all_models = manager.get_all_models()
        print(f"✓ Found models:")
        for model_type, models in all_models.items():
            print(f"  - {model_type}: {len(models)} models")
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False
    
    # Test 2: Execute baseline dismantling
    print("\n2. Testing baseline dismantling via ModelManager...")
    try:
        graph = nx.karate_club_graph()
        ig_graph = processor.networkx_to_igraph(graph)
        
        removals, score = manager.dismantle_with_executor(
            graph=ig_graph,
            model_type='baseline',
            method='Degree',
            max_steps=10
        )
        
        print(f"✓ Baseline dismantling successful")
        print(f"  Removed {len(removals)} nodes, score: {score:.4f}")
    except Exception as e:
        print(f"✗ Failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

def main():
    print("=" * 60)
    print("API Integration Test")
    print("=" * 60)
    
    success = test_model_manager_integration()
    
    print("\n" + "=" * 60)
    if success:
        print("✓ All integration tests passed!")
    else:
        print("✗ Some tests failed")
    print("=" * 60)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
