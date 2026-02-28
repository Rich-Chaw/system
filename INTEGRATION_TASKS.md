# System Integration Task List

## Overview
Integrate MIND-ND models, baseline heuristic methods, and igraph support into the existing FINDER_ND system.

## Phase 1: MIND-ND Python Interface ✓
- [x] 1.1 Create `python_interface.py` in MIND-ND directory
- [x] 1.2 Test MIND-ND interface standalone
- [x] 1.3 Verify model loading and dismantling functionality

## Phase 2: Graph Format Support ✓
- [x] 2.1 Add `.pkl` file format support to `graph_processor.py`
- [x] 2.2 Add igraph to NetworkX conversion utilities
- [x] 2.3 Update graph upload endpoint to handle `.pkl` files
- [ ] 2.4 Update client file upload to accept `.pkl` format
- [x] 2.5 Add igraph dependency to requirements.txt

## Phase 3: Model Executor Service ✓
- [x] 3.1 Create `model_executor.py` with subprocess-based execution
- [x] 3.2 Implement unified interface for all model types
- [x] 3.3 Add conda environment support
- [x] 3.4 Create baseline interface script

## Phase 4: Configuration & Integration
- [x] 4.1 Create `model_environments.json` configuration
- [ ] 4.2 Update `model_manager.py` to use ModelExecutor
- [ ] 4.3 Update API endpoints to support model_type parameter
- [ ] 4.4 Test multi-model execution

## Phase 5: Client Updates
- [ ] 5.1 Update model selection UI to show model types
- [ ] 5.2 Add model-specific parameter inputs
- [ ] 5.3 Update file upload to accept .pkl files
- [ ] 5.4 Test end-to-end workflow

## Phase 6: Testing & Documentation ✓
- [x] 6.1 Create integration guide
- [ ] 6.2 Test all model types individually
- [ ] 6.3 Test multi-model comparison
- [ ] 6.4 Update API documentation

## Implementation Notes

### Key Changes Required:
1. **graph_processor.py**: Add pkl loading, igraph support
2. **model_manager.py**: Support multiple model types (FINDER, MIND-ND, Baseline)
3. **dismantling_engine.py**: Handle different model interfaces
4. **app.py**: Update file upload handling
5. **client**: Update file input and model selection UI

### Dependencies to Add:
- python-igraph
- Additional MIND-ND dependencies (if any)

### Backward Compatibility:
- Maintain existing FINDER_ND functionality
- Support both NetworkX and igraph formats
- Keep existing API endpoints working
