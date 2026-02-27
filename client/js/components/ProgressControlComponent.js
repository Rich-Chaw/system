/**
 * Progress Control Component
 * Controls step-by-step playback of dismantling visualization
 */
class ProgressControlComponent extends BaseComponent {
    getDefaultOptions() {
        return {
            autoPlaySpeed: 500, // milliseconds per step
            showStepInfo: true
        };
    }
    
    init() {
        this.state = {
            currentStep: 0,
            maxSteps: 0,
            isPlaying: false,
            isEnabled: false
        };
        
        this.playInterval = null;
        
        console.log('ProgressControlComponent initializing...');
        
        super.init();
        
        console.log('ProgressControlComponent initialized, container:', this.container);
        
        // Listen for progress enabled event
        this.on('progress:enabled', (data) => {
            console.log('ProgressControlComponent received progress:enabled event:', data);
            this.enable(data.maxSteps);
        });
        
        // Listen for views cleared
        this.on('views:cleared', () => {
            this.disable();
        });
    }
    
    render() {
        console.log('ProgressControlComponent rendering, state:', this.state);
        this.container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h5><i class="fas fa-play-circle"></i> Dismantling Progress Control</h5>
                </div>
                <div class="card-body">
                    <div class="progress-controls ${this.state.isEnabled ? '' : 'disabled'}">
                        <div class="control-buttons mb-3">
                            <button class="btn btn-sm btn-primary" id="playPauseBtn" ${!this.state.isEnabled ? 'disabled' : ''}>
                                <i class="fas fa-play"></i> <span>Play</span>
                            </button>
                            <button class="btn btn-sm btn-secondary" id="resetBtn" ${!this.state.isEnabled ? 'disabled' : ''}>
                                <i class="fas fa-undo"></i> Reset
                            </button>
                            <button class="btn btn-sm btn-secondary" id="stepBackBtn" ${!this.state.isEnabled ? 'disabled' : ''}>
                                <i class="fas fa-step-backward"></i>
                            </button>
                            <button class="btn btn-sm btn-secondary" id="stepForwardBtn" ${!this.state.isEnabled ? 'disabled' : ''}>
                                <i class="fas fa-step-forward"></i>
                            </button>
                            <button class="btn btn-sm btn-secondary" id="endBtn" ${!this.state.isEnabled ? 'disabled' : ''}>
                                <i class="fas fa-fast-forward"></i> End
                            </button>
                        </div>
                        
                        <div class="progress-slider mb-2">
                            <input type="range" 
                                   class="form-range" 
                                   id="stepSlider" 
                                   min="0" 
                                   max="${this.state.maxSteps}" 
                                   value="${this.state.currentStep}"
                                   ${!this.state.isEnabled ? 'disabled' : ''}>
                        </div>
                        
                        <div class="progress-info text-center">
                            <small class="text-muted">
                                ${this.state.isEnabled 
                                    ? `Step <strong id="currentStepDisplay">${this.state.currentStep}</strong> of <strong>${this.state.maxSteps}</strong>`
                                    : 'Run dismantling to enable progress control'
                                }
                            </small>
                        </div>
                        
                        <div class="playback-speed mt-3">
                            <label for="speedSlider" class="form-label">
                                <small>Playback Speed: <strong id="speedDisplay">${this.options.autoPlaySpeed}ms</strong></small>
                            </label>
                            <input type="range" 
                                   class="form-range" 
                                   id="speedSlider" 
                                   min="100" 
                                   max="2000" 
                                   step="100"
                                   value="${this.options.autoPlaySpeed}"
                                   ${!this.state.isEnabled ? 'disabled' : ''}>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        super.setupEventListeners();
        
        const playPauseBtn = this.container.querySelector('#playPauseBtn');
        const resetBtn = this.container.querySelector('#resetBtn');
        const stepBackBtn = this.container.querySelector('#stepBackBtn');
        const stepForwardBtn = this.container.querySelector('#stepForwardBtn');
        const endBtn = this.container.querySelector('#endBtn');
        const stepSlider = this.container.querySelector('#stepSlider');
        const speedSlider = this.container.querySelector('#speedSlider');
        
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (this.state.isPlaying) {
                    this.pause();
                } else {
                    this.play();
                }
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.reset();
            });
        }
        
        if (stepBackBtn) {
            stepBackBtn.addEventListener('click', () => {
                this.stepBack();
            });
        }
        
        if (stepForwardBtn) {
            stepForwardBtn.addEventListener('click', () => {
                this.stepForward();
            });
        }
        
        if (endBtn) {
            endBtn.addEventListener('click', () => {
                this.goToEnd();
            });
        }
        
        if (stepSlider) {
            stepSlider.addEventListener('input', (e) => {
                const step = parseInt(e.target.value);
                this.goToStep(step);
            });
        }
        
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.options.autoPlaySpeed = parseInt(e.target.value);
                this.updateSpeedDisplay();
                
                // If playing, restart with new speed
                if (this.state.isPlaying) {
                    this.pause();
                    this.play();
                }
            });
        }
    }
    
    enable(maxSteps) {
        console.log(`ProgressControlComponent enabling with ${maxSteps} steps`);
        this.state.isEnabled = true;
        this.state.maxSteps = maxSteps;
        this.state.currentStep = 0;
        this.render();
        
        console.log(`Progress control enabled with ${maxSteps} steps`);
    }
    
    disable() {
        this.state.isEnabled = false;
        this.state.maxSteps = 0;
        this.state.currentStep = 0;
        this.pause();
        this.render();
    }
    
    play() {
        if (!this.state.isEnabled || this.state.isPlaying) return;
        
        this.state.isPlaying = true;
        this.updatePlayPauseButton();
        
        this.playInterval = setInterval(() => {
            if (this.state.currentStep >= this.state.maxSteps) {
                this.pause();
            } else {
                this.stepForward();
            }
        }, this.options.autoPlaySpeed);
        
        this.emit('playback:started');
    }
    
    pause() {
        if (!this.state.isPlaying) return;
        
        this.state.isPlaying = false;
        this.updatePlayPauseButton();
        
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        
        this.emit('playback:paused');
    }
    
    reset() {
        this.pause();
        this.goToStep(0);
    }
    
    stepForward() {
        if (!this.state.isEnabled) return;
        
        const nextStep = Math.min(this.state.currentStep + 1, this.state.maxSteps);
        this.goToStep(nextStep);
    }
    
    stepBack() {
        if (!this.state.isEnabled) return;
        
        const prevStep = Math.max(this.state.currentStep - 1, 0);
        this.goToStep(prevStep);
    }
    
    goToEnd() {
        this.goToStep(this.state.maxSteps);
    }
    
    goToStep(step) {
        if (!this.state.isEnabled) return;
        
        this.state.currentStep = step;
        this.updateStepDisplay();
        this.updateSlider();
        
        // Emit event for visualization components
        this.emit('progress:step-changed', { step: this.state.currentStep });
    }
    
    updatePlayPauseButton() {
        const btn = this.container.querySelector('#playPauseBtn');
        if (!btn) return;
        
        const icon = btn.querySelector('i');
        const text = btn.querySelector('span');
        
        if (this.state.isPlaying) {
            icon.className = 'fas fa-pause';
            text.textContent = 'Pause';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-warning');
        } else {
            icon.className = 'fas fa-play';
            text.textContent = 'Play';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-primary');
        }
    }
    
    updateStepDisplay() {
        const display = this.container.querySelector('#currentStepDisplay');
        if (display) {
            display.textContent = this.state.currentStep;
        }
    }
    
    updateSlider() {
        const slider = this.container.querySelector('#stepSlider');
        if (slider) {
            slider.value = this.state.currentStep;
        }
    }
    
    updateSpeedDisplay() {
        const display = this.container.querySelector('#speedDisplay');
        if (display) {
            display.textContent = `${this.options.autoPlaySpeed}ms`;
        }
    }
    
    getState() {
        return { ...this.state };
    }
    
    destroy() {
        this.pause();
        super.destroy();
    }
}
