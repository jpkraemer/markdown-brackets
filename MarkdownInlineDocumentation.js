define(function (require, exports, module) {
    'use strict';


	// Load dependent modules
    var DocumentManager     = brackets.libRequire("document/DocumentManager"),
        TextRange           = brackets.libRequire("document/TextRange").TextRange,
        EditorManager       = brackets.libRequire("editor/EditorManager"),
        InlineTextEditor    = brackets.libRequire("editor/InlineTextEditor").InlineTextEditor,
        Commands            = brackets.libRequire("command/Commands"),
        CommandManager      = brackets.libRequire("command/CommandManager");

        /**
     * @constructor
     * @extends InlineWidget
     */
    function MarkdownInlineDocumentation(start, end) {
        InlineTextEditor.call(this);

        this._start = start;
        this._end = end;
    }
    MarkdownInlineDocumentation.prototype = new InlineTextEditor();
    MarkdownInlineDocumentation.prototype.constructor = MarkdownInlineDocumentation;
    MarkdownInlineDocumentation.prototype.parentClass = InlineTextEditor.prototype;

    MarkdownInlineDocumentation.prototype.$editorsDiv = null;

    MarkdownInlineDocumentation.prototype._start = -1;
    MarkdownInlineDocumentation.prototype._end = -1; 

    MarkdownInlineDocumentation.prototype.load = function (hostEditor) {
        this.parentClass.load.call(this, hostEditor);
        
        // Bind event handlers
        // this._updateRelatedContainer = this._updateRelatedContainer.bind(this);
        this._ensureCursorVisible = this._ensureCursorVisible.bind(this);
        this._onClick = this._onClick.bind(this);

        // Create DOM to hold editors and related list
        this.$editorsDiv = $(document.createElement('div')).addClass("inlineEditorHolder");
        
        // // select the first rule
        this.createInlineEditorFromText(this.hostEditor.document, this._start, this._end, this.$editorsDiv.get(0));
        this.editors[0].focus();

        $(this.editors[0]).on("cursorActivity", this._ensureCursorVisible);

        this.editors[0].refresh();
        // ensureVisibility is set to false because we don't want to scroll the main editor when the user selects a view
        this.parentClass.sizeInlineWidgetToContents.call(this, true);
        this.hostEditor.setInlineWidgetHeight(this, this.$editorsDiv.height(), false); 

        // attach to main container
        this.$htmlContent.append(this.$editorsDiv);
        
        // Listen for clicks directly on us, so we can set focus back to the editor
        this.$htmlContent.on("click", this._onClick);
    };

    /**
     * Called any time inline is closed, whether manually (via closeThisInline()) or automatically
     */
    MarkdownInlineDocumentation.prototype.onClosed = function () {
        this.parentClass.onClosed.call(this); // super.onClosed()
        
        // remove resize handlers for relatedContainer
        $(this.editors[0]).off("cursorActivity", this._ensureCursorVisible);
    };

    /**
     * Prevent clicks in the dead areas of the inlineWidget from changing the focus and insertion point in the editor.
     * This is done by detecting clicks in the inlineWidget that are not inside the editor or the rule list and
     * restoring focus and the insertion point.
     */
    MarkdownInlineDocumentation.prototype._onClick = function (event) {
        var childEditor = this.editors[0],
            editorRoot = childEditor.getRootElement(),
            editorPos = $(editorRoot).offset();
        if ($(editorRoot).find(event.target).length === 0) {
            childEditor.focus();
            // Only set the cursor if the click isn't in the rule list.
            if (this.$relatedContainer.find(event.target).length === 0) {
                if (event.pageY < editorPos.top) {
                    childEditor.setCursorPos(0, 0);
                } else if (event.pageY > editorPos.top + $(editorRoot).height()) {
                    var lastLine = childEditor.getLastVisibleLine();
                    childEditor.setCursorPos(lastLine, childEditor.getLineText(lastLine).length);
                }
            }
        }
    };

    MarkdownInlineDocumentation.prototype._ensureCursorVisible = function () {
        if ($.contains(this.editors[0].getRootElement(), document.activeElement)) {
            var cursorCoords = this.editors[0]._codeMirror.cursorCoords(),
                lineSpaceOffset = $(this.editors[0]._getLineSpaceElement()).offset();
            // If we're off the left-hand side, we just want to scroll it into view normally. But
            // if we're underneath the rule list on the right, we want to ask the host editor to 
            // scroll far enough that the current cursor position is visible to the left of the rule 
            // list. (Because we always add extra padding for the rule list, this is always possible.)
            
            // Vertically, we want to set the scroll position relative to the overall host editor, not
            // the lineSpace of the widget itself. Also, we can't use the lineSpace here, because its top
            // position just corresponds to whatever CodeMirror happens to have rendered at the top. So
            // we need to figure out our position relative to the top of the virtual scroll area, which is
            // the top of the actual scroller minus the scroll position.
            var scrollerTop = $(this.hostEditor.getScrollerElement()).offset().top - this.hostEditor.getScrollPos().y;
            this.hostEditor._codeMirror.scrollIntoView(cursorCoords.x - lineSpaceOffset.left,
                                                       cursorCoords.y - scrollerTop,
                                                       cursorCoords.x - lineSpaceOffset.left,
                                                       cursorCoords.yBot - scrollerTop);
        }
    };

    /**
     * Sizes the inline widget height to be the maximum between the rule list height and the editor height
     * @override 
     * @param {boolean} force the editor to resize
     * @param {boolean} ensureVisibility makes the parent editor scroll to display the inline editor. Default true.
     */
    MarkdownInlineDocumentation.prototype.sizeInlineWidgetToContents = function (force, ensureVisibility) {
        // Size the code mirror editors height to the editor content
        this.parentClass.sizeInlineWidgetToContents.call(this, force);
        // Size the widget height to the max between the editor content and the related rules list
        var widgetHeight = this.$editorsDiv.height();
        this.hostEditor.setInlineWidgetHeight(this, widgetHeight, ensureVisibility);

        // The related rules container size itself based on htmlContent which is set by setInlineWidgetHeight above.
        // this._updateRelatedContainer();
    };

	module.exports = MarkdownInlineDocumentation;

}); 