import BaseRenderer from 'diagram-js/lib/draw/BaseRenderer';
import {
  append as svgAppend,
  attr as svgAttr,
  create as svgCreate,
  classes as svgClasses
} from 'tiny-svg';
import { getRoundRectPath } from 'bpmn-js/lib/draw/BpmnRenderUtil';
import { is } from 'bpmn-js/lib/util/ModelUtil';

const HIGH_PRIORITY = 1500;
const TASK_BORDER_RADIUS = 10;
const COLOR_GREEN = '#52B415';
const COLOR_YELLOW = '#ffc800';
const COLOR_RED = '#cc0000';
const COLOR_BLUE = '#0d4f8b';

/**
 * Custom Renderer
 * Renders BPMN elements with custom styling based on properties
 */
export default class CustomRenderer extends BaseRenderer {
  constructor(eventBus, bpmnRenderer) {
    super(eventBus, HIGH_PRIORITY);

    this.bpmnRenderer = bpmnRenderer;
  }

  canRender(element) {
    // Don't render labels
    return !element.labelTarget;
  }

  drawShape(parentNode, element) {
    const shape = this.bpmnRenderer.drawShape(parentNode, element);

    // Get custom properties
    const businessObject = element.businessObject;
    const priority = businessObject.get('custom:priority');
    const riskLevel = businessObject.get('custom:riskLevel');
    const taskType = businessObject.get('custom:taskType');
    const status = businessObject.get('custom:status');

    if (is(element, 'bpmn:Task') || is(element, 'bpmn:ServiceTask') || is(element, 'bpmn:UserTask')) {
      // Apply priority-based styling
      if (priority) {
        this._applyPriorityStyling(shape, priority);
      }

      // Apply risk-level styling
      if (riskLevel) {
        this._applyRiskStyling(shape, riskLevel);
      }

      // Add visual indicators
      if (taskType || priority || riskLevel || status) {
        this._addVisualIndicators(parentNode, element, {
          taskType,
          priority,
          riskLevel,
          status
        });
      }
    }

    return shape;
  }

  getShapePath(shape) {
    if (is(shape, 'bpmn:Task') || is(shape, 'bpmn:ServiceTask') || is(shape, 'bpmn:UserTask')) {
      return getRoundRectPath(shape, TASK_BORDER_RADIUS);
    }

    return this.bpmnRenderer.getShapePath(shape);
  }

  /**
   * Apply priority-based styling
   */
  _applyPriorityStyling(shape, priority) {
    let color;
    let strokeWidth = 2;

    switch (priority.toLowerCase()) {
      case 'high':
        color = COLOR_RED;
        strokeWidth = 3;
        break;
      case 'medium':
        color = COLOR_YELLOW;
        break;
      case 'low':
        color = COLOR_GREEN;
        break;
      default:
        return;
    }

    svgAttr(shape, {
      stroke: color,
      strokeWidth: strokeWidth
    });
  }

  /**
   * Apply risk-level styling
   */
  _applyRiskStyling(shape, riskLevel) {
    let fillColor;

    switch (riskLevel.toLowerCase()) {
      case 'high':
        fillColor = 'rgba(204, 0, 0, 0.1)';
        break;
      case 'medium':
        fillColor = 'rgba(255, 200, 0, 0.1)';
        break;
      case 'low':
        fillColor = 'rgba(82, 180, 21, 0.1)';
        break;
      default:
        return;
    }

    svgAttr(shape, {
      fill: fillColor
    });
  }

  /**
   * Add visual indicators (icons, badges)
   */
  _addVisualIndicators(parentNode, element, data) {
    const { taskType, priority, riskLevel, status } = data;

    // Add priority badge
    if (priority) {
      this._addBadge(parentNode, element, priority, 'priority', {
        x: element.width - 25,
        y: 5
      });
    }

    // Add risk indicator
    if (riskLevel) {
      this._addBadge(parentNode, element, riskLevel, 'risk', {
        x: element.width - 25,
        y: priority ? 30 : 5
      });
    }

    // Add task type icon
    if (taskType) {
      this._addTaskTypeIcon(parentNode, element, taskType);
    }

    // Add status indicator
    if (status) {
      this._addStatusIndicator(parentNode, element, status);
    }
  }

  /**
   * Add a badge to the element
   */
  _addBadge(parentNode, element, text, type, position) {
    const badge = svgCreate('g');
    svgAttr(badge, { class: `custom-badge custom-badge-${type}` });

    // Badge background
    const rect = svgCreate('rect');
    svgAttr(rect, {
      x: position.x,
      y: position.y,
      width: 20,
      height: 18,
      rx: 3,
      ry: 3,
      fill: this._getBadgeColor(text),
      stroke: '#fff',
      strokeWidth: 1
    });

    // Badge text
    const badgeText = svgCreate('text');
    svgAttr(badgeText, {
      x: position.x + 10,
      y: position.y + 13,
      fill: '#fff',
      fontSize: '10px',
      fontWeight: 'bold',
      textAnchor: 'middle',
      fontFamily: 'Arial, sans-serif'
    });
    badgeText.textContent = text.charAt(0).toUpperCase();

    svgAppend(badge, rect);
    svgAppend(badge, badgeText);
    svgAppend(parentNode, badge);
  }

  /**
   * Get badge color based on value
   */
  _getBadgeColor(value) {
    const lowerValue = value.toLowerCase();
    if (lowerValue === 'high') return COLOR_RED;
    if (lowerValue === 'medium') return COLOR_YELLOW;
    if (lowerValue === 'low') return COLOR_GREEN;
    return COLOR_BLUE;
  }

  /**
   * Add task type icon
   */
  _addTaskTypeIcon(parentNode, element, taskType) {
    const icon = svgCreate('text');
    svgAttr(icon, {
      x: 10,
      y: 20,
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif'
    });

    // Map task types to emojis/symbols
    const iconMap = {
      'api': '🔧',
      'manual': '✋',
      'automated': '⚙️',
      'review': '👁️',
      'approval': '✓',
      'notification': '📧',
      'calculation': '🔢'
    };

    icon.textContent = iconMap[taskType.toLowerCase()] || '📋';
    svgAppend(parentNode, icon);
  }

  /**
   * Add status indicator (colored dot)
   */
  _addStatusIndicator(parentNode, element, status) {
    const circle = svgCreate('circle');
    
    let fillColor;
    switch (status.toLowerCase()) {
      case 'completed':
        fillColor = COLOR_GREEN;
        break;
      case 'in-progress':
        fillColor = COLOR_YELLOW;
        break;
      case 'pending':
        fillColor = COLOR_BLUE;
        break;
      case 'blocked':
        fillColor = COLOR_RED;
        break;
      default:
        fillColor = '#999';
    }

    svgAttr(circle, {
      cx: 10,
      cy: element.height - 10,
      r: 5,
      fill: fillColor,
      stroke: '#fff',
      strokeWidth: 1
    });

    svgAppend(parentNode, circle);
  }
}

CustomRenderer.$inject = ['eventBus', 'bpmnRenderer'];