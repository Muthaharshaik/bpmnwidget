import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider';

/**
 * Read-Only Module
 *
 * Turns the bpmn-js Modeler into a viewer while keeping everything that is
 * purely visual alive: selection, hover, pan, zoom, token simulation,
 * validation markers and (non-editable) comments.
 *
 * bpmn-js has three separate editing entry points, so this needs three layers:
 *
 *   1. rules        – veto every modeling operation. This also removes the
 *                     resize handles and the rule-gated context pad entries,
 *                     because those are rendered from what the rules allow.
 *                     It covers keyboard editing too (Delete, Ctrl+C,
 *                     Ctrl/Shift+Arrow), since those actions ask the rules first.
 *   2. drag events  – cancel the interaction itself, so dragging a shape or a
 *                     bendpoint produces no preview at all. Returning false
 *                     from `<prefix>.start` makes diagram-js cancel the drag.
 *                     Hand tool / lasso are deliberately left alone — they only
 *                     pan and select.
 *   3. service stubs– direct editing (double-click or "E" to rename) and the
 *                     popup menu ("R" to replace an element) are not rule-gated,
 *                     so they are neutralised on the instance.
 *
 * Note: a `commandStack.execute` listener cannot be used for this — diagram-js
 * only lets listeners veto in `canExecute`, and `execute()` never calls it.
 */

// Above CustomRules (1500) so read-only always wins.
const READ_ONLY_PRIORITY = 5000;

const BLOCKED_RULES = [
    'connection.create',
    'connection.reconnect',
    'connection.updateWaypoints',
    'element.copy',
    'elements.create',
    'elements.delete',
    'elements.move',
    'shape.append',
    'shape.attach',
    'shape.create',
    'shape.resize'
];

const BLOCKED_INTERACTIONS = [
    'bendpoint.move.start',
    'connect.start',
    'connectionSegment.move.start',
    'create.start',
    'global-connect.start',
    'resize.start',
    'shape.move.start',
    'spaceTool.start',
    'spaceTool.selection.start'
];

class ReadOnlyRules extends RuleProvider {
    constructor(eventBus) {
        super(eventBus);
    }

    init() {
        BLOCKED_RULES.forEach(rule => {
            this.addRule(rule, READ_ONLY_PRIORITY, () => false);
        });
    }
}

ReadOnlyRules.$inject = ['eventBus'];

function ReadOnlyInteraction(eventBus) {
    eventBus.on(BLOCKED_INTERACTIONS, READ_ONLY_PRIORITY, () => false);
}

ReadOnlyInteraction.$inject = ['eventBus'];

function ReadOnlyEditingServices(directEditing, popupMenu) {
    // Blocks renaming from every trigger: double-click, "E", create.end, autoPlace.end.
    directEditing.activate = () => false;

    // Blocks the replace / append / color popups (reachable via "R").
    popupMenu.open = () => {};
}

ReadOnlyEditingServices.$inject = ['directEditing', 'popupMenu'];

export default {
    __init__: ['readOnlyRules', 'readOnlyInteraction', 'readOnlyEditingServices'],
    readOnlyRules: ['type', ReadOnlyRules],
    readOnlyInteraction: ['type', ReadOnlyInteraction],
    readOnlyEditingServices: ['type', ReadOnlyEditingServices]
};
