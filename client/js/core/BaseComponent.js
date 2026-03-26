/**
 * Base Component Class for NetworkDismantling System
 * Provides common functionality and event handling for all UI components
 */
class BaseComponent {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = { ...this.getDefaultOptions(), ...options };
        this.eventBus = ComponentManager.getEventBus();
        this.isInitialized = false;
        this.state = {};
        
        if (!this.container) {
            throw new Error(`Container element with ID '${containerId}' not found`);
        }
        
        this.init();
    }
    
    /**
     * Initialize the component
     * Override in child classes for specific initialization
     */
    init() {
        this.setupEventListeners();
        this.render();
        this.isInitialized = true;
        this.emit('component:initialized', { componentId: this.containerId });
    }
    
    /**
     * Get default options for the component
     * Override in child classes
     */
    getDefaultOptions() {
        return {};
    }
    
    /**
     * Setup event listeners
     * Override in child classes for specific event handling
     */
    setupEventListeners() {
        // Base event listeners can be added here
    }
    
    /**
     * Render the component
     * Override in child classes for specific rendering
     */
    render() {
        // Base rendering logic
    }
    
    /**
     * Update component state
     */
    setState(newState) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...newState };
        this.onStateChange(oldState, this.state);
    }
    
    /**
     * Get current component state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Handle state changes
     * Override in child classes
     */
    onStateChange(oldState, newState) {
        // Default implementation - re-render on state change
        if (this.isInitialized) {
            this.render();
        }
    }
    
    /**
     * Emit an event through the event bus
     */
    emit(eventName, data = {}) {
        this.eventBus.emit(eventName, {
            source: this.containerId,
            timestamp: Date.now(),
            ...data
        });
    }
    
    /**
     * Listen to an event through the event bus
     */
    on(eventName, callback) {
        this.eventBus.on(eventName, callback);
    }
    
    /**
     * Remove event listener
     */
    off(eventName, callback) {
        this.eventBus.off(eventName, callback);
    }
    
    /**
     * Show loading state
     */
    showLoading(message = 'Loading...') {
        this.setState({ loading: true, loadingMessage: message });
    }
    
    /**
     * Hide loading state
     */
    hideLoading() {
        this.setState({ loading: false, loadingMessage: null });
    }
    
    /**
     * Show error state
     */
    showError(error) {
        this.setState({ error: error, loading: false });
        this.emit('component:error', { error, componentId: this.containerId });
    }
    
    /**
     * Clear error state
     */
    clearError() {
        this.setState({ error: null });
    }
    
    /**
     * Enable the component
     */
    enable() {
        this.setState({ disabled: false });
        this.container.classList.remove('disabled');
    }
    
    /**
     * Disable the component
     */
    disable() {
        this.setState({ disabled: true });
        this.container.classList.add('disabled');
    }
    
    /**
     * Destroy the component and clean up
     */
    destroy() {
        this.emit('component:destroying', { componentId: this.containerId });
        this.container.innerHTML = '';
        this.isInitialized = false;
        this.emit('component:destroyed', { componentId: this.containerId });
    }
    
    /**
     * Validate component data
     * Override in child classes
     */
    validate(data) {
        return { isValid: true, errors: [] };
    }
    
    /**
     * Get component info
     */
    getInfo() {
        return {
            containerId: this.containerId,
            isInitialized: this.isInitialized,
            state: this.getState(),
            options: this.options
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseComponent;
}