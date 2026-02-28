#!/usr/bin/env python3
"""
Test script for ModelExecutor
Tests execution of different model types
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from services.model_executor import ModelExecutor
from services.graph_processor import GraphProcessor
import networkx as nx

def test_baseline_execution():
    """Test baseline method execution"""
    print("\n=== Testing Baseline Execution ===")
    
    executor = ModelExecutor()
    processor = GraphProcessor()
    
    # Create a simple test graph
    graph = nx.karate_club_graph()
    
    # Convert to igraph for baseline
    ig_graph = processor.networkx_to_igraph(graph)
    
    try:
        removals, score = executor.execute_model(
            graph=ig_graph,
            model_type='baseline',
            method='Degree',  # Method name
            max_steps=10
        )
        
        print(f"✓ Baseline execution successful")
        print(f"  Removed {len(removals)} nodes")
        print(f"  Robustness score: {score:.4f}")
        print(f"  First 5 removals: {removals[:5]}")
        return True
        
    except Exception as e:
        print(f"✗ Baseline execution failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_model_discovery():
    """Test model discovery for all types"""
    print("\n=== Testing Model Discovery ===")
    
    executor = ModelExecutor()
    
    for model_type in ['finder', 'mind', 'baseline']:
        try:
            models = executor.list_available_models(model_type)
            print(f"✓ {model_type}: Found {len(models)} models")
            if models:
                print(f"  Example: {models[0]['name']}")
        except Exception as e:
            print(f"✗ {model_type}: Discovery failed - {e}")

def test_graph_conversion():
    """Test graph format conversion"""
    print("\n=== Testing Graph Conversion ===")
    
    processor = GraphProcessor()
    
    # Create NetworkX graph
    nx_graph = nx.karate_club_graph()
    print(f"✓ Created NetworkX graph: {nx_graph.number_of_nodes()} nodes, {nx_graph.number_of_edges()} edges")
    
    try:
        # Convert to igraph
        ig_graph = processor.networkx_to_igraph(nx_graph)
        print(f"✓ Converted to igraph: {ig_graph.vcount()} nodes, {ig_graph.ecount()} edges")
        
        # Convert back to NetworkX
        nx_graph2 = processor.igraph_to_networkx(ig_graph)
        print(f"✓ Converted back to NetworkX: {nx_graph2.number_of_nodes()} nodes, {nx_graph2.number_of_edges()} edges")
        
        # Verify
        if nx_graph.number_of_nodes() == nx_graph2.number_of_nodes():
            print("✓ Conversion preserved node count")
        else:
            print("✗ Node count mismatch")
            
        return True
        
    except Exception as e:
        print(f"✗ Conversion failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 60)
    print("Model Executor Test Suite")
    print("=" * 60)
    
    results = []
    
    # Test 1: Graph conversion
    results.append(("Graph Conversion", test_graph_conversion()))
    
    # Test 2: Model discovery
    test_model_discovery()
    
    # Test 3: Baseline execution
    results.append(("Baseline Execution", test_baseline_execution()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    for test_name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(result[1] for result in results)
    print("\n" + ("All tests passed!" if all_passed else "Some tests failed"))
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
