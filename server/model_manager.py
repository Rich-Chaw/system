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
    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.loaded_models: Dict[str, GraphDQN] = {}
        self.model_configs = self._discover_models()
        
    def _discover_models(self) -> Dict[str, dict]:
        """Discover available model files to self.model_configs
        """
        configs = {}
        
        if not os.path.exists(self.models_dir):
            logger.warning(f"Models directory not found: {self.models_dir}")
            return configs

        # Look for model directories
        for item in os.listdir(self.models_dir):
            model_path = os.path.join(self.models_dir, item)
            if os.path.isdir(model_path):
                # Look for checkpoint files
                ckpt_files = glob.glob(os.path.join(model_path, "*.ckpt*"))
                if ckpt_files:
                    # Parse model configuration from directory name
                    config = self._parse_model_config(item)
                    config['checkpoint_files'] = ckpt_files
                    config['path'] = self.models_dir
                    configs[item] = config
                    
        logger.info(f"Discovered {len(configs)} model configurations")
        return configs
    
    def _parse_model_config(self, dir_name: str) -> dict:
        """Parse model configuration from directory name
            dir_name: BA_nrange_30_50_m_2
        """
    
        parts = dir_name.split('_')
        
        model_config = {
            'name': dir_name,
            'g_type': 'BA',  # default
            'g_params':{
                'nrange':'30_50',
                'm' : 2
            },
            'gnn_model': 'graphSage'
        }
        
        try:
            if 'nrange' in parts:
                idx = parts.index('nrange')
                if idx + 2 < len(parts):
                    model_config['g_params']['nrange'] = f"{parts[idx+1]}_{parts[idx+2]}"
            
            if 'm' in parts:
                idx = parts.index('m')
                if idx + 1 < len(parts):
                    model_config['g_params']['m'] = int(parts[idx+1])
            
            # Determine graph type
            if 'barabasi' in dir_name or 'BA' in dir_name:
                model_config['g_type'] = 'BA'
            elif 'erdos' in dir_name or 'ER' in dir_name:
                model_config['g_type'] = 'ER'
            elif 'powerlaw' in dir_name or 'PL' in dir_name:
                model_config['g_type'] = 'PL'
            elif 'watts' in dir_name or 'SW' in dir_name:
                model_config['g_type'] = 'SW'
                
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
    
    def load_model(self, model_name: str, gnn_model: str = 'graphSage') -> Optional[GraphDQN]:
        """Load a specific model
            model_name: e.g. 'BA_nrange_30_50_m_1'
        """
        if GraphDQN is None:
            raise ImportError("GraphDQN not available")
            
        if model_name in self.loaded_models:
            return self.loaded_models[model_name]
        
        if model_name not in self.model_configs:
            raise ValueError(f"Model {model_name} not found")
        
        # TODO 这个model_configs 其实还是 train dataset config,这里函数直接默认gnn_model是 ‘graphsage，
        config = self.model_configs[model_name] 
        
        try:
            # Initialize GraphDQN
            g_params = config['g_params']
            g_type=config['g_type']
            save_model_dir=config['path']

            #TODO gnn model
            logger.info(f'Loading model dqn with g_type={g_type},g_params={g_params},gnn_model={gnn_model}, save_model_dir={save_model_dir}')
            
            # Handle encoding issues by capturing output
            import contextlib
            from io import StringIO
            
            # Capture stdout to handle encoding issues
            captured_output = StringIO()
            
            try:
                with contextlib.redirect_stdout(captured_output), contextlib.redirect_stderr(captured_output):
                    dqn = GraphDQN(
                        g_type,
                        g_params=g_params,
                        gnn_model=gnn_model,
                        save_model_dir=save_model_dir
                    )

                    # Find best model checkpoint
                    best_model = dqn.findModel()
                    dqn.LoadModel(best_model)
                
                # Log the captured output safely
                output = captured_output.getvalue()
                if output:
                    # Replace problematic characters
                    safe_output = output.encode('ascii', errors='replace').decode('ascii')
                    logger.info(f"Model loading output: {safe_output}")
                    
            except UnicodeEncodeError as e:
                logger.warning(f"Encoding issue during model loading: {e}")
                # Try without capturing output
                dqn = GraphDQN(
                    g_type,
                    g_params=g_params,
                    gnn_model=gnn_model,
                    save_model_dir=save_model_dir
                )
                best_model = dqn.findModel()
                dqn.LoadModel(best_model)
            
            self.loaded_models[model_name] = dqn
            logger.info(f"Successfully loaded model: {model_name}")
            
            return dqn
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            raise
    
    def get_model(self, model_name: str = None) -> GraphDQN:
        """Get a model, loading if necessary"""
        if model_name is None or model_name == 'default':
            # Use first available model as default
            if not self.model_configs:
                raise ValueError("No models available")
            model_name = list(self.model_configs.keys())[0]

        return self.load_model(model_name)
    
    def unload_model(self, model_name: str):
        """Unload a model to free memory"""
        if model_name in self.loaded_models:
            del self.loaded_models[model_name]
            logger.info(f"Unloaded model: {model_name}")
    
    def unload_all(self):
        """Unload all models"""
        self.loaded_models.clear()
        logger.info("Unloaded all models")