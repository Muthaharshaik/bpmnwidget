import CustomRenderer from './CustomRenderer';
import CustomPalette from './CustomPalette';
import CustomContextPad from './CustomContextPad';
import CustomRules from './CustomRules';
import CustomPropertiesProvider from './CustomPropertiesProvider';

/**
 * Custom Modules Bundle
 * Exports all custom modules for easy integration
 */
export default {
  __init__: [
    'customRenderer',
    'customPalette',
    'customContextPad',
    'customRules',
    'customPropertiesProvider'
  ],
  customRenderer: ['type', CustomRenderer],
  customPalette: ['type', CustomPalette],
  customContextPad: ['type', CustomContextPad],
  customRules: ['type', CustomRules],
  customPropertiesProvider: ['type', CustomPropertiesProvider]
};