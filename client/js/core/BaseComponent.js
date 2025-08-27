/**
 * Base Component Class for FINDER_ND System
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
        this.eventBus.removeAllListeners(this.containerId);
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

/**
 * Event Bus for inter-component communication
 */
class EventBus {
    constructor() {
        this.events = {};
    }
    
    /**
     * Emit an event
     */
    emit(eventName, data) {
        if (!this.events[eventName]) {
            return;
        }
        
        this.events[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for '${eventName}':`, error);
            }
        });
    }
    
    /**
     * Listen to an event
     */
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        
        this.events[eventName].push(callback);
    }
    
    /**
     * Remove event listener
     */
    off(eventName, callback) {
        if (!this.events[eventName]) {
            return;
        }
        
        const index = this.events[eventName].indexOf(callback);
        if (index > -1) {
            this.events[eventName].splice(index, 1);
        }
    }
    
    /**
     * Remove all listeners for a specific component
     */
    removeAllListeners(componentId) {
        Object.keys(this.events).forEach(eventName => {
            this.events[eventName] = this.events[eventName].filter(callback => {
                return callback.componentId !== componentId;
            });
        });
    }
    
    /**
     * Get all registered events
     */
    getEvents() {
        return Object.keys(this.events);
    }
}

/**
 * Component Manager for managing component lifecycle and communication
 */
class ComponentManager {
    static instance = null;
    static eventBus = null;
    
    constructor() {
        if (ComponentManager.instance) {
            return ComponentManager.instance;
        }
        
        this.components = new Map();
        this.eventBus = new EventBus();
        ComponentManager.instance = this;
        ComponentManager.eventBus = this.eventBus;
        
        this.setupGlobalEventListeners();
    }
    
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!ComponentManager.instance) {
            new ComponentManager();
        }
        return ComponentManager.instance;
    }
    
    /**
     * Get the event bus
     */
    static getEventBus() {
        if (!ComponentManager.eventBus) {
            ComponentManager.getInstance();
        }
        return ComponentManager.eventBus;
    }
    
    /**
     * Register a component
     */
    registerComponent(componentId, component) {
        this.components.set(componentId, component);
        this.eventBus.emit('component:registered', { componentId, component });
    }
    
    /**
     * Unregister a component
     */
    unregisterComponent(componentId) {
        const component = this.components.get(componentId);
        if (component) {
            component.destroy();
            this.components.delete(componentId);
            this.eventBus.emit('component:unregistered', { componentId });
        }
    }
    
    /**
     * Get a component by ID
     */
    getComponent(componentId) {
        return this.components.get(componentId);
    }
    
    /**
     * Get all components
     */
    getAllComponents() {
        return Array.from(this.components.values());
    }
    
    /**
     * Get component by type
     */
    getComponentsByType(type) {
        return Array.from(this.components.values()).filter(component => 
            component.constructor.name === type
        );
    }
    
    /**
     * Initialize all components
     */
    initializeAll() {
        this.components.forEach(component => {
            if (!component.isInitialized) {
                component.init();
            }
        });
    }
    
    /**
     * Destroy all components
     */
    destroyAll() {
        this.components.forEach((component, componentId) => {
            this.unregisterComponent(componentId);
        });
    }
    
    /**
     * Setup global event listeners
     */
    setupGlobalEventListeners() {
        // Listen for component registration
        this.eventBus.on('component:initialized', (data) => {
            this.registerComponent(data.componentId, data.component);
        });
        
        // Listen for component errors
        this.eventBus.on('component:error', (data) => {
            console.error(`Component error in ${data.componentId}:`, data.error);
        });
        
        // Handle page unload
        window.addEventListener('beforeunload', () => {
            this.destroyAll();
        });
    }
    
    /**
     * Get system status
     */
    getStatus() {
        const components = Array.from(this.components.entries()).map(([id, component]) => ({
            id,
            type: component.constructor.name,
            initialized: component.isInitialized,
            state: component.getState()
        }));
        
        return {
            totalComponents: this.components.size,
            components,
            events: this.eventBus.getEvents()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BaseComponent, EventBus, ComponentManager };
}