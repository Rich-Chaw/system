#!/usr/bin/env python3
"""
Complete setup script for FINDER_ND system
This script will:
1. Check dependencies
2. Compile Cython extensions
3. Verify imports
4. Test the system
"""

import os
import sys
import subprocess
import logging
import importlib.util

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

def check_python_version():
    """Check if Python version is compatible"""
    logger = logging.getLogger(__name__)
    
    if sys.version_info < (3, 7):
        logger.error(f"Python 3.7+ required, found {sys.version}")
        return False
    
    logger.info(f"✓ Python version: {sys.version}")
    return True

def check_dependencies():
    """Check if all required dependencies are installed"""
    logger = logging.getLogger(__name__)
    
    required_packages = [
        ('Cython', 'cython'),
        ('numpy', 'numpy'),
        ('tensorflow', 'tensorflow'),
        ('networkx', 'networkx'),
        ('flask', 'flask'),
        ('flask_cors', 'flask-cors'),
        ('scipy', 'scipy'),
        ('pandas', 'pandas'),
        ('tqdm', 'tqdm')
    ]
    
    missing_packages = []
    
    for package_name, pip_name in required_packages:
        try:
            __import__(package_name.lower())
            logger.info(f"✓ {package_name} found")
        except ImportError:
            logger.error(f"✗ {package_name} not found")
            missing_packages.append(pip_name)
    
    if missing_packages:
        logger.error("Missing packages. Install them with:")
        logger.error(f"pip install {' '.join(missing_packages)}")
        return False
    
    return True

def check_directory_structure():
    """Check if the required directory structure exists"""
    logger = logging.getLogger(__name__)
    
    required_paths = [
        'AAA-NetDQN/code/FINDER_ND',
        'AAA-NetDQN/code/FINDER_ND/src/lib',
        'AAA-NetDQN/code/FINDER_ND/setup.py',
        'AAA-NetDQN/code/FINDER_ND/GraphDQN.pyx',
        'server',
        'client'
    ]
    
    missing_paths = []
    
    for path in required_paths:
        if not os.path.exists(path):
            logger.error(f"✗ Missing: {path}")
            missing_paths.append(path)
        else:
            logger.info(f"✓ Found: {path}")
    
    if missing_paths:
        logger.error("Missing required files/directories")
        return False
    
    return True

def compile_extensions():
    """Compile the Cython extensions"""
    logger = logging.getLogger(__name__)
    
    finder_code_path = os.path.abspath('AAA-NetDQN/code')
    
    logger.info(f"Compiling extensions in {finder_code_path}")
    
    # Change to FINDER_ND directory
    original_cwd = os.getcwd()
    os.chdir(finder_code_path)
    
    try:
        # Clean previous builds
        logger.info("Cleaning previous builds...")
        subprocess.run([sys.executable, './FINDER_ND/setup.py', 'clean', '--all'], 
                      capture_output=True, check=False)
        
        # Compile extensions
        cmd = [sys.executable, './FINDER_ND/setup.py', 'build_ext', '--inplace']
        logger.info(f"Running: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0:
            logger.info("✓ Extensions compiled successfully")
            return True
        else:
            logger.error("✗ Compilation failed")
            logger.error("STDOUT:")
            print(result.stdout)
            logger.error("STDERR:")
            print(result.stderr)
            return False
            
    except Exception as e:
        logger.error(f"Compilation error: {e}")
        return False
    finally:
        os.chdir(original_cwd)

def verify_extensions():
    """Verify that extensions were compiled correctly"""
    logger = logging.getLogger(__name__)
    
    finder_code_path = os.path.abspath('AAA-NetDQN/code')
    finder_nd_path = os.path.abspath('AAA-NetDQN/code/FINDER_ND')

    # Add to path for testing
    if finder_nd_path not in sys.path:
        sys.path.insert(0, finder_nd_path)
    # Add to path for testing
    if finder_code_path not in sys.path:
        sys.path.insert(0, finder_code_path)
    
    extensions = [
        'GraphDQN', 'graph', 'mvc_env', 'utils', 
        'nstep_replay_mem', 'PrepareBatchGraph',
        'nstep_replay_mem_prioritized', 'graph_struct'
    ]
    
    success = True
    for ext in extensions:
        try:
            spec = importlib.util.find_spec(ext)
            if spec is None:
                logger.error(f"✗ {ext} not found")
                success = False
            else:
                # Try to actually import it
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                logger.info(f"✓ {ext} imported successfully")
        except Exception as e:
            logger.error(f"✗ Failed to import {ext}: {e}")
            success = False
    
    return success

def test_graphdqn_import():
    """Test if GraphDQN can be imported and instantiated"""
    logger = logging.getLogger(__name__)
    
    finder_nd_path = os.path.abspath('AAA-NetDQN/code')
    finder_code_path = os.path.abspath('AAA-NetDQN/code/FINDER_ND')
    if finder_nd_path not in sys.path:
        sys.path.insert(0, finder_nd_path)
    if finder_nd_path not in sys.path:
        sys.path.insert(0, finder_code_path)
    
    
    try:
        from GraphDQN import GraphDQN
        logger.info("✓ GraphDQN imported successfully")
        
        # Try to create an instance (without loading models)
        dqn = GraphDQN(
            g_type='barabasi_albert',
            g_params={'nrange': '30_50', 'm': 2},
            gnn_model='graphSage',
            save_model_dir='./test_models'
        )
        logger.info("✓ GraphDQN instance created successfully")
        return True
        
    except Exception as e:
        logger.error(f"✗ Failed to test GraphDQN: {e}")
        return False

def create_test_directories():
    """Create necessary directories if they don't exist"""
    logger = logging.getLogger(__name__)
    
    directories = [
        'AAA-NetDQN/code/models',
        'server/logs',
        'client/temp'
    ]
    
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
            logger.info(f"✓ Created directory: {directory}")
        else:
            logger.info(f"✓ Directory exists: {directory}")

def main():
    setup_logging()
    logger = logging.getLogger(__name__)
    
    logger.info("FINDER_ND System Setup")
    logger.info("=" * 50)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Check directory structure
    if not check_directory_structure():
        logger.error("Please ensure all required files are present")
        sys.exit(1)
    
    # Check dependencies
    if not check_dependencies():
        logger.error("Please install missing dependencies first")
        sys.exit(1)
    
    # Create necessary directories
    create_test_directories()
    
    # Compile extensions
    logger.info("\nCompiling Cython extensions...")
    if not compile_extensions():
        logger.error("Extension compilation failed")
        sys.exit(1)
    
    # Verify extensions
    logger.info("\nVerifying extensions...")
    if not verify_extensions():
        logger.error("Extension verification failed")
        sys.exit(1)
    
    # Test GraphDQN import
    logger.info("\nTesting GraphDQN import...")
    if not test_graphdqn_import():
        logger.error("GraphDQN import test failed")
        sys.exit(1)
    
    logger.info("\n" + "=" * 50)
    logger.info("✓ FINDER_ND system setup completed successfully!")
    logger.info("\nNext steps:")
    logger.info("1. Place your trained models in: AAA-NetDQN/code/models/")
    logger.info("2. Start the system with: python start_system.py")
    logger.info("3. Or start components separately:")
    logger.info("   - Server: python run_server.py")
    logger.info("   - Client: python run_client.py")

if __name__ == '__main__':
    main()