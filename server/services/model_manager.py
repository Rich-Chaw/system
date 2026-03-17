"""
Model Manager for network dismantling models.
Delegates execution to ModelExecutor via subprocess (conda environments).
"""

import logging
from typing import Dict, List

from .model_executor import ModelExecutor

logger = logging.getLogger(__name__)


class ModelManager:
    def __init__(self):
        self.executor = ModelExecutor()
        logger.info("ModelManager initialized")

    def get_available_models(self) -> List[dict]:
        """Get list of available FINDER models"""
        return self.executor.list_available_models('finder')

    def get_all_models(self) -> Dict[str, List[dict]]:
        """Get all available models from all types (FINDER, MIND-ND, Baselines)"""
        return {
            'finder': self.executor.list_available_models('finder'),
            'mind': self.executor.list_available_models('mind'),
            'baseline': self.executor.list_available_models('baseline')
        }

    def dismantle_with_executor(self, graph, model_type: str, model_path: str = None, **kwargs):
        """
        Dismantle graph using ModelExecutor (supports all model types).

        Args:
            graph: NetworkX or igraph graph
            model_type: 'finder', 'mind', or 'baseline'
            model_path: Path to model checkpoint or method name
            **kwargs: Model-specific parameters

        Returns:
            (removals, score, lcc_sizes)
        """
        return self.executor.execute_model(
            graph=graph,
            model_type=model_type,
            model_path=model_path,
            **kwargs
        )
