"""
Model Executor Service
Handles execution of models from different projects/environments via subprocess
"""

import subprocess
import json
import tempfile
import os
import logging
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import pickle

logger = logging.getLogger(__name__)

class ModelExecutor:
    """
    Executes dismantling models from different projects/environments.
    Each model type has its own execution strategy.
    """
    
    def __init__(self, config_path: Optional[str] = None):
        self.base_dir = Path(__file__).parent.parent.parent.parent  # Go up to GD2026
        
        # Load configuration
        if config_path is None:
            config_path = Path(__file__).parent.parent / 'config' / 'model_environments.json'
        
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
            
            # Build model types from config
            self.model_types = {}
            for model_type, model_config in config['model_types'].items():
                interface_path = self.base_dir / model_config['interface'].lstrip('../')
                self.model_types[model_type] = {
                    'name': model_config['name'],
                    'interface': interface_path,
                    'conda_env': model_config.get('conda_env'),
                    'python_path': model_config.get('python_path'),
                    'graph_format': model_config['graph_format'],
                    'parameters': model_config.get('parameters', {})
                }
            
            self.conda_settings = config.get('conda_settings', {})
            logger.info(f"Loaded model configuration from {config_path}")
        else:
            # Fallback to hardcoded config
            logger.warning(f"Config file not found at {config_path}, using defaults")
            self.model_types = {
                'finder': {
                    'interface': self.base_dir / 'FINDER' / 'python_interface.py',
                    'conda_env': 'tf_py37',
                    'graph_format': 'networkx'
                },
                'mind': {
                    'interface': self.base_dir / 'MIND-ND' / 'python_interface.py',
                    'conda_env': 'torch_py38',
                    'graph_format': 'igraph'
                },
                'baseline': {
                    'interface': self.base_dir / 'baselines' / 'baseline_interface.py',
                    'conda_env': 'torch_py38',
                    'graph_format': 'igraph'
                }
            }
            self.conda_settings = {'use_conda': True, 'fallback_to_system_python': True}
    
    def execute_model(self, 
                     graph,
                     model_type: str,
                     model_path: str = None,
                     **kwargs) -> Tuple[List[int], float]:
        """
        Execute a model and return results.
        
        Args:
            graph: Graph object (NetworkX or igraph)
            model_type: Type of model ('finder', 'mind', 'baseline')
            model_path: Path to model checkpoint/config (optional for baselines)
            **kwargs: Additional parameters (step_ratio, threshold, method, etc.)
        
        Returns:
            (removals, score) - List of removed nodes and robustness score
        """
        if model_type not in self.model_types:
            raise ValueError(f"Unknown model type: {model_type}")
        
        model_config = self.model_types[model_type]
        
        # Create temporary files for input/output
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.pkl', delete=False) as graph_file:
            graph_path = graph_file.name
            pickle.dump(graph, graph_file)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as result_file:
            result_path = result_file.name
        
        try:
            # Build command
            cmd = self._build_command(
                model_type=model_type,
                model_config=model_config,
                model_path=model_path,
                graph_path=graph_path,
                result_path=result_path,
                **kwargs
            )
            
            # Execute
            logger.info(f"Executing {model_type} model: {' '.join(cmd)}")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode != 0:
                logger.error(f"Model execution failed: {result.stderr}")
                raise RuntimeError(f"Model execution failed: {result.stderr}")
            
            # Parse results
            with open(result_path, 'r') as f:
                results = json.load(f)
            
            removals = results.get('removals', [])
            score = results.get('robustness', results.get('score', 0.0))
            lcc_sizes = results.get('lcc_sizes', results.get('MaxCCList', []))
            
            return removals, score, lcc_sizes
            
        finally:
            # Cleanup temporary files
            for path in [graph_path, result_path]:
                if os.path.exists(path):
                    try:
                        os.unlink(path)
                    except:
                        pass
    
    def _build_command(self,
                      model_type: str,
                      model_config: Dict,
                      model_path: str,
                      graph_path: str,
                      result_path: str,
                      **kwargs) -> List[str]:
        """Build the command to execute the model interface"""
        
        interface_path = str(model_config['interface'])
        
        # Base command
        if model_config['conda_env']:
            # Use conda run to execute in specific environment
            cmd = [
                'conda', 'run', '-n', model_config['conda_env'],
                'python', interface_path
            ]
        else:
            # Use current Python environment
            cmd = ['python', interface_path]
        
        # Add common arguments
        cmd.extend([
            '--graph_file', graph_path,
            '--out_file', result_path
        ])
        
        # Add model path if provided (not for baseline, where model_path is the method name)
        if model_path and model_type != 'baseline':
            cmd.extend(['--model_path', model_path])
        
        # Add model-specific parameters
        if model_type == 'finder':
            step_ratio = kwargs.get('step_ratio', 0.01)
            cmd.extend(['--step_ratio', str(step_ratio)])
        
        elif model_type == 'mind':
            threshold = kwargs.get('threshold', 0.1)
            cmd.extend(['--threshold', str(threshold)])
            max_steps = kwargs.get('max_steps')
            if max_steps not in (None, '', 'None', 'null'):
                cmd.extend(['--max_steps', str(max_steps)])
        
        elif model_type == 'baseline':
            # method is passed via model_path (the selected model name)
            if model_path:
                cmd.extend(['--method', model_path])
            threshold = kwargs.get('threshold', 0.1)
            cmd.extend(['--threshold', str(threshold)])
            max_steps = kwargs.get('max_steps')
            if max_steps not in (None, '', 'None', 'null'):
                cmd.extend(['--max_steps', str(max_steps)])
        
        return cmd
    
    def list_available_models(self, model_type: str) -> List[Dict[str, Any]]:
        """
        List available models for a given type.
        
        Args:
            model_type: Type of model ('finder', 'mind', 'baseline')
        
        Returns:
            List of model information dictionaries
        """
        if model_type == 'finder':
            return self._list_finder_models()
        elif model_type == 'mind':
            return self._list_mind_models()
        elif model_type == 'baseline':
            return self._list_baseline_methods()
        else:
            return []
    
    def _list_finder_models(self) -> List[Dict[str, Any]]:
        """List available FINDER models"""
        models = []
        finder_dir = self.base_dir / 'FINDER' / 'code' / 'FINDER' / 'models'
        
        if not finder_dir.exists():
            return models
        
        for model_dir in finder_dir.iterdir():
            if model_dir.is_dir():
                ckpt_files = list(model_dir.glob('*.ckpt*'))
                if ckpt_files:
                    models.append({
                        'name': model_dir.name,
                        'type': 'finder',
                        'path': str(model_dir),
                        'checkpoint_files': [str(f) for f in ckpt_files]
                    })
        
        return models
    
    def _list_mind_models(self) -> List[Dict[str, Any]]:
        """List available MIND-ND models"""
        models = []
        mind_dir = self.base_dir / 'MIND-ND' / 'saved' / 'hgnn_v4'
        
        if not mind_dir.exists():
            return models
        
        # Recursively find .ckpt files
        for ckpt_file in mind_dir.rglob('*.ckpt'):
            models.append({
                'name': f"{ckpt_file.parent.name}/{ckpt_file.name}",
                'type': 'mind',
                'path': str(ckpt_file.resolve()),  # full absolute path for execution
                'checkpoint_files': [str(ckpt_file.resolve())]
            })
        
        return models
    
    def _list_baseline_methods(self) -> List[Dict[str, Any]]:
        """List available baseline methods"""
        # These are algorithmic methods, not trained models
        methods = [
            'Random', 'Degree', 'Betweenness', 'PageRank', 
            'CI', 'CoreHD', 'Spectral', 'BPD'
        ]
        
        return [
            {
                'name': method,
                'type': 'baseline',
                'path': method,  # Method name is the "path"
                'checkpoint_files': []
            }
            for method in methods
        ]


class AsyncModelExecutor(ModelExecutor):
    """
    Async version of ModelExecutor for non-blocking execution.
    Useful for web server environments.
    """
    
    def __init__(self):
        super().__init__()
        self.running_jobs = {}
    
    async def execute_model_async(self, 
                                  job_id: str,
                                  model_type: str,
                                  model_path: str,
                                  graph,
                                  **kwargs):
        """
        Execute model asynchronously.
        Results can be retrieved later using job_id.
        """
        import asyncio
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        future = loop.run_in_executor(
            None,
            self.execute_model,
            model_type,
            model_path,
            graph,
            **kwargs
        )
        
        self.running_jobs[job_id] = future
        return job_id
    
    async def get_result(self, job_id: str):
        """Get result of async job"""
        if job_id not in self.running_jobs:
            raise ValueError(f"Job {job_id} not found")
        
        return await self.running_jobs[job_id]
