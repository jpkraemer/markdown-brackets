define(function (require, exports, module) {
    'use strict';


	// Load dependent modules
    var DocumentManager     = brackets.libRequire("document/DocumentManager"),
        TextRange           = brackets.libRequire("document/TextRange").TextRange,
        EditorManager       = brackets.libRequire("editor/EditorManager"),
        InlineWidget        = brackets.libRequire("editor/InlineWidget").InlineWidget,
        Commands            = brackets.libRequire("command/Commands"),
        CommandManager      = brackets.libRequire("command/CommandManager");

    // Third party libs
    var Showdown            = require('showdown');

    // Other extension classes 
    var MarkdownInlineDocumentation = require('MarkdownInlineDocumentation');

    // Global markdown converter object
    var ShowdownConverter = new Showdown.converter();

        /**
     * @constructor
     * @extends InlineWidget
     */
    function InlineMarkdownViewer() {
        InlineWidget.call(this);
    }
    InlineMarkdownViewer.prototype                              = new InlineWidget();
    InlineMarkdownViewer.prototype.constructor                  = InlineMarkdownViewer;
    InlineMarkdownViewer.prototype.parentClass                  = InlineWidget.prototype;   

    InlineMarkdownViewer.prototype.$contentDiv                  = null;
    InlineMarkdownViewer.prototype.$heightDummyDiv              = null;

    InlineMarkdownViewer.prototype._visibleRange                = null;
    InlineMarkdownViewer.prototype._hideRangeStart              = -1; 
    InlineMarkdownViewer.prototype._hideRangeEnd                = -1;

    InlineMarkdownViewer.prototype.markdownInlineDocumentation  = null;

    InlineMarkdownViewer.prototype._renderMarkdown = function () {
        var sourceString = ''; 
        for (var i = this._visibleRange.startLine; i<= this._visibleRange.endLine; i++) {
            sourceString += this.hostEditor.getLineText(i) + "\n"; 
        }
        sourceString = sourceString.replace(/^\s*\/\*\*/, '');
        sourceString = sourceString.replace(/\*\/.*/, '');

        var html = ShowdownConverter.makeHtml(sourceString);
        this.$contentDiv.empty();
        this.$contentDiv.append(html);

        // refresh height dummy 
        this.$heightDummyDiv.empty(); 
        this.$heightDummyDiv.append($(this.$contentDiv[0]).clone());

        //renew height calculation 
        setTimeout(this.sizeInlineWidgetToContents.bind(this, true, true), 0);
    };

    InlineMarkdownViewer.prototype.load = function (hostEditor, startLine, endLine) {
        this.parentClass.load.call(this, hostEditor);

        //observe the range changes 
        this._visibleRange = new TextRange (hostEditor.document, startLine, endLine);

        // hide the comment lines in the editor
        this._hideVisibleRangeInEditor(); 

        // Create DOM to hold editors and related list
        this.$contentDiv = $(document.createElement('div')).addClass("inlineMarkdownCommentHolder");
        
        //remove inherited shadow from main container
        this.$htmlContent.empty();

        // attach to main container
        this.$htmlContent.append(this.$contentDiv);

        // We create the same content in a div just serving as a dummy for height calculation. 
        // The reason for this hack is, that codeMirror will dynamically insert and remove inline widgets into or from the DOM tree.
        // For widgets not currently inserted in the DOM tree, the height cannot be calculated. 
        // For our hidden but inserted height dummy div, the height can always be calculated.
        // However, this is a hack as it messes up the DOM. Code Mirror should be patched to ask for the widget 
        // height after inserting it in the DOM.
        this.$heightDummyDiv = (this.$htmlContent).clone(); 
        this.$heightDummyDiv.css('display', 'none'); 
        var parentForHeightDummy = this.hostEditor._codeMirror.getWrapperElement().getElementsByClassName('CodeMirror-lines')[0].parentElement; 
        $(parentForHeightDummy).append(this.$heightDummyDiv); 

        // render
        this._renderMarkdown();

        // ensureVisibility is set to false because we don't want to scroll the main editor when the user selects a view
        // this.sizeInlineWidgetToContents(true, true);
        // setTimeout(this.sizeInlineWidgetToContents.bind(this, true, false), 0);

        // register click handler to open an editor for the markdown source
        this.$htmlContent.on("click", this._onClick.bind(this));

        // register a document change observer to refresh the markdown
        var currentDocument = this.hostEditor.document; 
        $(currentDocument).on('change', this._onDocumentChange.bind(this)); 
        this.hostEditor.document.addRef(); // required for memory management in the Document class
    };

    /**
     * Called any time inline is closed, whether manually (via closeThisInline()) or automatically
     */
    InlineMarkdownViewer.prototype.onClosed = function () {
        this.parentClass.onClosed.call(this); // super.onClosed()

        this._visibleRange.dispose();

        // unregister observers
        this.$htmlContent.off("click", this._onClick.bind(this)); 
        this.hostEditor.document.off("change", this._onDocumentChange.bind(this)); 
        this.hostEditor.document.releaseRef(); // required for memory management in the Document class

        // close an attached editor if present
        if (this.markdownInlineDocumentation) {
            this.hostEditor.removeInlineWidget(this.markdownInlineDocumentation);
            this.markdownInlineDocumentation = null;
        }
    };

    /**
     * Sizes the inline widget height to be the maximum between the rule list height and the editor height
     * @override 
     * @param {boolean} force the editor to resize
     * @param {boolean} ensureVisibility makes the parent editor scroll to display the inline editor. Default true.
     */
    InlineMarkdownViewer.prototype.sizeInlineWidgetToContents = function (force, ensureVisibility) {
        // Size the code mirror editors height to the editor content
        // this.parentClass.sizeInlineWidgetToContents.call(this, force);
        // Size the widget height to the max between the editor content and the related rules list
        var widgetHeight = $(this.$heightDummyDiv[0]).outerHeight();
        this.hostEditor.setInlineWidgetHeight(this, widgetHeight, ensureVisibility);

        // The related rules container size itself based on htmlContent which is set by setInlineWidgetHeight above.
        // this._updateRelatedContainer();
    };

    InlineMarkdownViewer.prototype._hideVisibleRangeInEditor = function () {
        // if the range got smaller this will show the lines which no longer need to be hidden
        if (this._hideRangeStart != -1) {
            for (var i = this._hideRangeStart; i < this._visibleRange.startLine; i++) {
                //TODO: change this to an editor API once one exists
                this.hostEditor._codeMirror.showLine(i); 
            }
        }

        for (var i = this._visibleRange.startLine; i <= this._visibleRange.endLine; i++){
            this.hostEditor._hideLine(i); 
        };

        // if the range got smaller this will show the lines which no longer need to be hidden
        if (this._hideRangeEnd != -1) {
            for (var i = this._visibleRange.endLine; i < this._hideRangeEnd; i++) {
                //TODO: change this to an editor API once one exists
                this.hostEditor._codeMirror.showLine(i); 
            }   
        }

        this._hideRangeStart    = this._visibleRange.startLine; 
        this._hideRangeEnd      = this._visibleRange.endLine;
    }

    /** 
     * On click open an inline editor to edit the Markdown source code. 
     */
     InlineMarkdownViewer.prototype._onClick = function (event) {
        if (this.markdownInlineDocumentation) {
            this.hostEditor.removeInlineWidget(this.markdownInlineDocumentation); 
            this.markdownInlineDocumentation = null;
        }
        else {
            //we need a visible line to attach the editor to
            this.hostEditor._codeMirror.showLine(this._visibleRange.endLine);

            this.markdownInlineDocumentation = new MarkdownInlineDocumentation(this._visibleRange.startLine, this._visibleRange.endLine); 
            this.markdownInlineDocumentation.load(this.hostEditor);
            this.hostEditor.addInlineWidget({line: this._visibleRange.endLine, ch:0}, this.markdownInlineDocumentation); 
        }
     }

     /** 
      * On document change we need to update the markdown view eventually
      */ 
    InlineMarkdownViewer.prototype._onDocumentChange = function (event, document, changeList) {

        // if the _visibleRange changed we need to change which lines are hidden
        this._hideVisibleRangeInEditor();

        // check all changes if they concern the comment we display
        var currentChange = changeList; 
        do {
            if ((this._visibleRange.startLine >= changeList.from.line && changeList.to.line >= this._visibleRange.startLine) 
                || (changeList.from.line >= this._visibleRange.startLine && changeList.from.line <= this._visibleRange.endLine)) {
                
                // we need to update the rendered markdown 
                this._renderMarkdown(); 

                // since we updated now anyway, we do no longer care about the other changes
                return; 
            }

            currentChange = currentChange.next; 
        } while (currentChange != null); 
    }

	module.exports = InlineMarkdownViewer;

}); 