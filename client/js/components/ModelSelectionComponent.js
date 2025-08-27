/**
 * Model Selection Component
 * Handles model selection and parameter configuration
 */
class ModelSelectionComponent extends BaseComponent {
    getDefaultOptions() {
        return {
            serverUrl: 'http://localhost:5000',
            defaultStepRatio: 0.0025,
            defaultMaxIterations: 1000,
            stepRatioRange: { min: 0.001, max: 1, step: 0.001 },
            iterationsRange: { min: 100, max: 10000, step: 100 }
        };
    }
    
    init() {
        this.availableModels = [];
        this.selectedModel = null;
        this.modelParameters = {
            stepRatio: this.options.defaultStepRatio,
            maxIterations: this.options.defaultMaxIterations
        };
        
        super.init();
        
        // Listen for graph events to enable/disable model selection
        this.on('graph:loaded', () => {
            this.enable();
        });
        
        this.on('graph:cleared', () => {
            this.disable();
        });
        
        // Load available models
        this.loadAvailableModels();
    }
    
    setupEventListeners() {
        super.setupEventListeners();
        
        // Model selection
        const modelSelect = this.container.querySelector('#modelSelect');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                this.selectModel(e.target.value);
            });
        }
        
        // Step ratio input
        const stepRatioInput = this.container.querySelector('#stepRatio');
        if (stepRatioInput) {
            stepRatioInput.addEventListener('input', (e) => {
                this.updateParameter('stepRatio', parseFloat(e.target.value));
            });
        }
        
        // Max iterations input
        const maxIterationsInput = this.container.querySelector('#maxIterations');
        if (maxIterationsInput) {
            maxIterationsInput.addEventListener('input', (e) => {
                this.updateParameter('maxIterations', parseInt(e.target.value));
            });
        }
        
        // Dismantle button
        const dismantleBtn = this.container.querySelector('#dismantleBtn');
        if (dismantleBtn) {
            dismantleBtn.addEventListener('click', () => {
                this.startDismantling();
            });
        }
    }
    
    render() {
        this.updateModelSelectUI();
        this.updateParameterInputs();
        this.updateDismantleButton();
    }
    
    async loadAvailableModels() {
        try {
            this.showLoading('Loading models...');
            
            const response = await fetch(`${this.options.serverUrl}/api/models`);
            const data = await response.json();
            
            if (data.success) {
                this.availableModels = data.models;
                this.setState({ modelsLoaded: true });
                this.populateModelSelect(data.models);
            } else {
                this.showError('Failed to load models: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to load models: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    populateModelSelect(models) {
        const select = this.container.querySelector('#modelSelect');
        if (!select) return;
        
        select.innerHTML = '';
        
        if (models.length === 0) {
            select.innerHTML = '<option value="">No models available</option>';
            this.disable();
            return;
        }
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `${model.name} ${model.loaded ? '(Loaded)' : ''}`;
            select.appendChild(option);
        });
        
        // Select first model by default
        if (models.length > 0) {
            this.selectModel(models[0].name);
            select.value = models[0].name;
        }
    }
    
    updateModelSelectUI() {
        const select = this.container.querySelector('#modelSelect');
        if (!select) return;
        
        if (this.state.disabled) {
            select.disabled = true;
        } else {
            select.disabled = false;
        }
    }
    
    updateParameterInputs() {
        const stepRatioInput = this.container.querySelector('#stepRatio');
        const maxIterationsInput = this.container.querySelector('#maxIterations');
        
        if (stepRatioInput) {
            stepRatioInput.value = this.modelParameters.stepRatio;
            stepRatioInput.disabled = this.state.disabled;
        }
        
        if (maxIterationsInput) {
            maxIterationsInput.value = this.modelParameters.maxIterations;
            maxIterationsInput.disabled = this.state.disabled;
        }
    }
    
    updateDismantleButton() {
        const dismantleBtn = this.container.querySelector('#dismantleBtn');
        if (!dismantleBtn) return;
        
        const canDismantle = this.selectedModel && !this.state.disabled && !this.state.loading;
        dismantleBtn.disabled = !canDismantle;
    }
    
    selectModel(modelName) {
        const model = this.availableModels.find(m => m.name === modelName);
        if (model) {
            this.selectedModel = model;
            this.setState({ selectedModel: modelName });
            this.emit('model:selected', { model: model });
        }
    }
    
    updateParameter(paramName, value) {
        if (this.validateParameter(paramName, value)) {
            this.modelParameters[paramName] = value;
            this.setState({ parameters: { ...this.modelParameters } });
            this.emit('model:parameter-changed', { 
                parameter: paramName, 
                value: value,
                allParameters: this.modelParameters
            });
        }
    }
    
    validateParameter(paramName, value) {
        switch (paramName) {
            case 'stepRatio':
                const stepRange = this.options.stepRatioRange;
                if (value < stepRange.min || value > stepRange.max) {
                    this.showError(`Step ratio must be between ${stepRange.min} and ${stepRange.max}`);
                    return false;
                }
                break;
                
            case 'maxIterations':
                const iterRange = this.options.iterationsRange;
                if (value < iterRange.min || value > iterRange.max) {
                    this.showError(`Max iterations must be between ${iterRange.min} and ${iterRange.max}`);
                    return false;
                }
                break;
        }
        
        this.clearError();
        return true;
    }
    
    async startDismantling() {
        if (!this.selectedModel) {
            this.showError('No model selected');
            return;
        }
        
        // Get current graph from GraphUploadComponent
        const graphUploadComponent = ComponentManager.getInstance().getComponent('graph-input');
        if (!graphUploadComponent || !graphUploadComponent.getCurrentGraph()) {
            this.showError('No graph loaded');
            return;
        }
        
        const requestData = {
            graph: graphUploadComponent.getCurrentGraph(),
            model: this.selectedModel.name,
            step_ratio: this.modelParameters.stepRatio,
            max_iterations: this.modelParameters.maxIterations
        };
        
        try {
            this.showLoading('Starting dismantling...');
            this.emit('dismantling:started', { model: this.selectedModel, parameters: this.modelParameters });
            
            const response = await fetch(`${this.options.serverUrl}/api/dismantle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.setState({ lastResults: data.result });
                this.emit('dismantling:completed', { 
                    results: data.result,
                    model: this.selectedModel,
                    parameters: this.modelParameters
                });
            } else {
                this.showError('Dismantling failed: ' + data.error);
                this.emit('dismantling:failed', { error: data.error });
            }
        } catch (error) {
            this.showError('Dismantling failed: ' + error.message);
            this.emit('dismantling:failed', { error: error.message });
        } finally {
            this.hideLoading();
        }
    }
    
    getSelectedModel() {
        return this.selectedModel;
    }
    
    getModelParameters() {
        return { ...this.modelParameters };
    }
    
    getAvailableModels() {
        return [...this.availableModels];
    }
    
    resetParameters() {
        this.modelParameters = {
            stepRatio: this.options.defaultStepRatio,
            maxIterations: this.options.defaultMaxIterations
        };
        
        this.setState({ parameters: { ...this.modelParameters } });
        this.updateParameterInputs();
        
        this.emit('model:parameters-reset', { parameters: this.modelParameters });
    }
    
    // Method to set parameters programmatically
    setParameters(parameters) {
        Object.keys(parameters).forEach(key => {
            if (this.validateParameter(key, parameters[key])) {
                this.modelParameters[key] = parameters[key];
            }
        });
        
        this.setState({ parameters: { ...this.modelParameters } });
        this.updateParameterInputs();
        
        this.emit('model:parameters-updated', { parameters: this.modelParameters });
    }
}