#!/usr/bin/env python3
"""
NetworkDismantling Network Dismantling Server
Main Flask application serving the GraphDQN models
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import sys
import json
import tempfile
import sqlite3
import networkx as nx
import numpy as np
from datetime import datetime
import logging
import traceback
import hashlib
import uuid

from config.config import config
from config.exceptions import FinderNDException
from services.model_manager import ModelManager
from services.graph_processor import GraphProcessor
from services.dismantling_engine import DismantlingEngine

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# SQLite helpers
# ─────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
DB_PATH  = os.path.join(DATA_DIR, 'nd.db')

def get_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS train_tasks (
                id           TEXT PRIMARY KEY,
                username     TEXT NOT NULL,
                exp_name     TEXT NOT NULL,
                run_dir      TEXT NOT NULL,
                status       TEXT NOT NULL DEFAULT 'queued',
                params       TEXT,
                datasets     TEXT,
                created_at   TEXT NOT NULL,
                started_at   TEXT,
                finished_at  TEXT,
                current_step INTEGER DEFAULT 0,
                total_steps  INTEGER DEFAULT 0,
                best_auc     REAL,
                best_step    INTEGER,
                error_msg    TEXT
            );
            CREATE TABLE IF NOT EXISTS checkpoints (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id     TEXT NOT NULL,
                step        INTEGER NOT NULL,
                auc         REAL,
                file_path   TEXT,
                is_best     INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL,
                FOREIGN KEY(task_id) REFERENCES train_tasks(id)
            );
            CREATE TABLE IF NOT EXISTS train_datasets (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                username     TEXT NOT NULL,
                dataset_name TEXT NOT NULL,
                dir_path     TEXT NOT NULL,
                total_graphs INTEGER DEFAULT 0,
                configs      TEXT,
                created_at   TEXT NOT NULL,
                UNIQUE(username, dataset_name)
            );
            CREATE TABLE IF NOT EXISTS train_dataset_graphs (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                dataset_id   INTEGER NOT NULL,
                graph_type   TEXT NOT NULL,
                count        INTEGER NOT NULL,
                params       TEXT,
                FOREIGN KEY(dataset_id) REFERENCES train_datasets(id)
            );
        """)

init_db()

# Initialize components
model_manager = ModelManager()
graph_processor = GraphProcessor()
dismantling_engine = DismantlingEngine(model_manager)

# Error handlers
@app.errorhandler(FinderNDException)
def handle_finder_exception(error):
    """Handle custom NetworkDismantling exceptions"""
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'error': 'Resource not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'available_models': model_manager.get_available_models()
    })

@app.route('/api/models', methods=['GET'])
def get_models():
    """Get list of available models"""
    try:
        models = model_manager.get_available_models()
        return jsonify({
            'success': True,
            'models': models
        })
    except Exception as e:
        logger.error(f"Error getting models: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/dismantle', methods=['POST'])
def dismantle_network():
    """Main endpoint for network dismantling"""
    try:
        # Parse request
        data = request.get_json()
        
        # Validate required fields
        if 'graph' not in data:
            return jsonify({
                'success': False,
                'error': 'Graph data is required'
            }), 400
        
        # Extract parameters
        graph_data = data['graph']
        model_name = data.get('model', 'default')
        step_ratio = data.get('step_ratio', 0.0025)
        max_iterations = data.get('max_iterations', 1000)
        
        # Debug: log the graph data format
        logger.info(f"Received graph data type: {type(graph_data)}")
        logger.info(f"Graph data keys: {list(graph_data.keys()) if isinstance(graph_data, dict) else 'Not a dict'}")
        
        # Process graph
        graph = graph_processor.parse_graph(graph_data)
        
        # Validate graph
        if graph.number_of_nodes() == 0:
            return jsonify({
                'success': False,
                'error': 'Empty graph provided'
            }), 400
        
        # Execute dismantling
        result = dismantling_engine.dismantle(
            graph=graph,
            model_name=model_name,
            step_ratio=step_ratio,
            max_iterations=max_iterations
        )
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        logger.error(f"Error in dismantling: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/upload_graph', methods=['POST'])
def upload_graph():
    """Upload graph file endpoint"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No file provided'
            }), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        # Save temporary file
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.txt')
        try:
            file.save(tmp_file.name)
            tmp_file.close()  # Close the file before processing
            
            # Process graph file
            graph = graph_processor.load_from_file(tmp_file.name)
            
        finally:
            # Clean up
            try:
                os.unlink(tmp_file.name)
            except OSError:
                pass  # File might already be deleted
        
        # Calculate comprehensive graph statistics
        graph_info = graph_processor.validate_graph(graph)
        
        # Return graph info
        return jsonify({
            'success': True,
            'graph_info': graph_info,
            'graph_data': graph_processor.graph_to_dict(graph)
        })
        
    except Exception as e:
        logger.error(f"Error uploading graph: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/generate_preset_graph', methods=['POST'])
def generate_preset_graph():
    """Generate preset graphs using NetworkX models"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'graph_type' not in data:
            return jsonify({
                'success': False,
                'error': 'graph_type is required'
            }), 400
        
        if 'parameters' not in data:
            return jsonify({
                'success': False,
                'error': 'parameters are required'
            }), 400
        
        graph_type = data['graph_type']
        parameters = data['parameters']
        
        # Generate preset graph
        graph = graph_processor.generate_preset_graph(graph_type, parameters)
        
        # Convert to dictionary format
        graph_data = graph_processor.graph_to_dict(graph)
        
        # Calculate additional statistics
        graph_info = graph_processor.validate_graph(graph)
        
        return jsonify({
            'success': True,
            'graph_data': graph_data,
            'graph_info': graph_info
        })
        
    except ValueError as e:
        logger.error(f"Parameter validation error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error generating preset graph: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/dismantle_multi', methods=['POST'])
def dismantle_multi_model():
    """Execute dismantling with multiple models"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'graph' not in data:
            return jsonify({
                'success': False,
                'error': 'Graph data is required'
            }), 400
        
        if 'models' not in data or not data['models']:
            return jsonify({
                'success': False,
                'error': 'At least one model configuration is required'
            }), 400
        
        graph_data = data['graph']
        model_configs = data['models']
        
        # Parse graph
        graph = graph_processor.parse_graph(graph_data)
        
        # Validate graph
        if graph.number_of_nodes() == 0:
            return jsonify({
                'success': False,
                'error': 'Empty graph provided'
            }), 400
        
        # Execute multi-model dismantling
        results = dismantling_engine.dismantle_multi_model(graph, model_configs)
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error in multi-model dismantling: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/evaluate', methods=['POST'])
def evaluate_solution():
    """Evaluate a dismantling solution"""
    try:
        data = request.get_json()
        
        graph_data = data['graph']
        solution = data['solution']
        
        graph = graph_processor.parse_graph(graph_data)
        metrics = dismantling_engine.evaluate_solution(graph, solution)
        
        return jsonify({
            'success': True,
            'metrics': metrics
        })
        
    except Exception as e:
        logger.error(f"Error evaluating solution: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/all', methods=['GET'])
def get_all_models():
    """Get all available models from all types (FINDER, MIND-ND, Baselines)"""
    try:
        all_models = model_manager.get_all_models()
        return jsonify({
            'success': True,
            'models': all_models
        })
    except Exception as e:
        logger.error(f"Error getting all models: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/dismantle/execute', methods=['POST'])
def dismantle_with_model_type():
    """Execute dismantling with specified model type (finder/mind/baseline)"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'graph' not in data:
            return jsonify({
                'success': False,
                'error': 'Graph data is required'
            }), 400
        
        if 'model_type' not in data:
            return jsonify({
                'success': False,
                'error': 'model_type is required (finder/mind/baseline)'
            }), 400
        
        graph_data = data['graph']
        model_type = data['model_type']
        model_path = data.get('model_path')
        parameters = data.get('parameters', {})
        
        # Parse graph
        graph = graph_processor.parse_graph(graph_data)
        
        # Convert graph format if needed
        if model_type in ['mind', 'baseline']:
            # These models need igraph format
            graph = graph_processor.networkx_to_igraph(graph)
        
        # Execute dismantling
        removals, score, lcc_sizes, execution_time = model_manager.dismantle_with_executor(
            graph=graph,
            model_type=model_type,
            model_path=model_path,
            **parameters
        )
        
        return jsonify({
            'success': True,
            'removals': removals,
            'score': score,
            'lcc_sizes': lcc_sizes,
            'execution_time': execution_time,
            'model_type': model_type
        })
        
    except Exception as e:
        logger.error(f"Error in dismantling execution: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ─────────────────────────────────────────────
# In-memory user store (demo – no real DB)
# ─────────────────────────────────────────────
_USERS = {
    'admin': {
        'id': '1', 'username': 'admin', 'role': 'superadmin',
        'password': hashlib.sha256('admin123'.encode()).hexdigest(),
        'email': 'admin@nd-system.com', 'created_at': '2025-01-01',
        'last_login': None, 'status': 'active'
    },
    'user1': {
        'id': '2', 'username': 'user1', 'role': 'user',
        'password': hashlib.sha256('user123'.encode()).hexdigest(),
        'email': 'user1@nd-system.com', 'created_at': '2025-03-01',
        'last_login': None, 'status': 'active'
    },
    'researcher': {
        'id': '3', 'username': 'researcher', 'role': 'user',
        'password': hashlib.sha256('res123'.encode()).hexdigest(),
        'email': 'researcher@nd-system.com', 'created_at': '2025-03-10',
        'last_login': None, 'status': 'active'
    },
}
_SESSIONS = {}  # token -> username
_OP_LOGS = []   # operation log list


def _require_auth(req):
    """Return username if token valid, else None."""
    token = req.headers.get('X-Auth-Token') or req.args.get('token')
    return _SESSIONS.get(token)


def _require_admin(req):
    """Return username if token valid AND role is superadmin, else None."""
    username = _require_auth(req)
    if username and _USERS.get(username, {}).get('role') == 'superadmin':
        return username
    return None


def _log_op(username, action, detail=''):
    _OP_LOGS.append({
        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'username': username,
        'action': action,
        'detail': detail
    })
    if len(_OP_LOGS) > 500:
        _OP_LOGS.pop(0)


# ─────────────────────────────────────────────
# Dataset endpoints
# ─────────────────────────────────────────────

def _safe(s):
    return ''.join(c for c in str(s) if c.isalnum() or c in '-_')

def _generate_graphs(base_dir, configs):
    """Generate graph edgelist files for each config entry. Returns total count."""
    total = 0
    for idx, cfg in enumerate(configs):
        graph_type = cfg.get('type', 'barabasi_albert')
        params     = cfg.get('params', {})
        count      = int(cfg.get('count', 100))
        n          = int(params.get('n', 100))
        sub_dir    = os.path.join(base_dir, graph_type)
        os.makedirs(sub_dir, exist_ok=True)
        for i in range(count):
            try:
                if graph_type == 'barabasi_albert':
                    G = nx.barabasi_albert_graph(n, int(params.get('m', 3)))
                elif graph_type == 'erdos_renyi':
                    G = nx.erdos_renyi_graph(n, float(params.get('p', 0.05)))
                elif graph_type == 'power_law':
                    G = nx.powerlaw_cluster_graph(n, int(params.get('m', 3)), float(params.get('p', 0.3)))
                elif graph_type == 'small_world':
                    G = nx.watts_strogatz_graph(n, int(params.get('k', 6)), float(params.get('p', 0.1)))
                elif graph_type == 'sbm':
                    nb = int(params.get('num_blocks', 3))
                    sizes = [n // nb] * nb
                    p_in  = float(params.get('p_in', 0.3))
                    p_out = float(params.get('p_out', 0.02))
                    probs = [[p_in if r == c else p_out for c in range(nb)] for r in range(nb)]
                    G = nx.stochastic_block_model(sizes, probs)
                else:
                    G = nx.barabasi_albert_graph(n, 3)
                nx.write_edgelist(G, os.path.join(sub_dir, f'{i}.edgelist'))
                total += 1
            except Exception as e:
                logger.warning(f"Graph gen failed {graph_type}#{i}: {e}")
    return total


@app.route('/api/dataset/ensure', methods=['POST'])
def ensure_train_dataset():
    """Check if dataset exists in DB; if not, generate graphs and register it."""
    data         = request.get_json() or {}
    username     = data.get('username', 'default')
    dataset_name = data.get('dataset_name', 'unnamed')
    configs      = data.get('configs', [])

    safe_user = _safe(username) or 'default'
    safe_name = _safe(dataset_name) or 'unnamed'

    with get_db() as conn:
        row = conn.execute(
            'SELECT * FROM train_datasets WHERE username=? AND dataset_name=?',
            (username, dataset_name)
        ).fetchone()

    if row:
        # Already exists — return info
        with get_db() as conn:
            graph_rows = conn.execute(
                'SELECT * FROM train_dataset_graphs WHERE dataset_id=?', (row['id'],)
            ).fetchall()
        return jsonify({
            'success': True,
            'exists': True,
            'dataset': {
                'id': row['id'],
                'dataset_name': row['dataset_name'],
                'total_graphs': row['total_graphs'],
                'dir_path': row['dir_path'],
                'created_at': row['created_at'],
                'graphs': [dict(g) for g in graph_rows]
            }
        })

    # Not found — generate and register
    if not configs:
        return jsonify({'success': False, 'error': 'No configs provided for new dataset'}), 400

    base_dir = os.path.join(DATA_DIR, safe_user, 'train_dataset', safe_name)
    os.makedirs(base_dir, exist_ok=True)

    with open(os.path.join(base_dir, 'config.json'), 'w', encoding='utf-8') as f:
        json.dump({'dataset_name': dataset_name, 'configs': configs,
                   'created_at': datetime.now().isoformat()}, f, ensure_ascii=False, indent=2)

    total = _generate_graphs(base_dir, configs)

    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO train_datasets (username, dataset_name, dir_path, total_graphs, configs, created_at)
               VALUES (?,?,?,?,?,?)""",
            (username, dataset_name, base_dir, total,
             json.dumps(configs), datetime.now().isoformat())
        )
        ds_id = cur.lastrowid
        for cfg in configs:
            conn.execute(
                """INSERT INTO train_dataset_graphs (dataset_id, graph_type, count, params)
                   VALUES (?,?,?,?)""",
                (ds_id, cfg.get('type'), int(cfg.get('count', 0)), json.dumps(cfg.get('params', {})))
            )

    rel_path = os.path.join('data', safe_user, 'train_dataset', safe_name)
    return jsonify({'success': True, 'exists': False, 'path': rel_path,
                    'total_graphs': total, 'dataset_id': ds_id})


@app.route('/api/dataset/query', methods=['GET'])
def query_train_dataset():
    """Query dataset info by username + dataset_name."""
    username     = request.args.get('username', '')
    dataset_name = request.args.get('dataset_name', '')
    with get_db() as conn:
        row = conn.execute(
            'SELECT * FROM train_datasets WHERE username=? AND dataset_name=?',
            (username, dataset_name)
        ).fetchone()
    if not row:
        return jsonify({'success': True, 'exists': False})
    with get_db() as conn:
        graph_rows = conn.execute(
            'SELECT * FROM train_dataset_graphs WHERE dataset_id=?', (row['id'],)
        ).fetchall()
    return jsonify({'success': True, 'exists': True, 'dataset': {
        'id': row['id'], 'dataset_name': row['dataset_name'],
        'total_graphs': row['total_graphs'], 'dir_path': row['dir_path'],
        'created_at': row['created_at'],
        'graphs': [dict(g) for g in graph_rows]
    }})


# ─────────────────────────────────────────────
# Train task endpoints
# ─────────────────────────────────────────────

@app.route('/api/train/tasks', methods=['POST'])
def create_train_task():
    """Create a train task: save config to disk, register in SQLite as queued."""
    data = request.get_json() or {}
    username = data.get('username', 'default')
    exp_name = data.get('exp_name', 'experiment')
    params   = data.get('params', {})
    datasets = data.get('datasets', [])

    safe_user = _safe(username) or 'default'
    safe_exp  = _safe(exp_name) or 'experiment'
    now_str   = datetime.now().strftime('%Y%m%d_%H%M%S')
    run_name  = f'{safe_exp}_{now_str}'
    run_dir   = os.path.join(DATA_DIR, safe_user, 'train_history', run_name)
    os.makedirs(run_dir, exist_ok=True)

    # Save config.json
    with open(os.path.join(run_dir, 'config.json'), 'w', encoding='utf-8') as f:
        json.dump({'exp_name': exp_name, 'params': params, 'datasets': datasets,
                   'created_at': datetime.now().isoformat()}, f, ensure_ascii=False, indent=2)

    task_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            """INSERT INTO train_tasks
               (id, username, exp_name, run_dir, status, params, datasets, created_at, total_steps)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (task_id, username, exp_name, run_dir, 'queued',
             json.dumps(params), json.dumps(datasets),
             datetime.now().isoformat(),
             params.get('total_steps', 0))
        )

    rel_dir = os.path.join('data', safe_user, 'train_history', run_name)
    return jsonify({'success': True, 'task_id': task_id, 'run_dir': rel_dir})


@app.route('/api/train/tasks/<task_id>/status', methods=['POST'])
def update_train_task_status(task_id):
    """Update task status / current_step / best_auc."""
    data   = request.get_json() or {}
    fields = {}
    if 'status'       in data: fields['status']       = data['status']
    if 'current_step' in data: fields['current_step'] = int(data['current_step'])
    if 'best_auc'     in data: fields['best_auc']     = float(data['best_auc'])
    if 'error_msg'    in data: fields['error_msg']    = data['error_msg']
    if data.get('status') == 'running' and 'started_at' not in fields:
        fields['started_at'] = datetime.now().isoformat()
    if data.get('status') in ('succeeded', 'failed', 'stopped'):
        fields['finished_at'] = datetime.now().isoformat()

    if not fields:
        return jsonify({'success': False, 'error': 'Nothing to update'}), 400

    set_clause = ', '.join(f'{k}=?' for k in fields)
    with get_db() as conn:
        conn.execute(f'UPDATE train_tasks SET {set_clause} WHERE id=?',
                     list(fields.values()) + [task_id])
    return jsonify({'success': True})


@app.route('/api/train/tasks/<task_id>/checkpoint', methods=['POST'])
def save_checkpoint(task_id):
    """Save a checkpoint file and register it in SQLite."""
    data = request.get_json() or {}
    step     = int(data.get('step', 0))
    auc      = float(data.get('auc', 0))
    is_best  = int(data.get('is_best', 0))
    metrics  = data.get('metrics', {})   # {reward, loss, lcc}

    # Fetch run_dir from DB
    with get_db() as conn:
        row = conn.execute('SELECT run_dir, username, exp_name FROM train_tasks WHERE id=?',
                           (task_id,)).fetchone()
    if not row:
        return jsonify({'success': False, 'error': 'Task not found'}), 404

    run_dir  = row['run_dir']
    ckpt_dir = os.path.join(run_dir, 'checkpoints')
    os.makedirs(ckpt_dir, exist_ok=True)

    ckpt_name = f'step_{step}.json'
    ckpt_path = os.path.join(ckpt_dir, ckpt_name)
    with open(ckpt_path, 'w', encoding='utf-8') as f:
        json.dump({'task_id': task_id, 'step': step, 'auc': auc,
                   'is_best': bool(is_best), 'metrics': metrics,
                   'saved_at': datetime.now().isoformat()}, f, indent=2)

    with get_db() as conn:
        conn.execute(
            """INSERT INTO checkpoints (task_id, step, auc, file_path, is_best, created_at)
               VALUES (?,?,?,?,?,?)""",
            (task_id, step, auc, ckpt_path, is_best, datetime.now().isoformat())
        )
        # Update current_step and best_auc in task
        conn.execute(
            """UPDATE train_tasks SET current_step=?,
               best_auc=CASE WHEN COALESCE(best_auc,-1) < ? THEN ? ELSE best_auc END,
               best_step=CASE WHEN COALESCE(best_auc,-1) < ? THEN ? ELSE best_step END
               WHERE id=?""",
            (step, auc, auc, auc, step, task_id)
        )

    return jsonify({'success': True, 'file': ckpt_name})


@app.route('/api/train/tasks', methods=['GET'])
def list_train_tasks():
    """List train tasks for a user."""
    username = request.args.get('username', '')
    with get_db() as conn:
        if username:
            rows = conn.execute(
                'SELECT * FROM train_tasks WHERE username=? ORDER BY created_at DESC', (username,)
            ).fetchall()
        else:
            rows = conn.execute(
                'SELECT * FROM train_tasks ORDER BY created_at DESC'
            ).fetchall()
    return jsonify({'success': True, 'tasks': [dict(r) for r in rows]})


@app.route('/api/train/tasks/<task_id>/checkpoints', methods=['GET'])
def list_checkpoints(task_id):
    """List checkpoints for a task."""
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM checkpoints WHERE task_id=? ORDER BY step DESC', (task_id,)
        ).fetchall()
    return jsonify({'success': True, 'checkpoints': [dict(r) for r in rows]})


# ─────────────────────────────────────────────
# Auth endpoints
# ─────────────────────────────────────────────
@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    user = _USERS.get(username)
    if not user or user['password'] != hashlib.sha256(password.encode()).hexdigest():
        return jsonify({'success': False, 'error': '用户名或密码错误'}), 401
    if user['status'] != 'active':
        return jsonify({'success': False, 'error': '账号已被禁用'}), 403
    token = str(uuid.uuid4())
    _SESSIONS[token] = username
    _USERS[username]['last_login'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    _log_op(username, '登录', f'角色: {user["role"]}')
    return jsonify({'success': True, 'token': token, 'role': user['role'], 'username': username})


@app.route('/api/auth/register', methods=['POST'])
def auth_register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    email    = data.get('email', '').strip()
    if not username or not password:
        return jsonify({'success': False, 'error': '用户名和密码不能为空'}), 400
    if len(username) < 3:
        return jsonify({'success': False, 'error': '用户名至少3个字符'}), 400
    if len(password) < 6:
        return jsonify({'success': False, 'error': '密码至少6位'}), 400
    if username in _USERS:
        return jsonify({'success': False, 'error': '用户名已存在'}), 400
    _USERS[username] = {
        'id': str(uuid.uuid4())[:8],
        'username': username,
        'role': 'user',
        'password': hashlib.sha256(password.encode()).hexdigest(),
        'email': email,
        'created_at': datetime.now().strftime('%Y-%m-%d'),
        'last_login': None,
        'status': 'active'
    }
    _log_op(username, '注册', '新用户自助注册')
    return jsonify({'success': True})


@app.route('/api/auth/change_password', methods=['POST'])
def auth_change_password():
    username = _require_auth(request)
    if not username:
        return jsonify({'success': False, 'error': '未登录'}), 401
    data = request.get_json() or {}
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')
    if not old_password or not new_password:
        return jsonify({'success': False, 'error': '参数不完整'}), 400
    if len(new_password) < 6:
        return jsonify({'success': False, 'error': '新密码至少6位'}), 400
    user = _USERS.get(username)
    if user['password'] != hashlib.sha256(old_password.encode()).hexdigest():
        return jsonify({'success': False, 'error': '当前密码错误'}), 400
    user['password'] = hashlib.sha256(new_password.encode()).hexdigest()
    _log_op(username, '修改密码')
    return jsonify({'success': True})


@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    token = request.headers.get('X-Auth-Token')
    username = _SESSIONS.pop(token, None)
    if username:
        _log_op(username, '退出登录')
    return jsonify({'success': True})


@app.route('/api/auth/me', methods=['GET'])
def auth_me():
    username = _require_auth(request)
    if not username:
        return jsonify({'success': False, 'error': '未登录'}), 401
    u = _USERS[username]
    return jsonify({'success': True, 'username': username, 'role': u['role'], 'email': u['email']})


# ─────────────────────────────────────────────
# Admin endpoints
# ─────────────────────────────────────────────
@app.route('/api/admin/users', methods=['GET'])
def admin_list_users():
    if not _require_admin(request):
        return jsonify({'success': False, 'error': '权限不足'}), 403
    users = [
        {k: v for k, v in u.items() if k != 'password'}
        for u in _USERS.values()
    ]
    return jsonify({'success': True, 'users': users})


@app.route('/api/admin/users', methods=['POST'])
def admin_create_user():
    admin = _require_admin(request)
    if not admin:
        return jsonify({'success': False, 'error': '权限不足'}), 403
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    if not username or username in _USERS:
        return jsonify({'success': False, 'error': '用户名已存在或为空'}), 400
    password = data.get('password', 'changeme')
    _USERS[username] = {
        'id': str(uuid.uuid4())[:8],
        'username': username,
        'role': data.get('role', 'user'),
        'password': hashlib.sha256(password.encode()).hexdigest(),
        'email': data.get('email', ''),
        'created_at': datetime.now().strftime('%Y-%m-%d'),
        'last_login': None,
        'status': 'active'
    }
    _log_op(admin, '创建用户', username)
    return jsonify({'success': True})


@app.route('/api/admin/users/<uid>', methods=['DELETE'])
def admin_delete_user(uid):
    admin = _require_admin(request)
    if not admin:
        return jsonify({'success': False, 'error': '权限不足'}), 403
    target = next((u for u in _USERS.values() if u['id'] == uid), None)
    if not target:
        return jsonify({'success': False, 'error': '用户不存在'}), 404
    if target['username'] == admin:
        return jsonify({'success': False, 'error': '不能删除自己'}), 400
    del _USERS[target['username']]
    _log_op(admin, '删除用户', target['username'])
    return jsonify({'success': True})


@app.route('/api/admin/users/<uid>/toggle', methods=['POST'])
def admin_toggle_user(uid):
    admin = _require_admin(request)
    if not admin:
        return jsonify({'success': False, 'error': '权限不足'}), 403
    target = next((u for u in _USERS.values() if u['id'] == uid), None)
    if not target:
        return jsonify({'success': False, 'error': '用户不存在'}), 404
    target['status'] = 'disabled' if target['status'] == 'active' else 'active'
    _log_op(admin, '切换用户状态', f'{target["username"]} -> {target["status"]}')
    return jsonify({'success': True, 'status': target['status']})


@app.route('/api/admin/logs', methods=['GET'])
def admin_logs():
    if not _require_admin(request):
        return jsonify({'success': False, 'error': '权限不足'}), 403
    return jsonify({'success': True, 'logs': list(reversed(_OP_LOGS))})


# ─────────────────────────────────────────────
# System stats endpoint
# ─────────────────────────────────────────────
@app.route('/api/system/stats', methods=['GET'])
def system_stats():
    if not _require_auth(request):
        return jsonify({'success': False, 'error': '未登录'}), 401
    try:
        all_models = model_manager.get_all_models()
        total_models = sum(len(v) for v in all_models.values())
    except Exception:
        total_models = 0
    return jsonify({
        'success': True,
        'stats': {
            'total_users': len(_USERS),
            'active_sessions': len(_SESSIONS),
            'total_models': total_models,
            'server_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'uptime': 'running'
        }
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)