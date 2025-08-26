"""
Dismantling Engine for FINDER_ND
Executes network dismantling using trained GraphDQN models
"""

import networkx as nx
import numpy as np
import time
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)

class DismantlingEngine:
    def __init__(self, model_manager):
        self.model_manager = model_manager
    
    def dismantle(self, 
                  graph: nx.Graph, 
                  model_name: str = None,
                  step_ratio: float = 0.0025,
                  max_iterations: int = 1000) -> Dict[str, Any]:
        """
        Execute network dismantling using GraphDQN model
        
        Args:
            graph: NetworkX graph to dismantle
            model_name: Name of model to use
            step_ratio: Step ratio for batch dismantling
            max_iterations: Maximum iterations to prevent infinite loops
            
        Returns:
            Dictionary containing dismantling results
        """
        
        start_time = time.time()
        
        # Get model
        model = self.model_manager.get_model(model_name)
        
        # Preprocess graph
        original_graph = graph.copy()
        processed_graph = self._preprocess_graph(graph)
        
        logger.info(f"Starting dismantling: {processed_graph.number_of_nodes()} nodes, "
                   f"{processed_graph.number_of_edges()} edges")
        
        # Execute dismantling
        try:
            solution, metrics = self._execute_dismantling(
                model, processed_graph, step_ratio, max_iterations
            )
            
            # Calculate final metrics
            final_metrics = self._calculate_metrics(original_graph, solution)
            
            execution_time = time.time() - start_time
            
            result = {
                'solution': solution,
                'metrics': final_metrics,
                'execution_time': execution_time,
                'iterations': metrics.get('iterations', 0),
                'original_graph': {
                    'nodes': original_graph.number_of_nodes(),
                    'edges': original_graph.number_of_edges()
                },
                'model_used': model_name or 'default'
            }
            
            logger.info(f"Dismantling completed in {execution_time:.2f}s, "
                       f"removed {len(solution)} nodes")
            
            return result
            
        except Exception as e:
            logger.error(f"Dismantling failed: {e}")
            raise
    
    def _preprocess_graph(self, graph: nx.Graph) -> nx.Graph:
        """Preprocess graph for model input"""
        
        # Create a copy
        g = graph.copy()
        
        # Remove self-loops
        g.remove_edges_from(nx.selfloop_edges(g))
        
        # Ensure consecutive integer node labels starting from 0
        if not all(isinstance(node, int) for node in g.nodes()):
            mapping = {node: i for i, node in enumerate(sorted(g.nodes()))}
            g = nx.relabel_nodes(g, mapping)
        else:
            nodes = sorted(g.nodes())
            if nodes != list(range(len(nodes))):
                mapping = {node: i for i, node in enumerate(nodes)}
                g = nx.relabel_nodes(g, mapping)
        
        return g
    
    def _execute_dismantling(self, 
                           model, 
                           graph: nx.Graph, 
                           step_ratio: float,
                           max_iterations: int) -> Tuple[List[int], Dict]:
        """Execute the actual dismantling process"""
        
        # Calculate step size
        step = max(int(step_ratio * graph.number_of_nodes()), 1)
        
        # Use model's EvaluateRealData method
        solution, solution_time = model.EvaluateRealData(
            test_graph=graph,
            stepRatio=step_ratio
        )
        
        metrics = {
            'iterations': len(solution),
            'solution_time': solution_time,
            'step_size': step
        }
        
        return solution, metrics
    
    def _calculate_metrics(self, original_graph: nx.Graph, solution: List[int]) -> Dict[str, Any]:
        """Calculate comprehensive metrics for the dismantling solution"""
        
        # Create a copy for simulation
        g = original_graph.copy()
        
        # Track metrics during removal
        removal_sequence = []
        largest_cc_sizes = []
        
        original_largest_cc = len(max(nx.connected_components(g), key=len))
        
        for i, node in enumerate(solution):
            if node in g:
                g.remove_node(node)
                
                if g.number_of_nodes() > 0:
                    largest_cc = len(max(nx.connected_components(g), key=len))
                else:
                    largest_cc = 0
                
                removal_sequence.append({
                    'step': i + 1,
                    'node_removed': node,
                    'remaining_nodes': g.number_of_nodes(),
                    'remaining_edges': g.number_of_edges(),
                    'largest_cc_size': largest_cc,
                    'largest_cc_ratio': largest_cc / original_largest_cc if original_largest_cc > 0 else 0
                })
                
                largest_cc_sizes.append(largest_cc)
        
        # Calculate final metrics
        final_largest_cc = largest_cc_sizes[-1] if largest_cc_sizes else original_largest_cc
        
        # Calculate robustness (area under the curve)
        robustness = np.trapz(largest_cc_sizes) / (len(largest_cc_sizes) * original_largest_cc) if largest_cc_sizes else 1.0
        
        return {
            'nodes_removed': len(solution),
            'removal_ratio': len(solution) / original_graph.number_of_nodes(),
            'final_largest_cc': final_largest_cc,
            'largest_cc_reduction': (original_largest_cc - final_largest_cc) / original_largest_cc,
            'robustness': robustness,
            'removal_sequence': removal_sequence,
            'largest_cc_evolution': largest_cc_sizes
        }
    
    def evaluate_solution(self, graph: nx.Graph, solution: List[int]) -> Dict[str, Any]:
        """Evaluate a given dismantling solution"""
        
        return self._calculate_metrics(graph, solution)
    
    def compare_with_baselines(self, graph: nx.Graph, solution: List[int]) -> Dict[str, Any]:
        """Compare solution with baseline methods"""
        
        baselines = {}
        
        # High Degree Attack (HDA)
        hda_solution = self._high_degree_attack(graph)
        baselines['HDA'] = self._calculate_metrics(graph, hda_solution)
        
        # High Betweenness Attack (HBA)
        hba_solution = self._high_betweenness_attack(graph)
        baselines['HBA'] = self._calculate_metrics(graph, hba_solution)
        
        # Random attack
        random_solution = self._random_attack(graph, len(solution))
        baselines['Random'] = self._calculate_metrics(graph, random_solution)
        
        # Our solution
        our_metrics = self._calculate_metrics(graph, solution)
        
        return {
            'our_solution': our_metrics,
            'baselines': baselines,
            'comparison': {
                'robustness_improvement': {
                    'vs_HDA': (baselines['HDA']['robustness'] - our_metrics['robustness']) / baselines['HDA']['robustness'],
                    'vs_HBA': (baselines['HBA']['robustness'] - our_metrics['robustness']) / baselines['HBA']['robustness'],
                    'vs_Random': (baselines['Random']['robustness'] - our_metrics['robustness']) / baselines['Random']['robustness']
                }
            }
        }
    
    def _high_degree_attack(self, graph: nx.Graph) -> List[int]:
        """Implement High Degree Attack baseline"""
        g = graph.copy()
        solution = []
        
        while g.number_of_edges() > 0:
            # Find node with highest degree
            degrees = dict(g.degree())
            if not degrees:
                break
            
            max_degree_node = max(degrees, key=degrees.get)
            solution.append(max_degree_node)
            g.remove_node(max_degree_node)
        
        return solution
    
    def _high_betweenness_attack(self, graph: nx.Graph) -> List[int]:
        """Implement High Betweenness Attack baseline"""
        g = graph.copy()
        solution = []
        
        while g.number_of_edges() > 0:
            # Calculate betweenness centrality
            betweenness = nx.betweenness_centrality(g)
            if not betweenness:
                break
            
            max_betweenness_node = max(betweenness, key=betweenness.get)
            solution.append(max_betweenness_node)
            g.remove_node(max_betweenness_node)
        
        return solution
    
    def _random_attack(self, graph: nx.Graph, num_nodes: int) -> List[int]:
        """Implement random attack baseline"""
        nodes = list(graph.nodes())
        np.random.shuffle(nodes)
        return nodes[:num_nodes]