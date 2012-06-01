/**
Brackets Markdown Extension
---------
 
This is awesome

- One
- Two
- More
 
Some Code:

    def function
      with(code)
    end
 
Blabla
 
_italics_ and __bold__ 
 */


/*jslint vars: true, plusplus: true, devel: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $ */

define(function (require, exports, module) {
    'use strict';

    var MarkdownInlineDocumentation = require("MarkdownInlineDocumentation"),
    	InlineMarkdownViewer 		= require("InlineMarkdownViewer");

    var DocumentManager = brackets.libRequire('document/DocumentManager'), 
    	EditorManager 	= brackets.libRequire('editor/EditorManager'); 

	/** 
	 * Method to test if a line is a comment
	 * @param {Number} line
	 * @return {boolean} True if the line is a comment
	 */
	function _isCommentLine(hostEditor, line) {
        var eol = hostEditor._codeMirror.getLine(line).length;
        var token = hostEditor._codeMirror.getTokenAt({line:line, ch: eol});
        return (token.className == "comment");
    }

	/**
     * This function is registered with EditManager as an inline editor provider. It creates a 
     * MarkdownInlineDocumentationEditor when cursor is on an comment written in markdown.
     * This is then shown in the editor
     *
     * @param {!Editor} editor
     * @param {!{line:Number, ch:Number}} pos
     * @return {$.Promise} a promise that will be resolved with an InlineWidget
     *      or null if we're not going to provide anything.
     */
    function markdownProvider(hostEditor, pos) {
	    // Only provide a markdown editor when cursor is in JS content
	    if (hostEditor._codeMirror.getOption("mode") !== "javascript") {
	        return null;
	    }

	    // Only provide markdown editor when cursor is in comment
	    if (! _isCommentLine(hostEditor, pos.line)) {
	        return null;
	    }
	    
	    //search for start of comment block 
	    var start = pos.line; 
	    do
	    {
	    	start--; 
	    }
	    while ((start > 0) && (_isCommentLine(hostEditor, start))); 

	    //search for end of comment block
	    var end = pos.line; 
	    do
	    {
	    	end++; 
	    }
	    while ((end < hostEditor.lineCount()) && (_isCommentLine(hostEditor, end)));

		var result = $.Deferred(); 
		var inlineEditor = new MarkdownInlineDocumentation(start+1, end-1); 
		inlineEditor.load(hostEditor);
		result.resolve (inlineEditor); 
		return result.promise();
    }

    /**
     * This function iterates through all comment blocks in the given document
     * and calls the callback for each comment block. 
     * @param hostEditor 
     * @param callback Gets 3 arguments: The editor, the start, and the end line of the block. 
     */
    function _eachCommentInEditor (hostEditor, callback) {

    	var start = -1;

    	for (var i = 0; i < hostEditor.lineCount(); i++) {
    		var text = hostEditor.getLineText(i);
			if (start < 0) {
				// not inside a comment -> look for /**
				if (/^\s*\/\*\*/.test(text)) {
					start = i;
				}
			}
			else {
				// inside a comment -> look for */
				if (/\*\//.test(text)) {
    				callback(hostEditor, start, i); 
    				start = -1;
    			}
    		}
    	}
    }


    function _onCurrentDocumentChange () {
    	var currentDocument = DocumentManager.getCurrentDocument(); 
    	if (!currentDocument) {
    		return;
    	}

        var currentHostEditor = EditorManager.getCurrentFullEditor(); 
        // currentHostEditor._codeMirror.operation(function (){
        	_eachCommentInEditor(currentHostEditor, function eachCommentCallback (hostEditor, start, end) {

        		var inlineMarkdownViewer = new InlineMarkdownViewer(); 
        		inlineMarkdownViewer.load(hostEditor, start, end);
        		hostEditor.addInlineWidget({line: (start > 0) ? start -1 : end + 1, ch:0}, inlineMarkdownViewer); 
        	});

        // });
    }

    function _loadStyles() {
        var request = new XMLHttpRequest();
        request.open("GET", "extensions/user/markdown/main.less", true);
        request.onload = function onLoad(event) {
            var parser = new less.Parser();
            parser.parse(request.responseText, function onParse(err, tree) {
                console.assert(!err, err);
                var style = $("<style>" + tree.toCSS() + "</style>");
                $(document.head).append(style);
        
                // now all resources for succesful rendering are loaded
                init();
            });
        };
        request.send(null);
    }

    /**
     * This function is run when the css is loaded
     */
    function init() {
        $(DocumentManager).on('currentDocumentChange', _onCurrentDocumentChange); 
        _onCurrentDocumentChange();
    }

    console.log("loading MarkdownInlineDocumentation!");

    // load our stylesheet
    _loadStyles();

    // init
    // $(init);
});

