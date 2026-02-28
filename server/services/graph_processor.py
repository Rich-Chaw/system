"""
Graph Processing utilities for FINDER_ND server
Handles graph input/output and format conversion
"""

import networkx as nx
import numpy as np
import json
import logging
from typing import Dict, List, Union, Any

logger = logging.getLogger(__name__)

class GraphProcessor:
    def __init__(self):
        self.supported_formats = ['edgelist', 'adjacency_list', 'json', 'gml', 'graphml']
    
    def parse_graph(self, graph_data: Union[Dict, List, str]) -> nx.Graph:
        """Parse graph from various input formats"""
        
        if isinstance(graph_data, dict):
            return self._parse_dict_graph(graph_data)
        elif isinstance(graph_data, list):
            return self._parse_edge_list(graph_data)
        elif isinstance(graph_data, str):
            return self._parse_string_graph(graph_data)
        else:
            raise ValueError(f"Unsupported graph data type: {type(graph_data)}")
    
    def _parse_dict_graph(self, data: Dict) -> nx.Graph:
        """Parse graph from dictionary format"""
        
        if 'edges' in data:
            # Handle edges-only format (from manual input)
            G = nx.Graph()
            
            # Add edges
            if isinstance(data['edges'], list):
                if data['edges'] and isinstance(data['edges'][0], dict):
                    # Edges with attributes
                    for edge_data in data['edges']:
                        source = edge_data.get('source', edge_data.get('from'))
                        target = edge_data.get('target', edge_data.get('to'))
                        weight = edge_data.get('weight', 1.0)
                        G.add_edge(source, target, weight=weight)
                else:
                    # Simple edge list
                    for edge in data['edges']:
                        if len(edge) >= 2:
                            G.add_edge(edge[0], edge[1])
            
            # Add nodes if specified
            if 'nodes' in data and isinstance(data['nodes'], list):
                if data['nodes'] and isinstance(data['nodes'][0], dict):
                    # Nodes with attributes
                    for node_data in data['nodes']:
                        node_id = node_data.get('id', node_data.get('node'))
                        G.add_node(node_id, **{k: v for k, v in node_data.items() if k not in ['id', 'node']})
                else:
                    # Simple node list
                    G.add_nodes_from(data['nodes'])
            
            return G
            
        elif 'adjacency_matrix' in data:
            # Adjacency matrix format
            adj_matrix = np.array(data['adjacency_matrix'])
            return nx.from_numpy_array(adj_matrix)
            
        elif 'adjacency_list' in data:
            # Adjacency list format
            return nx.from_dict_of_lists(data['adjacency_list'])
            
        else:
            raise ValueError("Unrecognized dictionary graph format")
    
    def _parse_edge_list(self, edges: List) -> nx.Graph:
        """Parse graph from edge list"""
        G = nx.Graph()
        
        for edge in edges:
            if isinstance(edge, (list, tuple)) and len(edge) >= 2:
                if len(edge) == 2:
                    G.add_edge(edge[0], edge[1])
                else:
                    # Edge with weight
                    G.add_edge(edge[0], edge[1], weight=edge[2])
            else:
                raise ValueError(f"Invalid edge format: {edge}")
        
        return G
    
    def _parse_string_graph(self, data: str) -> nx.Graph:
        """Parse graph from string (JSON or edge list)"""
        try:
            # Try JSON first
            json_data = json.loads(data)
            return self.parse_graph(json_data)
        except json.JSONDecodeError:
            # Try as edge list text
            lines = data.strip().split('\n')
            edges = []
            
            for line in lines:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split()
                    if len(parts) >= 2:
                        try:
                            u, v = int(parts[0]), int(parts[1])
                            edges.append((u, v))
                        except ValueError:
                            # Non-integer nodes
                            edges.append((parts[0], parts[1]))
            
            return self._parse_edge_list(edges)
    
    def load_from_file(self, filepath: str) -> nx.Graph:
        """Load graph from file"""
        
        # Determine format from extension
        if filepath.endswith('.gml'):
            return nx.read_gml(filepath)
        elif filepath.endswith('.graphml'):
            return nx.read_graphml(filepath)
        elif filepath.endswith('.json'):
            with open(filepath, 'r') as f:
                data = json.load(f)
            return self.parse_graph(data)
        else:
            # Default to edge list
            return nx.read_edgelist(filepath, nodetype=int)
    
    def graph_to_dict(self, graph: nx.Graph) -> Dict[str, Any]:
        """Convert NetworkX graph to dictionary format"""
        
        nodes = []
        for node in graph.nodes(data=True):
            node_data = {'id': node[0]}
            node_data.update(node[1])  # Add attributes
            nodes.append(node_data)
        
        edges = []
        for edge in graph.edges(data=True):
            edge_data = {
                'source': edge[0],
                'target': edge[1]
            }
            edge_data.update(edge[2])  # Add attributes
            edges.append(edge_data)
        
        return {
            'nodes': nodes,
            'edges': edges,
            'info': {
                'num_nodes': graph.number_of_nodes(),
                'num_edges': graph.number_of_edges(),
                'is_connected': nx.is_connected(graph),
                'density': nx.density(graph)
            }
        }
    
    def validate_graph(self, graph: nx.Graph) -> Dict[str, Any]:
        """Validate graph and return comprehensive statistics"""
        
        if graph.number_of_nodes() == 0:
            raise ValueError("Graph has no nodes")
        
        if graph.number_of_edges() == 0:
            logger.warning("Graph has no edges")
        
        # Check for self-loops
        self_loops = list(nx.selfloop_edges(graph))
        if self_loops:
            logger.warning(f"Graph contains {len(self_loops)} self-loops")
        
        # Check connectivity
        is_connected = nx.is_connected(graph)
        components = list(nx.connected_components(graph))
        if not is_connected:
            logger.info(f"Graph has {len(components)} connected components")
        
        # Calculate basic statistics
        num_nodes = graph.number_of_nodes()
        num_edges = graph.number_of_edges()
        density = nx.density(graph)
        avg_degree = sum(dict(graph.degree()).values()) / num_nodes if num_nodes > 0 else 0
        
        # Calculate advanced statistics for connected graphs
        clustering_coefficient = None
        average_path_length = None
        degree_distribution = None
        
        try:
            # Clustering coefficient
            clustering_coefficient = nx.average_clustering(graph)
            
            # Average path length (only for connected graphs)
            if is_connected:
                average_path_length = nx.average_shortest_path_length(graph)
            
            # Degree distribution
            degrees = [d for n, d in graph.degree()]
            degree_distribution = degrees
            
        except Exception as e:
            logger.warning(f"Could not calculate advanced statistics: {e}")
        
        return {
            'valid': True,
            'num_nodes': num_nodes,
            'num_edges': num_edges,
            'is_connected': is_connected,
            'density': density,
            'self_loops': len(self_loops),
            'avg_degree': avg_degree,
            'clustering_coefficient': clustering_coefficient,
            'average_path_length': average_path_length,
            'degree_distribution': degree_distribution,
            'num_components': len(components),
            'largest_component_size': len(max(components, key=len)) if components else 0
        }
    
    def generate_preset_graph(self, graph_type: str, parameters: Dict[str, Any]) -> nx.Graph:
        """Generate preset graphs using NetworkX models"""
        
        # Validate graph type
        supported_types = ['barabasi_albert', 'erdos_renyi']
        if graph_type not in supported_types:
            raise ValueError(f"Unsupported graph type: {graph_type}. Supported types: {supported_types}")
        
        # Generate graph based on type
        if graph_type == 'barabasi_albert':
            return self._generate_barabasi_albert(parameters)
        elif graph_type == 'erdos_renyi':
            return self._generate_erdos_renyi(parameters)
        else:
            raise ValueError(f"Unknown graph type: {graph_type}")
    
    def _generate_barabasi_albert(self, parameters: Dict[str, Any]) -> nx.Graph:
        """Generate Barabási-Albert graph"""
        
        # Validate parameters
        if 'n' not in parameters:
            raise ValueError("Parameter 'n' (number of nodes) is required for Barabási-Albert graph")
        if 'm' not in parameters:
            raise ValueError("Parameter 'm' (number of edges to attach) is required for Barabási-Albert graph")
        
        n = parameters['n']
        m = parameters['m']
        
        # Validate parameter ranges
        if not isinstance(n, int) or n <= 0:
            raise ValueError("Parameter 'n' must be a positive integer")
        if not isinstance(m, int) or m <= 0:
            raise ValueError("Parameter 'm' must be a positive integer")
        if m >= n:
            raise ValueError("Parameter 'm' must be less than 'n'")
        
        # Additional validation for BA model
        if n < 2:
            raise ValueError("Barabási-Albert graph requires at least 2 nodes")
        if m > n - 1:
            raise ValueError("Parameter 'm' cannot exceed n-1")
        
        try:
            # Generate the graph
            graph = nx.barabasi_albert_graph(n, m)
            logger.info(f"Generated Barabási-Albert graph: n={n}, m={m}, "
                       f"nodes={graph.number_of_nodes()}, edges={graph.number_of_edges()}")
            return graph
        except Exception as e:
            raise ValueError(f"Failed to generate Barabási-Albert graph: {str(e)}")
    
    def _generate_erdos_renyi(self, parameters: Dict[str, Any]) -> nx.Graph:
        """Generate Erdős-Rényi graph"""
        
        # Validate parameters
        if 'n' not in parameters:
            raise ValueError("Parameter 'n' (number of nodes) is required for Erdős-Rényi graph")
        if 'p' not in parameters:
            raise ValueError("Parameter 'p' (edge probability) is required for Erdős-Rényi graph")
        
        n = parameters['n']
        p = parameters['p']
        
        # Validate parameter ranges
        if not isinstance(n, int) or n <= 0:
            raise ValueError("Parameter 'n' must be a positive integer")
        if not isinstance(p, (int, float)) or p < 0 or p > 1:
            raise ValueError("Parameter 'p' must be a number between 0 and 1")
        
        # Additional validation for ER model
        if n < 1:
            raise ValueError("Erdős-Rényi graph requires at least 1 node")
        
        try:
            # Generate the graph
            graph = nx.erdos_renyi_graph(n, p)
            logger.info(f"Generated Erdős-Rényi graph: n={n}, p={p}, "
                       f"nodes={graph.number_of_nodes()}, edges={graph.number_of_edges()}")
            return graph
        except Exception as e:
            raise ValueError(f"Failed to generate Erdős-Rényi graph: {str(e)}")

    def preprocess_for_model(self, graph: nx.Graph) -> nx.Graph:
        """Preprocess graph for model input"""
        
        # Remove self-loops
        graph = graph.copy()
        graph.remove_edges_from(nx.selfloop_edges(graph))
        
        # Ensure nodes are integers starting from 0
        if not all(isinstance(node, int) for node in graph.nodes()):
            mapping = {node: i for i, node in enumerate(graph.nodes())}
            graph = nx.relabel_nodes(graph, mapping)
        
        # Ensure consecutive node numbering
        nodes = sorted(graph.nodes())
        if nodes != list(range(len(nodes))):
            mapping = {node: i for i, node in enumerate(nodes)}
            graph = nx.relabel_nodes(graph, mapping)
        
        return graph