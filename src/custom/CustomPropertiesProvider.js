import { is } from 'bpmn-js/lib/util/ModelUtil';

const LOW_PRIORITY = 500;

/**
 * Custom Properties Provider
 * Adds custom properties to the properties panel
 */
export default class CustomPropertiesProvider {
  constructor(propertiesPanel, translate, modeling) {
    this.propertiesPanel = propertiesPanel;
    this.translate = translate;
    this.modeling = modeling;

    propertiesPanel.registerProvider(LOW_PRIORITY, this);
  }

  getGroups(element) {
    return (groups) => {
      // Add custom properties group for tasks
      if (is(element, 'bpmn:Task') || is(element, 'bpmn:ServiceTask') || is(element, 'bpmn:UserTask')) {
        groups.push(this._createCustomPropertiesGroup(element));
      }

      return groups;
    };
  }

  _createCustomPropertiesGroup(element) {
    const { translate, modeling } = this;

    return {
      id: 'custom-properties',
      label: translate('Custom Properties'),
      entries: [
        {
          id: 'custom-taskType',
          element: element,
          component: CustomTextInput,
          label: translate('Task Type'),
          modelProperty: 'custom:taskType',
          description: translate('Type: api, manual, review, approval, etc.'),
          modeling
        },
        {
          id: 'custom-priority',
          element: element,
          component: CustomSelect,
          label: translate('Priority'),
          modelProperty: 'custom:priority',
          options: [
            { value: '', label: 'None' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' }
          ],
          modeling
        },
        {
          id: 'custom-riskLevel',
          element: element,
          component: CustomSelect,
          label: translate('Risk Level'),
          modelProperty: 'custom:riskLevel',
          options: [
            { value: '', label: 'None' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' }
          ],
          modeling
        },
        {
          id: 'custom-estimatedHours',
          element: element,
          component: CustomTextInput,
          label: translate('Estimated Hours'),
          modelProperty: 'custom:estimatedHours',
          modeling
        },
        {
          id: 'custom-assignee',
          element: element,
          component: CustomTextInput,
          label: translate('Assignee'),
          modelProperty: 'custom:assignee',
          modeling
        },
        {
          id: 'custom-department',
          element: element,
          component: CustomTextInput,
          label: translate('Department'),
          modelProperty: 'custom:department',
          modeling
        },
        {
          id: 'custom-status',
          element: element,
          component: CustomSelect,
          label: translate('Status'),
          modelProperty: 'custom:status',
          options: [
            { value: '', label: 'None' },
            { value: 'pending', label: 'Pending' },
            { value: 'in-progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'blocked', label: 'Blocked' }
          ],
          modeling
        }
      ]
    };
  }
}

CustomPropertiesProvider.$inject = ['propertiesPanel', 'translate', 'modeling'];

/**
 * Custom Text Input Component
 */
function CustomTextInput(props) {
  const { element, id, label, modelProperty, description, modeling } = props;

  const getValue = () => {
    return element.businessObject.get(modelProperty) || '';
  };

  const setValue = (value) => {
    modeling.updateProperties(element, {
      [modelProperty]: value
    });
  };

  return {
    id,
    element,
    label,
    description,
    modelProperty,
    get: getValue,
    set: setValue
  };
}

/**
 * Custom Select Component
 */
function CustomSelect(props) {
  const { element, id, label, modelProperty, options, modeling } = props;

  const getValue = () => {
    return element.businessObject.get(modelProperty) || '';
  };

  const setValue = (value) => {
    modeling.updateProperties(element, {
      [modelProperty]: value
    });
  };

  return {
    id,
    element,
    label,
    modelProperty,
    get: getValue,
    set: setValue,
    options
  };
}