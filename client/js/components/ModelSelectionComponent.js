/**
 * Model Selection Component v2 - Multi-Model Type Support
 * Supports FINDER, MIND-ND, and Baseline models with multi-model queuing
 */
class ModelSelectionComponent extends BaseComponent {
    getDefaultOptions() {
        return {
            serverUrl: 'http://localhost:5000'
        };
    }

    init() {
        this.allModels = {};
        this.modelTypes = [];
        this.selectedModelType = '';
        this.selectedModel = '';
        this.parameters = {};
        // Queue of models to run: [{id, type, path, name, parameters}]
        this.modelQueue = [];
        this.nextId = 1;

        super.init();
        this.loadAllModels();
    }

    setupEventListeners() {
        super.setupEventListeners();

        this.container.addEventListener('change', (e) => {
            if (e.target.id === 'modelTypeSelect') {
                this.handleModelTypeChange(e.target.value);
            } else if (e.target.id === 'modelSelect') {
                this.handleModelChange(e.target.value);
            } else if (e.target.classList.contains('parameter-input')) {
                this.handleParameterChange(e.target.name, e.target.value);
            }
        });

        this.container.addEventListener('click', (e) => {
            if (e.target.id === 'addModelBtn' || e.target.closest('#addModelBtn')) {
                this.handleAddModel();
            } else if (e.target.id === 'dismantleBtn' || e.target.closest('#dismantleBtn')) {
                this.handleDismantle();
            } else if (e.target.closest('.remove-model-btn')) {
                const id = parseInt(e.target.closest('.remove-model-btn').dataset.id);
                this.removeFromQueue(id);
            }
        });

        this.on('graph:loaded', () => this.enable());
        this.on('graph:cleared', () => this.disable());
    }

    async loadAllModels() {
        try {
            this.showLoading('Loading models...');
            const response = await fetch(`${this.options.serverUrl}/api/models/all`);
            const data = await response.json();
            if (data.success) {
                this.allModels = data.models;
                this.modelTypes = Object.keys(data.models);
                this.setState({ modelsLoaded: true });
                this.render();
            } else {
                this.showError('Failed to load models: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to load models: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    handleModelTypeChange(modelType) {
        this.selectedModelType = modelType;
        this.selectedModel = '';
        this.parameters = this.getDefaultParameters(modelType);
        this.setState({ selectedModelType: modelType });
        this.render();
    }

    handleModelChange(modelPath) {
        this.selectedModel = modelPath;
        // Find display name
        const models = this.allModels[this.selectedModelType] || [];
        const found = models.find(m => m.path === modelPath);
        this.selectedModelName = found ? found.name : modelPath;
    }

    handleParameterChange(name, value) {
        this.parameters[name] = value;
    }

    getDefaultParameters(modelType) {
        switch (modelType) {
            case 'finder': return { step_ratio: 0.01 };
            case 'mind':   return { threshold: 0.1, max_steps: null };
            case 'baseline': return { threshold: 0.1, max_steps: null };
            default: return {};
        }
    }

    handleAddModel() {
        if (!this.selectedModelType) { alert('Please select a model type'); return; }
        if (!this.selectedModel) { alert('Please select a model'); return; }

        // Read current parameter values from inputs
        const params = {};
        this.container.querySelectorAll('.parameter-input').forEach(input => {
            const val = input.value.trim();
            if (val !== '' && val !== 'None' && val !== 'null') {
                params[input.name] = isNaN(val) ? val : parseFloat(val);
            }
        });

        const entry = {
            id: this.nextId++,
            type: this.selectedModelType,
            path: this.selectedModel,
            name: this.selectedModelName || this.selectedModel,
            parameters: { ...params }
        };

        this.modelQueue.push(entry);
        this.render();

        // Notify MultiViewVisualizationComponent about queue change
        this.emit('models:changed', { models: this.modelQueue });
    }

    removeFromQueue(id) {
        this.modelQueue = this.modelQueue.filter(m => m.id !== id);
        this.render();
        this.emit('models:changed', { models: this.modelQueue });
    }

    async handleDismantle() {
        if (this.modelQueue.length === 0) {
            alert('Please add at least one model to the queue');
            return;
        }

        const graphUploadComponent = ComponentManager.getInstance().getComponent('graph-input');
        if (!graphUploadComponent || !graphUploadComponent.getCurrentGraph()) {
            alert('Please load a graph first');
            return;
        }

        const graph = graphUploadComponent.getCurrentGraph();

        try {
            this.showLoading('Running dismantling...');
            this.emit('dismantling:started', { models: this.modelQueue });

            const results = [];

            for (const modelEntry of this.modelQueue) {
                this.showLoading(`Running ${modelEntry.name}...`);

                // Build clean parameters (strip nulls)
                const cleanParams = {};
                for (const [k, v] of Object.entries(modelEntry.parameters)) {
                    if (v !== null && v !== '' && v !== 'None') cleanParams[k] = v;
                }

                const requestData = {
                    graph: graph,
                    model_type: modelEntry.type,
                    model_path: modelEntry.path,
                    parameters: cleanParams
                };

                const response = await fetch(`${this.options.serverUrl}/api/dismantle/execute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData)
                });

                const data = await response.json();

                if (data.success) {
                    results.push({
                        modelConfig: {
                            id: modelEntry.id,
                            name: modelEntry.name,
                            type: modelEntry.type
                        },
                        result: {
                            removals: data.removals,
                            score: data.score,
                            lcc_sizes: data.lcc_sizes || [],
                            execution_time: data.execution_time != null ? data.execution_time : null
                        }
                    });
                } else {
                    results.push({
                        modelConfig: {
                            id: modelEntry.id,
                            name: modelEntry.name,
                            type: modelEntry.type
                        },
                        error: data.error
                    });
                }
            }

            this.emit('dismantling:completed', { results });

        } catch (error) {
            this.showError('Dismantling failed: ' + error.message);
            this.emit('dismantling:failed', { error: error.message });
        } finally {
            this.hideLoading();
        }
    }

    render() {
        const cardBody = this.container.querySelector('.card-body');
        if (!cardBody) return;

        if (this.state.loading) {
            cardBody.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-2 text-muted">${this.state.loadingMessage || 'Loading...'}</p>
                </div>`;
            return;
        }

        if (this.state.error) {
            cardBody.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> ${this.state.error}</div>`;
            return;
        }

        cardBody.innerHTML = `
            <div class="mb-3">
                <label for="modelTypeSelect" class="form-label">Model Type:</label>
                <select class="form-select" id="modelTypeSelect" ${this.state.disabled ? 'disabled' : ''}>
                    <option value="">Choose model type...</option>
                    ${this.modelTypes.map(type => `
                        <option value="${type}" ${this.selectedModelType === type ? 'selected' : ''}>
                            ${type.toUpperCase()} ${this.allModels[type] ? `(${this.allModels[type].length} models)` : ''}
                        </option>`).join('')}
                </select>
            </div>

            ${this.selectedModelType ? `
                <div class="mb-3">
                    <label for="modelSelect" class="form-label">Select Model:</label>
                    <select class="form-select" id="modelSelect" ${this.state.disabled ? 'disabled' : ''}>
                        <option value="">Choose a model...</option>
                        ${(this.allModels[this.selectedModelType] || []).map(model => `
                            <option value="${model.path}" ${this.selectedModel === model.path ? 'selected' : ''}>
                                ${model.name}
                            </option>`).join('')}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Parameters:</label>
                    ${this.renderParameters()}
                </div>
                <div class="mb-3">
                    <button class="btn btn-outline-primary btn-sm w-100" id="addModelBtn" ${this.state.disabled ? 'disabled' : ''}>
                        <i class="fas fa-plus"></i> Add to Queue
                    </button>
                </div>
            ` : ''}

            ${this.modelQueue.length > 0 ? `
                <div class="mb-3">
                    <label class="form-label">Model Queue (${this.modelQueue.length}):</label>
                    <ul class="list-group list-group-flush">
                        ${this.modelQueue.map(m => `
                            <li class="list-group-item d-flex justify-content-between align-items-center px-0 py-1">
                                <span>
                                    <span class="badge bg-secondary me-1">${m.type.toUpperCase()}</span>
                                    <small>${m.name}</small>
                                </span>
                                <button class="btn btn-sm btn-outline-danger remove-model-btn" data-id="${m.id}">
                                    <i class="fas fa-times"></i>
                                </button>
                            </li>`).join('')}
                    </ul>
                </div>
            ` : ''}

            <div class="d-grid gap-2">
                <button class="btn btn-primary" id="dismantleBtn"
                    ${this.state.disabled || this.modelQueue.length === 0 ? 'disabled' : ''}>
                    <i class="fas fa-play"></i> Start Dismantling (${this.modelQueue.length} model${this.modelQueue.length !== 1 ? 's' : ''})
                </button>
            </div>
        `;
    }

    renderParameters() {
        if (!this.selectedModelType) return '';
        switch (this.selectedModelType) {
            case 'finder':
                return `
                    <div class="mb-2">
                        <label class="form-label">Step Ratio:</label>
                        <input type="number" class="form-control parameter-input"
                               name="step_ratio" value="${this.parameters.step_ratio || 0.01}"
                               min="0.001" max="1" step="0.001" ${this.state.disabled ? 'disabled' : ''}>
                        <small class="form-text text-muted">Fraction of nodes to consider per iteration</small>
                    </div>`;
            case 'mind':
                return `
                    <div class="mb-2">
                        <label class="form-label">Threshold:</label>
                        <input type="number" class="form-control parameter-input"
                               name="threshold" value="${this.parameters.threshold || 0.1}"
                               min="0.01" max="1" step="0.01" ${this.state.disabled ? 'disabled' : ''}>
                        <small class="form-text text-muted">Fraction of nodes to remove</small>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Max Steps (optional):</label>
                        <input type="number" class="form-control parameter-input"
                               name="max_steps" value="${this.parameters.max_steps || ''}"
                               min="1" ${this.state.disabled ? 'disabled' : ''}>
                    </div>`;
            case 'baseline':
                return `
                    <div class="mb-2">
                        <label class="form-label">Threshold:</label>
                        <input type="number" class="form-control parameter-input"
                               name="threshold" value="${this.parameters.threshold || 0.1}"
                               min="0.01" max="1" step="0.01" ${this.state.disabled ? 'disabled' : ''}>
                        <small class="form-text text-muted">Fraction of nodes to remove</small>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Max Steps (optional):</label>
                        <input type="number" class="form-control parameter-input"
                               name="max_steps" value="${this.parameters.max_steps || ''}"
                               min="1" ${this.state.disabled ? 'disabled' : ''}>
                    </div>`;
            default:
                return '<p class="text-muted">No parameters required</p>';
        }
    }
}
