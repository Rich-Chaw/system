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
    module.exports = ComponentManager;
}
