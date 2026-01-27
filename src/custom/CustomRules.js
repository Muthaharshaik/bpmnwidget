import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';
import { is } from 'bpmn-js/lib/util/ModelUtil';

/**
 * Custom Rules Provider
 * Defines custom modeling rules and restrictions
 */
export default class CustomRules extends RuleProvider {
  constructor(eventBus) {
    super(eventBus);
  }

  init() {
    // Add custom rules here
    
    // Example: Prevent high-priority tasks from being deleted
    this.addRule('elements.delete', 1500, function(context) {
      const elements = context.elements;

      // Check if any element is a high-priority task
      const hasHighPriorityTask = elements.some(element => {
        const bo = element.businessObject;
        return (is(element, 'bpmn:Task') || is(element, 'bpmn:ServiceTask')) &&
               bo.get('custom:priority') === 'high';
      });

      if (hasHighPriorityTask) {
        // You can uncomment this to prevent deletion
        // return false;
      }

      // Allow deletion
      return true;
    });

    // Example: Custom connection rules
    this.addRule('connection.create', 1500, function(context) {
      const source = context.source;
      const target = context.target;

      // Allow standard connections
      return true;
    });

    // Example: Validate task placement
    this.addRule('shape.create', 1500, function(context) {
      const shape = context.shape;
      const target = context.target;
      const position = context.position;

      // Add custom validation logic here
      return true;
    });
  }
}

CustomRules.$inject = ['eventBus'];