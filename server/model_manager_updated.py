"""
Model Manager for FINDER_ND GraphDQN models
Handles loading and managing trained models
"""

import os
import sys
import glob
import logging
import subprocess
from typing import Dict, List, Optional
import io

# Set environment variables for UTF-8 encoding
os.environ['PYTHONIOENCODING'] = 'utf-8'
if sys.platform.startswith('win'):
    os.environ['PYTHONLEGACYWINDOWSSTDIO'] = '0'

# Set UTF-8 encoding for stdout/stderr to handle Unicode characters
if sys.platform.startswith('win'):
    # On Windows, ensure UTF-8 encoding
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
    except (AttributeError, io.UnsupportedOperation):
        # If already wrapped or not supported, continue
        pass

# Add GraphDQN path
from config import Config
FINDER_ND_PATH = Config.FINDER_ND_DIR
FINDER_CODE_PATH = Config.FINDER_CODE_DIR 
if FINDER_ND_PATH not in sys.path:
    sys.path.insert(0, FINDER_ND_PATH)
if FINDER_CODE_PATH not in sys.path:
    sys.path.insert(0, FINDER_CODE_PATH)

logger = logging.getLogger(__name__)

# Try to import GraphDQN with better error handling
GraphDQN = None
try:
    # First check if extensions are compiled
    required_extensions = ['GraphDQN', 'graph', 'mvc_env', 'utils', 'nstep_replay_mem', 'PrepareBatchGraph']
    missing_extensions = []
    
    for ext in required_extensions:
        try:
            __import__(ext)
        except ImportError:
            missing_extensions.append(ext)
    
    if missing_extensions:
        logger.error(f"Missing compiled extensions: {missing_extensions}")
        logger.error("Please compile the Cython extensions first AND Check the path")
        logger.error(f"cd {FINDER_ND_PATH}")
        logger.error("python setup.py build_ext --inplace")
        raise ImportError(f"Missing extensions: {missing_extensions}")
    
    # Now try to import GraphDQN
    from GraphDQN import GraphDQN
    logger.info("Successfully imported GraphDQN")
    
except ImportError as e:
    logger.error(f"Failed to import GraphDQN: {e}")
    logger.error("Make sure to compile the Cython extensions first")
    GraphDQN = None

logger = logging.getLogger(__name__)

class ModelManager:
    def __init__(self):
        self.models_dir = './AAA-NetDQN/code/FINDER/models'
        self.loaded_models: Dict[str, GraphDQN] = {}
        self.model_configs = self._discover_models()
        
    def _discover_models(self) -> Dict[str, dict]:
        """Discover available model files to self.model_configs"""
        configs = {}
        
        if not os.path.exists(self.models_dir):
            logger.warning(f"Models directory not found: {self.models_dir}")
            return configs

        # Look for model directories
        for item in os.listdir(self.models_dir):
            model_path = os.path.join(self.models_dir, item)
            if os.path.isdir(model_path):
                # Look for checkpoint files or config.json
                ckpt_files = glob.glob(os.path.join(model_path, "*.ckpt*"))
                config_file = os.path.join(model_path, "config.json")
                
                if ckpt_files or os.path.exists(config_file):
                    # Parse model configuration
                    config = self._parse_model_config(item, model_path)
                    config['checkpoint_files'] = ckpt_files
                    config['path'] = model_path
                    config['has_config'] = os.path.exists(config_file)
                    configs[item] = config
                    
        logger.info(f"Discovered {len(configs)} model configurations")
        return configs
    
    def _parse_model_config(self, dir_name: str, model_path: str) -> dict:
        """Parse model configuration from directory name and config file
            dir_name: BA_nrange_30_50_m_2 or graphSage_BA_nrange_30_50_m_4_SOTA
        """
        parts = dir_name.split('_')
        
        model_config = {
            'name': dir_name,
            'g_type': 'BA',  # default
            'g_params': {
                'nrange': '30_50',
                'm': 2
            },
            'gnn_model': 'graphSage',
            'model_type': 'standard',  # standard, SOTA, moe, advance
            'is_sota': 'SOTA' in dir_name
        }
        
        # Try to load config.json if it exists
        config_file = os.path.join(model_path, 'config.json')
        if os.path.exists(config_file):
            try:
                import json
                with open(config_file, 'r') as f:
                    file_config = json.load(f)
                    # Extract relevant info from config file
                    if 'model_config' in file_config:
                        mc = file_config['model_config']
                        if 'g_type' in mc:
                            model_config['g_type'] = mc['g_type']
                        if 'g_params' in mc:
                            model_config['g_params'].update(mc['g_params'])
                        if 'gnn_model' in mc:
                            model_config['gnn_model'] = mc['gnn_model']
                    logger.info(f"Loaded config from {config_file}")
            except Exception as e:
                logger.warning(f"Failed to load config file {config_file}: {e}")
        
        # Parse from directory name as fallback or supplement
        try:
            # Extract GNN model type
            if parts[0] in ['graphSage', 'GCN', 'GAT', 'GIN']:
                model_config['gnn_model'] = parts[0]
            
            # Extract graph type
            for part in parts:
                if part in ['BA', 'ER', 'PL', 'SW', 'WS']:
                    model_config['g_type'] = part
                    break
            
            # Extract nrange
            if 'nrange' in parts:
                idx = parts.index('nrange')
                if idx + 2 < len(parts):
                    model_config['g_params']['nrange'] = f"{parts[idx+1]}_{parts[idx+2]}"
            
            # Extract m parameter
            if 'm' in parts:
                idx = parts.index('m')
                if idx + 1 < len(parts):
                    try:
                        # Handle SOTA suffix
                        m_val = parts[idx+1].replace('SOTA', '')
                        model_config['g_params']['m'] = int(m_val)
                    except ValueError:
                        pass
            
            # Determine model type
            if 'SOTA' in dir_name:
                model_config['model_type'] = 'SOTA'
            elif 'moe' in dir_name.lower():
                model_config['model_type'] = 'moe'
            elif 'advance' in dir_name.lower():
                model_config['model_type'] = 'advance'
                
        except (ValueError, IndexError) as e:
            logger.warning(f"Error parsing config for {dir_name}: {e}")
            
        return model_config
    
    def get_available_models(self) -> List[dict]:
        """Get list of available models"""
        return [
            {
                'name': name,
                'config': config,
                'loaded': name in self.loaded_models
            }
            for name, config in self.model_configs.items()
        ]
    
    def load_model(self, model_name: str, gnn_model: str = None) -> Optional[GraphDQN]:
        """Load a specific model
            model_name: e.g. 'BA_nrange_30_50_m_1' or 'graphSage_BA_nrange_30_50_m_4_SOTA'
            gnn_model: Override GNN model type (optional)
        """
        if GraphDQN is None:
            raise ImportError("GraphDQN not available - compile Cython extensions first")
            
        if model_name in self.loaded_models:
            logger.info(f"Model {model_name} already loaded, returning cached instance")
            return self.loaded_models[model_name]
        
        if model_name not in self.model_configs:
            raise ValueError(f"Model {model_name} not found in discovered models")
        
        config = self.model_configs[model_name]
        
        try:
            # Use provided gnn_model or fall back to config
            if gnn_model is None:
                gnn_model = config.get('gnn_model', 'graphSage')
            
            g_params = config['g_params']
            g_type = config['g_type']
            save_model_dir = config['path']
            is_sota = config.get('is_sota', False)

            logger.info(f'Loading model: {model_name}')
            logger.info(f'  g_type={g_type}, g_params={g_params}')
            logger.info(f'  gnn_model={gnn_model}, save_dir={save_model_dir}')
            logger.info(f'  is_SOTA={is_sota}')
            
            # Handle encoding issues by capturing output
            import contextlib
            from io import StringIO
            
            captured_output = StringIO()
            
            try:
                with contextlib.redirect_stdout(captured_output), contextlib.redirect_stderr(captured_output):
                    # Initialize GraphDQN
                    dqn = GraphDQN(
                        g_type,
                        g_params=g_params,
                        gnn_model=gnn_model,
                        save_model_dir=save_model_dir
                    )

                    # Load model checkpoint
                    if is_sota:
                        # SOTA models use specific iteration (78000)
                        logger.info("Loading SOTA model with iter=78000")
                        best_model = dqn.findModel(iter=78000)
                    else:
                        # Find best checkpoint automatically
                        best_model = dqn.findModel()
                    
                    logger.info(f"Loading checkpoint: {best_model}")
                    dqn.LoadModel(best_model)
                
                # Log captured output safely
                output = captured_output.getvalue()
                if output:
                    safe_output = output.encode('ascii', errors='replace').decode('ascii')
                    logger.debug(f"Model loading output: {safe_output}")
                    
            except UnicodeEncodeError as e:
                logger.warning(f"Encoding issue during model loading: {e}")
                # Try without capturing output
                dqn = GraphDQN(
                    g_type,
                    g_params=g_params,
                    gnn_model=gnn_model,
                    save_model_dir=save_model_dir
                )
                
                if is_sota:
                    best_model = dqn.findModel(iter=78000)
                else:
                    best_model = dqn.findModel()
                    
                dqn.LoadModel(best_model)
            
            self.loaded_models[model_name] = dqn
            logger.info(f"Successfully loaded model: {model_name}")
            
            return dqn
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise
    
    def get_model(self, model_name: str = None, gnn_model: str = None) -> GraphDQN:
        """Get a model, loading if necessary
            model_name: Name of the model to load (optional, uses default if None)
            gnn_model: Override GNN model type (optional)
        """
        if model_name is None or model_name == 'default':
            # Use first available model as default
            if not self.model_configs:
                raise ValueError("No models available")
            model_name = list(self.model_configs.keys())[0]

        return self.load_model(model_name, gnn_model=gnn_model)
    
    def unload_model(self, model_name: str):
        """Unload a model to free memory"""
        if model_name in self.loaded_models:
            del self.loaded_models[model_name]
            logger.info(f"Unloaded model: {model_name}")
    
    def unload_all(self):
        """Unload all models"""
        self.loaded_models.clear()
        logger.info("Unloaded all models")
    
    def get_model_info(self, model_name: str) -> Optional[dict]:
        """Get information about a specific model without loading it"""
        return self.model_configs.get(model_name)
    
    def dismantle_graph(self, graph, model_name: str = None, step_ratio: float = 0.01, 
                       strategy_id: int = 0, reInsertStep: float = 0.001):
        """Dismantle a NetworkX graph using a loaded model
        
        Args:
            graph: NetworkX graph to dismantle
            model_name: Name of model to use (optional, uses default if None)
            step_ratio: Step ratio for dismantling (default: 0.01)
            strategy_id: Strategy ID for evaluation (default: 0)
            reInsertStep: Reinsertion step for evaluation (default: 0.001)
            
        Returns:
            tuple: (solution, score, MaxCCList)
        """
        import tempfile
        
        # Get or load model
        dqn = self.get_model(model_name)
        
        # Create temporary solution file
        temp_sol_fd, temp_sol_file = tempfile.mkstemp(suffix='_sol.txt')
        os.close(temp_sol_fd)
        
        try:
            # Evaluate and dismantle
            g_test = graph.copy()
            sol, sol_time = dqn.EvaluateRealData(g_test, temp_sol_file, step_ratio)
            score, MaxCCList, solution = dqn.EvaluateSol(
                g_test, temp_sol_file, strategy_id, 
                reInsertStep=reInsertStep, log_removals=True
            )
            
            return solution, float(score), MaxCCList
            
        finally:
            # Clean up temporary files
            if os.path.exists(temp_sol_file):
                os.remove(temp_sol_file)
