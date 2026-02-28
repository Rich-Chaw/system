/**
 * Event Bus for inter-component communication
 */
class EventBus {
    constructor() {
        this.events = {};
        this.debug = Config.DEBUG;
    }
    
    /**
     * Emit an event
     */
    emit(eventName, data) {
        if (this.debug) {
            console.log(`[EventBus] Emitting: ${eventName}`, data);
        }
        
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
        
        if (this.debug) {
            console.log(`[EventBus] Listener added for: ${eventName}`);
        }
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
            
            if (this.debug) {
                console.log(`[EventBus] Listener removed for: ${eventName}`);
            }
        }
    }
    
    /**
     * Remove all listeners for a specific event
     */
    removeAllListeners(eventName) {
        if (eventName) {
            delete this.events[eventName];
        } else {
            this.events = {};
        }
    }
    
    /**
     * Get all registered events
     */
    getEvents() {
        return Object.keys(this.events);
    }
    
    /**
     * Get listener count for an event
     */
    getListenerCount(eventName) {
        return this.events[eventName] ? this.events[eventName].length : 0;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
}
