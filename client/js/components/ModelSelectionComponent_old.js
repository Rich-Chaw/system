/**
 * Multi-Model Selection Component
 * Handles multiple model configurations and parameter management
 */
class ModelSelectionComponent extends BaseComponent {
    getDefaultOptions() {
        return {
            serverUrl: 'http://localhost:5000',
            defaultStepRatio: 0.0025,
            defaultMaxIterations: 1000,
            stepRatioRange: { min: 0.001, max: 1, step: 0.001 },
            iterationsRange: { min: 100, max: 10000, step: 100 },
            maxModels: 5,
            defaultModelName: 'Model'
        };
    }

    init() {
        this.availableModels = [];
        this.modelConfigurations = [];
        this.nextModelId = 1;

        super.init();

        // Enable the component by default for now (in production, disable until graph is loaded)
        this.enable();

        // Listen for graph events to enable/disable model selection
        this.on('graph:loaded', () => {
            this.enable();
        });

        this.on('graph:cleared', () => {
            this.disable();
        });

        // Load available models first, then initialize with default configuration
        this.loadAvailableModels();
    }

    setupEventListeners() {
        super.setupEventListeners();

        // Button click handlers
        this.container.addEventListener('click', (e) => {
            console.log('Click event:', e.target.className, e.target.matches('.add-model-btn'));
            
            if (e.target.matches('.add-model-btn') || e.target.closest('.add-model-btn')) {
                e.preventDefault();
                console.log('Add model button clicked');
                this.addModelConfiguration();
            }

            // Remove model button
            if (e.target.matches('.remove-model-btn') || e.target.closest('.remove-model-btn')) {
                e.preventDefault();
                const btn = e.target.matches('.remove-model-btn') ? e.target : e.target.closest('.remove-model-btn');
                const modelId = btn.dataset.modelId;
                console.log('Remove model button clicked for ID:', modelId);
                
                const modelConfig = this.modelConfigurations.find(config => config.id === parseInt(modelId));
                if (modelConfig && confirm(`Are you sure you want to remove "${modelConfig.name}"?`)) {
                    this.removeModelConfiguration(modelId);
                }
            }

            // Dismantle button
            if (e.target.matches('#dismantleBtn')) {
                e.preventDefault();
                this.startDismantling();
            }
        });

        // Model configuration changes (checkbox handling)
        this.container.addEventListener('change', (e) => {
            if (e.target.matches('.model-enabled-checkbox')) {
                const modelId = e.target.dataset.modelId;
                this.toggleModelConfiguration(modelId, e.target.checked);
                this.performRealTimeValidation();
            }
        });

        // Parameter inputs with real-time validation
        this.container.addEventListener('input', (e) => {
            const modelId = e.target.dataset.modelId;
            if (!modelId) return;
            
            console.log('Input event:', e.target.className, 'for model ID:', modelId);
            
            if (e.target.matches('.step-ratio-input')) {
                const value = parseFloat(e.target.value);
                this.updateModelConfigurationWithValidation(modelId, 'stepRatio', value);
            }

            if (e.target.matches('.max-iterations-input')) {
                const value = parseInt(e.target.value);
                this.updateModelConfigurationWithValidation(modelId, 'maxIterations', value);
            }

            if (e.target.matches('.model-name-input')) {
                this.updateModelConfigurationWithValidation(modelId, 'name', e.target.value);
            }
        });
        
        // Model selection changes
        this.container.addEventListener('change', (e) => {
            const modelId = e.target.dataset.modelId;
            if (!modelId) return;
            
            console.log('Change event:', e.target.className, 'for model ID:', modelId);
            
            if (e.target.matches('.model-select')) {
                this.updateModelConfigurationWithValidation(modelId, 'selectedModel', e.target.value);
            }
        });

        // Blur events for additional validation
        this.container.addEventListener('blur', (e) => {
            if (e.target.matches('.model-name-input, .step-ratio-input, .max-iterations-input')) {
                this.performRealTimeValidation();
            }
        }, true);
    }

    render() {
        console.log('ModelSelectionComponent render called:', {
            loading: this.state.loading,
            modelsLoaded: this.state.modelsLoaded,
            modelConfigurations: this.modelConfigurations.length,
            availableModels: this.availableModels.length
        });

        // Always render to show loading/error states
        this.renderModelConfigurations();
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

                // Initialize with one default model configuration after models are loaded
                if (this.modelConfigurations.length === 0) {
                    this.addModelConfiguration();
                }

                this.render(); // Re-render to populate model selects
            } else {
                this.showError('Failed to load models: ' + data.error);
            }
        } catch (error) {
            this.showError('Failed to load models: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    addModelConfiguration() {
        console.log('addModelConfiguration called - current count:', this.modelConfigurations.length);

        if (this.modelConfigurations.length >= this.options.maxModels) {
            alert(`Maximum ${this.options.maxModels} models allowed`);
            return;
        }

        const modelConfig = {
            id: this.nextModelId++,
            name: `${this.options.defaultModelName} ${this.modelConfigurations.length + 1}`,
            selectedModel: this.availableModels.length > 0 ? this.availableModels[0].name : '',
            stepRatio: this.options.defaultStepRatio,
            maxIterations: this.options.defaultMaxIterations,
            enabled: true,
            errors: {}
        };

        console.log('Adding model config:', modelConfig);

        this.modelConfigurations.push(modelConfig);
        this.setState({ modelConfigurations: [...this.modelConfigurations] });

        console.log('Model configurations after add:', this.modelConfigurations.length);

        // Perform validation on the new configuration
        this.performRealTimeValidation();
        
        this.render();
        
        // Emit event for other components
        this.emit('model:added', { modelId: modelConfig.id, config: modelConfig });
        console.log('ModelSelectionComponent emitting models:changed event:', this.modelConfigurations);
        this.emit('models:changed', { models: this.modelConfigurations });
    }



    removeModelConfiguration(modelId) {
        if (this.modelConfigurations.length <= 1) {
            this.showError('At least one model configuration is required');
            return;
        }

        this.modelConfigurations = this.modelConfigurations.filter(config => config.id !== parseInt(modelId));
        this.setState({ modelConfigurations: [...this.modelConfigurations] });

        this.emit('model:removed', { modelId });
        this.emit('models:changed', { models: this.modelConfigurations });
        this.performRealTimeValidation();
        this.render();
    }

    toggleModelConfiguration(modelId, enabled) {
        const config = this.modelConfigurations.find(c => c.id === parseInt(modelId));
        if (!config) return;

        config.enabled = enabled;
        this.setState({ modelConfigurations: [...this.modelConfigurations] });
        
        this.emit('model:toggled', { modelId, enabled, config });
        this.emit('models:changed', { models: this.modelConfigurations });
        this.performRealTimeValidation();
    }

    updateSimpleModelConfiguration(modelId, field, value) {
        console.log('updateSimpleModelConfiguration:', modelId, field, value);
        
        const config = this.modelConfigurations.find(c => c.id === parseInt(modelId));
        if (!config) {
            console.error('Model configuration not found for ID:', modelId);
            return;
        }

        config[field] = value;
        this.setState({ modelConfigurations: [...this.modelConfigurations] });
        
        console.log('Updated config:', config);
    }

    updateModelConfigurationWithValidation(modelId, field, value) {
        console.log('updateModelConfigurationWithValidation:', modelId, field, value);
        
        const config = this.modelConfigurations.find(c => c.id === parseInt(modelId));
        if (!config) {
            console.error('Model configuration not found for ID:', modelId);
            return;
        }

        // Initialize errors object if it doesn't exist
        if (!config.errors) {
            config.errors = {};
        }

        // Validate the value
        const validation = this.validateModelParameter(field, value, config);
        if (!validation.isValid) {
            config.errors[field] = validation.error;
        } else {
            delete config.errors[field];
            config[field] = value;
        }

        this.setState({ modelConfigurations: [...this.modelConfigurations] });
        this.performRealTimeValidation();
        
        console.log('Updated config with validation:', config);
    }

    performRealTimeValidation() {
        let hasErrors = false;
        
        this.modelConfigurations.forEach(config => {
            if (!config.errors) config.errors = {};
            
            // Validate all fields
            ['name', 'selectedModel', 'stepRatio', 'maxIterations'].forEach(field => {
                const validation = this.validateModelParameter(field, config[field], config);
                if (!validation.isValid) {
                    config.errors[field] = validation.error;
                    hasErrors = true;
                } else {
                    delete config.errors[field];
                }
            });
        });

        this.setState({ 
            hasValidationErrors: hasErrors,
            modelConfigurations: [...this.modelConfigurations]
        });

        this.updateDismantleButton();
    }

    showRemoveConfirmation(modelId) {
        const modelConfig = this.modelConfigurations.find(config => config.id === parseInt(modelId));
        if (!modelConfig) return;

        if (confirm(`Are you sure you want to remove "${modelConfig.name}"?`)) {
            this.removeModelConfiguration(modelId);
        }
    }

    updateModelConfiguration(modelId, field, value) {
        const config = this.modelConfigurations.find(c => c.id === parseInt(modelId));
        if (!config) return;

        // Validate the value
        const validation = this.validateModelParameter(field, value, config);
        if (!validation.isValid) {
            config.errors[field] = validation.error;
        } else {
            delete config.errors[field];
            config[field] = value;
        }

        this.setState({ modelConfigurations: [...this.modelConfigurations] });
        this.emit('model:configuration-updated', { modelId, field, value, config });

        // Re-render to update validation display
        this.render();
    }

    validateModelParameter(field, value, config) {
        switch (field) {
            case 'name':
                if (!value || value.trim() === '') {
                    return { isValid: false, error: 'Model name is required' };
                }
                // Check for duplicate names
                const duplicateName = this.modelConfigurations.find(c =>
                    c.id !== config.id && c.name.trim() === value.trim()
                );
                if (duplicateName) {
                    return { isValid: false, error: 'Model name must be unique' };
                }
                break;

            case 'stepRatio':
                const stepRange = this.options.stepRatioRange;
                if (isNaN(value) || value < stepRange.min || value > stepRange.max) {
                    return { isValid: false, error: `Step ratio must be between ${stepRange.min} and ${stepRange.max}` };
                }
                break;

            case 'maxIterations':
                const iterRange = this.options.iterationsRange;
                if (isNaN(value) || value < iterRange.min || value > iterRange.max) {
                    return { isValid: false, error: `Max iterations must be between ${iterRange.min} and ${iterRange.max}` };
                }
                break;

            case 'selectedModel':
                if (!value || !this.availableModels.find(m => m.name === value)) {
                    return { isValid: false, error: 'Please select a valid model' };
                }
                break;
        }

        return { isValid: true };
    }

    updateDismantleButton() {
        const dismantleBtn = this.container.querySelector('#dismantleBtn');
        if (!dismantleBtn) return;

        const enabledModels = this.modelConfigurations.filter(config =>
            config.enabled && config.selectedModel && Object.keys(config.errors).length === 0
        );

        const canDismantle = enabledModels.length > 0 && !this.state.disabled && !this.state.loading;
        dismantleBtn.disabled = !canDismantle;

        // Update button text to reflect number of models
        if (enabledModels.length > 1) {
            dismantleBtn.innerHTML = `<i class="fas fa-play"></i> Start Dismantling (${enabledModels.length} models)`;
        } else {
            dismantleBtn.innerHTML = '<i class="fas fa-play"></i> Start Dismantling';
        }
    }

    renderModelConfigurations() {
        const cardBody = this.container.querySelector('.card-body');
        if (!cardBody) {
            console.error('Card body not found!');
            return;
        }

        console.log('Rendering configurations:', {
            loading: this.state.loading,
            modelsLoaded: this.state.modelsLoaded,
            modelConfigurations: this.modelConfigurations.length,
            availableModels: this.availableModels.length
        });

        // Clear existing content
        cardBody.innerHTML = '';

        // Show loading state
        if (this.state.loading) {
            cardBody.innerHTML = `
                <div class="text-center p-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2 text-muted">${this.state.loadingMessage || 'Loading models...'}</p>
                </div>
            `;
            return;
        }

        // Show error state
        if (this.state.error) {
            cardBody.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i> ${this.state.error}
                </div>
            `;
            return;
        }

        // Create the interface
        this.createSimpleInterface(cardBody);
    }

    createSimpleInterface(cardBody) {
        // Add header
        const header = document.createElement('div');
        header.className = 'mb-3';
        
        const enabledCount = this.modelConfigurations.filter(c => c.enabled).length;
        const validCount = this.modelConfigurations.filter(c => c.enabled && Object.keys(c.errors || {}).length === 0).length;
        
        header.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-0">Model Configurations</h6>
                    <small class="text-muted">${enabledCount} enabled, ${validCount} valid</small>
                </div>
                <button class="btn btn-outline-primary btn-sm add-model-btn">
                    <i class="fas fa-plus"></i> Add Model
                </button>
            </div>
        `;
        cardBody.appendChild(header);

        // Render model configurations
        console.log('About to render', this.modelConfigurations.length, 'configurations');
        this.modelConfigurations.forEach((config, index) => {
            console.log('Rendering config', index, config);
            try {
                const configElement = this.createSimpleModelElement(config, index);
                cardBody.appendChild(configElement);
            } catch (error) {
                console.error('Error creating model element:', error);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'alert alert-danger';
                errorDiv.textContent = `Error rendering model ${index + 1}: ${error.message}`;
                cardBody.appendChild(errorDiv);
            }
        });

        // Add validation summary if there are issues
        if (this.state.hasValidationErrors || (this.state.conflicts && this.state.conflicts.length > 0)) {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'validation-summary alert alert-warning mt-3';

            let summaryHtml = '<h6><i class="fas fa-exclamation-triangle"></i> Configuration Issues</h6><ul class="mb-0">';

            // Count errors by type
            const errorCounts = {};
            this.modelConfigurations.forEach(config => {
                Object.keys(config.errors).forEach(errorType => {
                    errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
                });
            });

            Object.keys(errorCounts).forEach(errorType => {
                summaryHtml += `<li>${errorCounts[errorType]} model(s) have ${errorType} errors</li>`;
            });

            if (this.state.conflicts && this.state.conflicts.length > 0) {
                summaryHtml += `<li>${this.state.conflicts.length} configuration conflict(s) detected</li>`;
            }

            summaryHtml += '</ul>';
            summaryDiv.innerHTML = summaryHtml;
            cardBody.appendChild(summaryDiv);
        }

        // Add dismantle button (only once)
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'd-grid gap-2 mt-3';
        buttonContainer.innerHTML = `
            <button class="btn btn-primary" id="dismantleBtn" disabled>
                <i class="fas fa-play"></i> Start Dismantling
            </button>
        `;
        cardBody.appendChild(buttonContainer);

        // Update dismantle button state
        this.updateDismantleButton();
    }

    createSimpleModelElement(config, index) {
        const configDiv = document.createElement('div');
        configDiv.className = 'card mb-3';
        
        // Initialize errors if not present
        if (!config.errors) config.errors = {};
        
        const hasErrors = Object.keys(config.errors).length > 0;
        const canRemove = this.modelConfigurations.length > 1;
        
        // Set border color based on validation state
        if (hasErrors) {
            configDiv.style.border = '2px solid #dc3545'; // Red for errors
        } else if (config.name && config.selectedModel) {
            configDiv.style.border = '2px solid #28a745'; // Green for valid
        } else {
            configDiv.style.border = '2px solid #007bff'; // Blue for default
        }
        
        configDiv.innerHTML = `
            <div class="card-header">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <h6 class="mb-0 me-2">Model ${index + 1}</h6>
                        ${hasErrors ? '<i class="fas fa-exclamation-triangle text-warning" title="Has validation errors"></i>' : ''}
                        ${!hasErrors && config.name && config.selectedModel ? '<i class="fas fa-check-circle text-success" title="Configuration valid"></i>' : ''}
                    </div>
                    <button class="btn btn-outline-danger btn-sm remove-model-btn" 
                            data-model-id="${config.id}" 
                            ${!canRemove ? 'disabled' : ''}
                            title="${!canRemove ? 'At least one model is required' : 'Remove this model'}">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Model Name</label>
                            <input type="text" class="form-control model-name-input ${config.errors.name ? 'is-invalid' : (config.name ? 'is-valid' : '')}" 
                                   data-model-id="${config.id}" 
                                   value="${config.name || ''}"
                                   placeholder="Enter model name">
                            ${config.errors.name ? `<div class="invalid-feedback">${config.errors.name}</div>` : ''}
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Algorithm</label>
                            <select class="form-select model-select ${config.errors.selectedModel ? 'is-invalid' : (config.selectedModel ? 'is-valid' : '')}" 
                                    data-model-id="${config.id}">
                                ${this.renderSimpleModelOptions(config.selectedModel)}
                            </select>
                            ${config.errors.selectedModel ? `<div class="invalid-feedback">${config.errors.selectedModel}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Step Ratio</label>
                            <input type="number" class="form-control step-ratio-input ${config.errors.stepRatio ? 'is-invalid' : (config.stepRatio ? 'is-valid' : '')}" 
                                   data-model-id="${config.id}"
                                   value="${config.stepRatio || 0.0025}" 
                                   min="0.001" max="1" step="0.001">
                            <div class="form-text">Fraction of nodes to consider per iteration</div>
                            ${config.errors.stepRatio ? `<div class="invalid-feedback">${config.errors.stepRatio}</div>` : ''}
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Max Iterations</label>
                            <input type="number" class="form-control max-iterations-input ${config.errors.maxIterations ? 'is-invalid' : (config.maxIterations ? 'is-valid' : '')}" 
                                   data-model-id="${config.id}"
                                   value="${config.maxIterations || 1000}" 
                                   min="100" max="10000" step="100">
                            ${config.errors.maxIterations ? `<div class="invalid-feedback">${config.errors.maxIterations}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        return configDiv;
    }

    renderSimpleModelOptions(selectedModel) {
        if (this.availableModels.length === 0) {
            return '<option value="">No models available</option>';
        }
        
        let options = '<option value="">Select a model...</option>';
        this.availableModels.forEach(model => {
            const selected = model.name === selectedModel ? 'selected' : '';
            options += `<option value="${model.name}" ${selected}>${model.name}</option>`;
        });
        
        return options;
    }

    createModelConfigurationElement(config, index) {
        const configDiv = document.createElement('div');
        configDiv.className = `model-configuration mb-3 p-3 border rounded ${!config.enabled ? 'disabled-config' : ''}`;
        configDiv.style.backgroundColor = config.enabled ? '#f8f9fa' : '#f1f3f4';
        configDiv.style.opacity = config.enabled ? '1' : '0.7';

        const canRemove = this.modelConfigurations.length > 1;
        const hasErrors = Object.keys(config.errors).length > 0;

        configDiv.innerHTML = `
            <div class="model-config-header d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-center">
                    <div class="form-check me-3">
                        <input class="form-check-input model-enabled-checkbox" type="checkbox" 
                               data-model-id="${config.id}" 
                               ${config.enabled ? 'checked' : ''}
                               ${this.state.disabled ? 'disabled' : ''}>
                        <label class="form-check-label">
                            <h6 class="mb-0">Model ${index + 1}</h6>
                        </label>
                    </div>
                    ${hasErrors ? '<i class="fas fa-exclamation-triangle text-warning" title="Configuration has errors"></i>' : ''}
                    ${!hasErrors && config.enabled ? '<i class="fas fa-check-circle text-success" title="Configuration is valid"></i>' : ''}
                </div>
                <div class="btn-group">
                    <button class="btn btn-outline-secondary btn-sm" 
                            onclick="this.closest('.model-configuration').querySelector('.advanced-options').classList.toggle('d-none')"
                            title="Toggle advanced options">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm remove-model-btn" 
                            data-model-id="${config.id}" 
                            ${!canRemove ? 'disabled' : ''}
                            title="${!canRemove ? 'At least one model is required' : 'Remove this model'}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Model Name</label>
                        <input type="text" class="form-control model-name-input ${config.errors.name ? 'is-invalid' : (config.name && !config.errors.name ? 'is-valid' : '')}" 
                               data-model-id="${config.id}" 
                               value="${config.name}"
                               ${this.state.disabled || !config.enabled ? 'disabled' : ''}>
                        ${config.errors.name ? `<div class="invalid-feedback">${config.errors.name}</div>` : ''}
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Algorithm</label>
                        <select class="form-select model-select ${config.errors.selectedModel ? 'is-invalid' : (config.selectedModel && !config.errors.selectedModel ? 'is-valid' : '')}" 
                                data-model-id="${config.id}"
                                ${this.state.disabled || !config.enabled ? 'disabled' : ''}>
                            ${this.renderModelOptions(config.selectedModel)}
                        </select>
                        ${config.errors.selectedModel ? `<div class="invalid-feedback">${config.errors.selectedModel}</div>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Step Ratio</label>
                        <input type="number" class="form-control step-ratio-input ${config.errors.stepRatio ? 'is-invalid' : (!config.errors.stepRatio && config.stepRatio ? 'is-valid' : '')}" 
                               data-model-id="${config.id}"
                               value="${config.stepRatio}" 
                               min="${this.options.stepRatioRange.min}" 
                               max="${this.options.stepRatioRange.max}" 
                               step="${this.options.stepRatioRange.step}"
                               ${this.state.disabled || !config.enabled ? 'disabled' : ''}>
                        <div class="form-text">Fraction of nodes to consider per iteration</div>
                        ${config.errors.stepRatio ? `<div class="invalid-feedback">${config.errors.stepRatio}</div>` : ''}
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">Max Iterations</label>
                        <input type="number" class="form-control max-iterations-input ${config.errors.maxIterations ? 'is-invalid' : (!config.errors.maxIterations && config.maxIterations ? 'is-valid' : '')}" 
                               data-model-id="${config.id}"
                               value="${config.maxIterations}" 
                               min="${this.options.iterationsRange.min}" 
                               max="${this.options.iterationsRange.max}" 
                               step="${this.options.iterationsRange.step}"
                               ${this.state.disabled || !config.enabled ? 'disabled' : ''}>
                        ${config.errors.maxIterations ? `<div class="invalid-feedback">${config.errors.maxIterations}</div>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="advanced-options d-none">
                <hr>
                <div class="row">
                    <div class="col-12">
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-muted">Configuration Status: 
                                ${hasErrors ? '<span class="text-danger">Has Errors</span>' : '<span class="text-success">Valid</span>'}
                            </small>
                            <button class="btn btn-outline-info btn-sm" 
                                    onclick="alert('Model ID: ${config.id}\\nEnabled: ${config.enabled}\\nErrors: ${Object.keys(config.errors).length}')"
                                    title="Show debug info">
                                <i class="fas fa-info-circle"></i> Debug
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return configDiv;
    }

    renderModelOptions(selectedModel) {
        if (this.availableModels.length === 0) {
            return '<option value="">Loading models...</option>';
        }

        let options = '<option value="">Select a model...</option>';
        this.availableModels.forEach(model => {
            const selected = model.name === selectedModel ? 'selected' : '';
            options += `<option value="${model.name}" ${selected}>${model.name} ${model.loaded ? '(Loaded)' : ''}</option>`;
        });

        return options;
    }

    async startDismantling() {
        // Get enabled models with valid configurations
        const enabledModels = this.modelConfigurations.filter(config =>
            config.enabled && config.selectedModel && Object.keys(config.errors).length === 0
        );

        if (enabledModels.length === 0) {
            this.showError('No valid model configurations found');
            return;
        }

        // Get current graph from GraphUploadComponent
        const graphUploadComponent = ComponentManager.getInstance().getComponent('graph-input');
        if (!graphUploadComponent || !graphUploadComponent.getCurrentGraph()) {
            this.showError('No graph loaded');
            return;
        }

        const graph = graphUploadComponent.getCurrentGraph();

        try {
            this.showLoading(`Starting dismantling with ${enabledModels.length} model(s)...`);
            this.emit('dismantling:started', { models: enabledModels });

            // Process each model
            const results = [];
            for (let i = 0; i < enabledModels.length; i++) {
                const config = enabledModels[i];

                this.showLoading(`Processing ${config.name} (${i + 1}/${enabledModels.length})...`);

                const requestData = {
                    graph: graph,
                    model: config.selectedModel,
                    step_ratio: config.stepRatio,
                    max_iterations: config.maxIterations
                };

                const response = await fetch(`${this.options.serverUrl}/api/dismantle`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });

                const data = await response.json();

                if (data.success) {
                    results.push({
                        modelConfig: config,
                        result: data.result
                    });
                } else {
                    this.showError(`Dismantling failed for ${config.name}: ${data.error}`);
                    this.emit('dismantling:failed', { error: data.error, modelConfig: config });
                    return;
                }
            }

            this.setState({ lastResults: results });
            console.log('ModelSelectionComponent emitting dismantling:completed event:', results);
            this.emit('dismantling:completed', {
                results: results,
                modelConfigurations: enabledModels
            });

        } catch (error) {
            this.showError('Dismantling failed: ' + error.message);
            this.emit('dismantling:failed', { error: error.message });
        } finally {
            this.hideLoading();
        }
    }

    getModelConfigurations() {
        return [...this.modelConfigurations];
    }

    getEnabledModelConfigurations() {
        return this.modelConfigurations.filter(config =>
            config.enabled && config.selectedModel && Object.keys(config.errors).length === 0
        );
    }

    getAvailableModels() {
        return [...this.availableModels];
    }

    resetAllConfigurations() {
        this.modelConfigurations = [];
        this.nextModelId = 1;
        this.addModelConfiguration();

        this.setState({ modelConfigurations: [...this.modelConfigurations] });
        this.emit('model:configurations-reset');
        this.render();
    }

    // Method to set model configuration programmatically
    setModelConfiguration(modelId, configuration) {
        const config = this.modelConfigurations.find(c => c.id === modelId);
        if (!config) return false;

        Object.keys(configuration).forEach(key => {
            const validation = this.validateModelParameter(key, configuration[key], config);
            if (validation.isValid) {
                config[key] = configuration[key];
                delete config.errors[key];
            } else {
                config.errors[key] = validation.error;
            }
        });

        this.setState({ modelConfigurations: [...this.modelConfigurations] });
        this.emit('model:configuration-updated', { modelId, configuration });
        this.render();

        return Object.keys(config.errors).length === 0;
    }

    // Method to enable/disable a model configuration
    toggleModelConfiguration(modelId, enabled) {
        const config = this.modelConfigurations.find(c => c.id === modelId);
        if (config) {
            config.enabled = enabled;
            this.setState({ modelConfigurations: [...this.modelConfigurations] });
            this.emit('model:configuration-toggled', { modelId, enabled });
            this.render();
        }
    }

    // Method to detect conflicts between model configurations
    detectConfigurationConflicts() {
        const conflicts = [];

        // Check for duplicate names
        const nameGroups = {};
        this.modelConfigurations.forEach(config => {
            const name = config.name.trim().toLowerCase();
            if (!nameGroups[name]) nameGroups[name] = [];
            nameGroups[name].push(config);
        });

        Object.keys(nameGroups).forEach(name => {
            if (nameGroups[name].length > 1) {
                conflicts.push({
                    type: 'duplicate_name',
                    message: `Duplicate model name: "${name}"`,
                    models: nameGroups[name].map(c => c.id)
                });
            }
        });

        // Check for parameter conflicts (e.g., identical configurations)
        for (let i = 0; i < this.modelConfigurations.length; i++) {
            for (let j = i + 1; j < this.modelConfigurations.length; j++) {
                const config1 = this.modelConfigurations[i];
                const config2 = this.modelConfigurations[j];

                if (config1.selectedModel === config2.selectedModel &&
                    config1.stepRatio === config2.stepRatio &&
                    config1.maxIterations === config2.maxIterations) {
                    conflicts.push({
                        type: 'identical_configuration',
                        message: `Identical configurations found: "${config1.name}" and "${config2.name}"`,
                        models: [config1.id, config2.id]
                    });
                }
            }
        }

        return conflicts;
    }

    // Real-time validation with error messages
    performRealTimeValidation() {
        let hasErrors = false;

        // Validate each configuration
        this.modelConfigurations.forEach(config => {
            const errors = {};

            // Validate name
            const nameValidation = this.validateModelParameter('name', config.name, config);
            if (!nameValidation.isValid) {
                errors.name = nameValidation.error;
                hasErrors = true;
            }

            // Validate selected model
            const modelValidation = this.validateModelParameter('selectedModel', config.selectedModel, config);
            if (!modelValidation.isValid) {
                errors.selectedModel = modelValidation.error;
                hasErrors = true;
            }

            // Validate step ratio
            const stepRatioValidation = this.validateModelParameter('stepRatio', config.stepRatio, config);
            if (!stepRatioValidation.isValid) {
                errors.stepRatio = stepRatioValidation.error;
                hasErrors = true;
            }

            // Validate max iterations
            const iterationsValidation = this.validateModelParameter('maxIterations', config.maxIterations, config);
            if (!iterationsValidation.isValid) {
                errors.maxIterations = iterationsValidation.error;
                hasErrors = true;
            }

            config.errors = errors;
        });

        // Check for conflicts
        const conflicts = this.detectConfigurationConflicts();
        if (conflicts.length > 0) {
            hasErrors = true;
            this.displayConflictWarnings(conflicts);
        } else {
            this.clearConflictWarnings();
        }

        this.setState({
            hasValidationErrors: hasErrors,
            conflicts: conflicts
        });

        return !hasErrors;
    }

    // Display conflict warnings
    displayConflictWarnings(conflicts) {
        let warningContainer = this.container.querySelector('.conflict-warnings');

        if (!warningContainer) {
            warningContainer = document.createElement('div');
            warningContainer.className = 'conflict-warnings alert alert-warning mt-2';

            const header = this.container.querySelector('.model-selection-header');
            if (header) {
                header.parentNode.insertBefore(warningContainer, header.nextSibling);
            }
        }

        let warningHtml = '<h6><i class="fas fa-exclamation-triangle"></i> Configuration Conflicts</h6><ul class="mb-0">';
        conflicts.forEach(conflict => {
            warningHtml += `<li>${conflict.message}</li>`;
        });
        warningHtml += '</ul>';

        warningContainer.innerHTML = warningHtml;
    }

    // Clear conflict warnings
    clearConflictWarnings() {
        const warningContainer = this.container.querySelector('.conflict-warnings');
        if (warningContainer) {
            warningContainer.remove();
        }
    }

    // Enhanced model state management
    getModelConfigurationState(modelId) {
        const config = this.modelConfigurations.find(c => c.id === modelId);
        if (!config) return null;

        return {
            id: config.id,
            name: config.name,
            selectedModel: config.selectedModel,
            stepRatio: config.stepRatio,
            maxIterations: config.maxIterations,
            enabled: config.enabled,
            hasErrors: Object.keys(config.errors).length > 0,
            errors: { ...config.errors },
            isValid: Object.keys(config.errors).length === 0 && config.selectedModel && config.name.trim()
        };
    }

    // Bulk operations for model configurations
    enableAllModels() {
        this.modelConfigurations.forEach(config => {
            config.enabled = true;
        });
        this.setState({ modelConfigurations: [...this.modelConfigurations] });
        this.emit('model:bulk-enabled');
        this.render();
    }

    disableAllModels() {
        this.modelConfigurations.forEach(config => {
            config.enabled = false;
        });
        this.setState({ modelConfigurations: [...this.modelConfigurations] });
        this.emit('model:bulk-disabled');
        this.render();
    }

    // Auto-fix common configuration issues
    autoFixConfigurations() {
        let fixesApplied = 0;

        // Fix duplicate names by adding numbers
        const nameGroups = {};
        this.modelConfigurations.forEach(config => {
            const baseName = config.name.replace(/\s+\d+$/, '').trim();
            if (!nameGroups[baseName]) nameGroups[baseName] = [];
            nameGroups[baseName].push(config);
        });

        Object.keys(nameGroups).forEach(baseName => {
            const configs = nameGroups[baseName];
            if (configs.length > 1) {
                configs.forEach((config, index) => {
                    if (index > 0) {
                        config.name = `${baseName} ${index + 1}`;
                        fixesApplied++;
                    }
                });
            }
        });

        // Set default model for configurations without one
        this.modelConfigurations.forEach(config => {
            if (!config.selectedModel && this.availableModels.length > 0) {
                config.selectedModel = this.availableModels[0].name;
                fixesApplied++;
            }
        });

        if (fixesApplied > 0) {
            this.setState({ modelConfigurations: [...this.modelConfigurations] });
            this.emit('model:auto-fixed', { fixesApplied });
            this.render();
            this.showSuccess(`Applied ${fixesApplied} automatic fix(es) to model configurations`);
        }

        return fixesApplied;
    }

    // Show success message
    showSuccess(message) {
        // Create a temporary success alert
        const successAlert = document.createElement('div');
        successAlert.className = 'alert alert-success alert-dismissible fade show mt-2';
        successAlert.innerHTML = `
            <i class="fas fa-check-circle"></i> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        const header = this.container.querySelector('.model-selection-header');
        if (header) {
            header.parentNode.insertBefore(successAlert, header.nextSibling);

            // Auto-remove after 3 seconds
            setTimeout(() => {
                if (successAlert.parentNode) {
                    successAlert.remove();
                }
            }, 3000);
        }
    }
}