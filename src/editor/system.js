(function($) {

    // Imports ================================================================
    var doc = document,
        kendo = window.kendo,
        Class = kendo.Class,
        Widget = kendo.ui.Widget,
        extend = $.extend;

var Command = Class.extend({
    init: function(options) {
        this.restorePoint = new RestorePoint(options.range);
        this.marker = new Marker();
        this.formatter = options.formatter;

    },

    getRange: function () {
        return this.restorePoint.toRange();
    },

    lockRange: function (expand) {
        return this.marker.add(this.getRange(), expand);
    },

    releaseRange: function (range) {
        this.marker.remove(range);
        selectRange(range);
    },

    undo: function () {
        var point = this.restorePoint;
        point.body.innerHTML = point.html;
        selectRange(point.toRange());
    },

    redo: function () {
        this.exec();
    },

    exec: function () {
        var range = this.lockRange(true);
        this.formatter.editor = this.editor;
        this.formatter.toggle(range);
        this.releaseRange(range);
    }
});

var GenericCommand = Class.extend({
    init: function(startRestorePoint, endRestorePoint) {
        this.body = startRestorePoint.body;
    },

    redo: function () {
        this.body.innerHTML = endRestorePoint.html;
        selectRange(endRestorePoint.toRange());
    },

    undo: function () {
        this.body.innerHTML = startRestorePoint.html;
        selectRange(startRestorePoint.toRange());
    }
});

var InsertHtmlCommand = Command.extend({
    init: function(options) {
        var cmd = this;
        Command.fn.init.call(cmd, options);

        this.managesUndoRedo = true;
    },

    exec: function() {
        var editor = this.editor;
        var range = editor.getRange();
        var startRestorePoint = new RestorePoint(range);

        editor.clipboard.paste(options.value || '');
        editor.undoRedoStack.push(new GenericCommand(startRestorePoint, new RestorePoint(editor.getRange())));

        editor.focus();
    }
});

var InsertHtmlTool = Tool.extend({
    init: function($ui, initOptions) {
        var t = this;
        Tool.fn.init.call(t, $ui, initOptions);

        var editor = initOptions.editor;
        
        $ui.tSelectBox({
            data: editor['insertHtml'],
            onItemCreate: function (e) {
                e.html = '<span unselectable="on">' + e.dataItem.Text + '</span>';
            },
            onChange: function (e) {
                Tool.exec(editor, 'insertHtml', e.value);
            },
            highlightFirst: false
        }).find('.t-input').html(editor.localization.insertHtml);
    },

    command: function (commandArguments) {
        return new InsertHtmlCommand(commandArguments);
    },

    update: function($ui, nodes) {
        $ui.data('tSelectBox').close();
    }

});

var UndoRedoStack = Class.extend({
    init: function() {
        this.stack = [];
        this.currentCommandIndex = -1;
    },

    push: function (command) {
        this.stack = this.stack.slice(0, this.currentCommandIndex + 1);
        this.currentCommandIndex = this.stack.push(command) - 1;
    },

    undo: function () {
        if (this.canUndo())
            this.stack[this.currentCommandIndex--].undo();
    },

    redo: function () {
        if (this.canRedo())
            this.stack[++this.currentCommandIndex].redo();
    },

    canUndo: function () {
        return this.currentCommandIndex >= 0;
    },

    canRedo: function () {
        return this.currentCommandIndex != this.stack.length - 1;
    }
});

var TypingHandler = Class.extend({
    init: function(editor) {
        this.editor = editor;
    },

    keydown: function (e) {
        var editor = this.editor,
            keyboard = editor.keyboard;
            isTypingKey = keyboard.isTypingKey(e);

        if (isTypingKey && !keyboard.typingInProgress()) {
            var range = editor.getRange();
            this.startRestorePoint = new RestorePoint(range);

            keyboard.startTyping($.proxy(function () {
                editor.selectionRestorePoint = this.endRestorePoint = new RestorePoint(editor.getRange());
                editor.undoRedoStack.push(new GenericCommand(this.startRestorePoint, this.endRestorePoint));
            }, this));

            return true;
        }

        return false;
    },

    keyup: function (e) {
        var keyboard = this.editor.keyboard;

        if (keyboard.typingInProgress()) {
            keyboard.endTyping();
            return true;
        }

        return false;
    }    
});

var SystemHandler = Class.extend({
    init: function(editor) {
        this.editor = editor;
        this.systemCommandIsInProgress = false;
    },

    createUndoCommand: function () {
        this.endRestorePoint = new RestorePoint(this.editor.getRange());
        this.editor.undoRedoStack.push(new GenericCommand(this.startRestorePoint, this.endRestorePoint));
        this.startRestorePoint = this.endRestorePoint;
    },

    changed: function () {
        if (this.startRestorePoint)
            return this.startRestorePoint.html != this.editor.body.innerHTML;

        return false;
    },

    keydown: function (e) {
        var editor = this.editor,
            keyboard = editor.keyboard;

        if (keyboard.isModifierKey(e)) {

            if (keyboard.typingInProgress())
                keyboard.endTyping(true);

            this.startRestorePoint = new RestorePoint(editor.getRange());
            return true;
        }

        if (keyboard.isSystem(e)) {
            this.systemCommandIsInProgress = true;

            if (this.changed()) {
                this.systemCommandIsInProgress = false;
                this.createUndoCommand();
            }

            return true;
        }

        return false;
    },

    keyup: function (e) {
        if (this.systemCommandIsInProgress && this.changed()) {
            this.systemCommandIsInProgress = false;
            this.createUndoCommand(e);
            return true;
        }

        return false;
    }
});

var Keyboard = Class.extend({
    init: function(handlers) {
        this.handlers = handlers;
        this.typingInProgress = false;
    },

    isCharacter: function(keyCode) {
        return (keyCode >= 48 && keyCode <= 90) || (keyCode >= 96 && keyCode <= 111) ||
            (keyCode >= 186 && keyCode <= 192) || (keyCode >= 219 && keyCode <= 222);
    },

    toolFromShortcut: function (tools, e) {
        var key = String.fromCharCode(e.keyCode);

        for (var toolName in tools) {
            var tool = tools[toolName];

            if ((tool.key == key || tool.key == e.keyCode) && !!tool.ctrl == e.ctrlKey && !!tool.alt == e.altKey && !!tool.shift == e.shiftKey)
                return toolName;
        }
    },

    isTypingKey: function (e) {
        var keyCode = e.keyCode;
        return (this.isCharacter(keyCode) && !e.ctrlKey && !e.altKey) || keyCode == 32 || keyCode == 13
        || keyCode == 8 || (keyCode == 46 && !e.shiftKey && !e.ctrlKey && !e.altKey);
    },

    isModifierKey: function (e) {
        var keyCode = e.keyCode;
        return (keyCode == 17 && !e.shiftKey && !e.altKey)
                || (keyCode == 16 && !e.ctrlKey && !e.altKey)
                || (keyCode == 18 && !e.ctrlKey && !e.shiftKey);
    },

    isSystem: function (e) {
        return e.keyCode == 46 && e.ctrlKey && !e.altKey && !e.shiftKey;
    },

    startTyping: function (callback) {
        this.onEndTyping = callback;
        this.typingInProgress = true;
    },

    stopTyping: function() {
        this.typingInProgress = false;
        if (this.onEndTyping)
            this.onEndTyping();
    },

    endTyping: function (force) {
        this.clearTimeout();
        if (force)
            this.stopTyping();
        else
            this.timeout = window.setTimeout(this.stopTyping, 1000);
    },

    typingInProgress: function () {
        return this.typingInProgress;
    },

    clearTimeout: function () {
        window.clearTimeout(this.timeout);
    },

    notify: function(e, what) {
        for (var i = 0; i < this.handlers.length; i++)
            if (this.handlers[i][what](e))
                break;
    },

    keydown: function (e) {
        this.notify(e, 'keydown');
    },

    keyup: function (e) {
        this.notify(e, 'keyup');
    }
});

var Clipboard = Class.extend({
    init: function(editor) {
        this.cleaners = [new MSWordFormatCleaner()];
    },

    htmlToFragment: function(html) {
        var container = dom.create(editor.document, 'div');
        container.innerHTML = html;
            
        var fragment = editor.document.createDocumentFragment();
            
        while (container.firstChild)
            fragment.appendChild(container.firstChild);
            
        return fragment;
    },

    isBlock: function(html) {
        return /<(div|p|ul|ol|table|h[1-6])/i.test(html);
    },
        
    oncut: function(e) {
        var startRestorePoint = new RestorePoint(editor.getRange());
        setTimeout(function() {
            editor.undoRedoStack.push(new GenericCommand(startRestorePoint, new RestorePoint(editor.getRange())));
        });
    },

    onpaste: function(e) {
        var range = editor.getRange();
        var startRestorePoint = new RestorePoint(range);
            
        var clipboardNode = dom.create(editor.document, 'div', {className:'t-paste-container', innerHTML: '\ufeff'});

        editor.body.appendChild(clipboardNode);
            
        if (editor.body.createTextRange) {
            e.preventDefault();
            var r = editor.createRange();
            r.selectNodeContents(clipboardNode);
            editor.selectRange(r);
            var textRange = editor.body.createTextRange();
            textRange.moveToElementText(clipboardNode);
            $(editor.body).unbind('paste');
            textRange.execCommand('Paste');
            $(editor.body).bind('paste', arguments.callee);
        } else {
            var clipboardRange = editor.createRange();
            clipboardRange.selectNodeContents(clipboardNode);
            selectRange(clipboardRange);
        }
            
        setTimeout(function() {
            selectRange(range);
            dom.remove(clipboardNode);
                
            if (clipboardNode.lastChild && dom.is(clipboardNode.lastChild, 'br'))
                dom.remove(clipboardNode.lastChild);
                
            var args = { html: clipboardNode.innerHTML };
            $t.trigger(editor.element, "paste", args);
            editor.clipboard.paste(args.html, true);
            editor.undoRedoStack.push(new GenericCommand(startRestorePoint, new RestorePoint(editor.getRange())));
            selectionChanged(editor);
        });
    },

    splittableParent: function(block, node) {
        if (block)
            return dom.parentOfType(node, ['p', 'ul', 'ol']) || node.parentNode;
            
        var parent = node.parentNode;
        var body = node.ownerDocument.body;
            
        if (dom.isInline(parent)) {
            while (parent.parentNode != body && !dom.isBlock(parent.parentNode))
                parent = parent.parentNode;
        }
            
        return parent;
    },

    paste: function (html, clean) {
        var i, l;

        for (i = 0, l = this.cleaners.length; i < l; i++)
            if (this.cleaners[i].applicable(html))
                html = this.cleaners[i].clean(html);
            
        if (clean) {
            // remove br elements which immediately precede block elements
            html = html.replace(/(<br>(\s|&nbsp;)*)+(<\/?(div|p|li|col|t))/ig, "$3");
            // remove empty inline elements
            html = html.replace(/<(a|span)[^>]*><\/\1>/ig, "");
        }

        // It is possible in IE to copy just <li> tags
        html = html.replace(/^<li/i, '<ul><li').replace(/li>$/g, 'li></ul>');

        var block = this.isBlock(html);

        var range = editor.getRange();
        range.deleteContents();

        if (range.startContainer == editor.document)
            range.selectNodeContents(editor.body);
            
        var marker = new Marker();
        var caret = marker.addCaret(range)
            
        var parent = this.splittableParent(block, caret);
        var unwrap = false;
            
        if (!/body|td/.test(dom.name(parent)) && (block || dom.isInline(parent))) {
            range.selectNode(caret);
            split(range, parent, true);
            unwrap = true;
        }
            
        var fragment = this.htmlToFragment(html);
        
        if (fragment.firstChild && fragment.firstChild.className === "t-paste-container") {
            var fragmentsHtml = [];
            for (i = 0, l = fragment.childNodes.length; i < l; i++) {
                fragmentsHtml.push(fragment.childNodes[i].innerHTML);
            }

            fragment = this.htmlToFragment(fragmentsHtml.join('<br />'));
        }

        range.insertNode(fragment);
                
        parent = this.splittableParent(block, caret);
        if (unwrap) {
            while (caret.parentNode != parent)
                dom.unwrap(caret.parentNode);
                
            dom.unwrap(caret.parentNode);
        }
            
        normalize(range.commonAncestorContainer);
        caret.style.display = 'inline';
        dom.scrollTo(caret);
        marker.removeCaret(range);
        selectRange(range);
    }
});

var MSWordFormatCleaner = Class.extend({
    init: function() {
        this.replacements = [
            /<!--(.|\n)*?-->/g, '', /* comments */
            /&quot;/g, "'", /* encoded quotes (in attributes) */
            /(?:<br>&nbsp;[\s\r\n]+|<br>)*(<\/?(h[1-6]|hr|p|div|table|tbody|thead|tfoot|th|tr|td|li|ol|ul|caption|address|pre|form|blockquote|dl|dt|dd|dir|fieldset)[^>]*>)(?:<br>&nbsp;[\s\r\n]+|<br>)*/g, '$1',
            /<br><br>/g, '<BR><BR>', 
            /<br>/g, ' ',
            /<BR><BR>/g, '<br>',
            /^\s*(&nbsp;)+/gi, '',
            /(&nbsp;|<br[^>]*>)+\s*$/gi, '',
            /mso-[^;"]*;?/ig, '', /* office-related CSS attributes */
            /<(\/?)b(\s[^>]*)?>/ig, '<$1strong$2>',
            /<(\/?)i(\s[^>]*)?>/ig, '<$1em$2>',
            /<\/?(meta|link|style|o:|v:)[^>]*>((?:.|\n)*?<\/(meta|link|style|o:|v:)[^>]*>)?/ig, '', /* external references and namespaced tags */
            /style=(["|'])\s*\1/g, '' /* empty style attributes */
        ];
    },

    applicable: function(html) {
        return /class="?Mso|style="[^"]*mso-/i.test(html);
    },
        
    listType: function(html) {
        if (/^[\u2022\u00b7\u00a7\u00d8o]\u00a0+/.test(html))
            return 'ul';
            
        if (/^\s*\w+[\.\)]\u00a0{2,}/.test(html))
            return 'ol';
    },

    lists: function(html) {
        var placeholder = dom.create(document, 'div', {innerHTML: html});
        var blockChildren = $(blockElements.join(','), placeholder);
            
        var lastMargin = -1, lastType, levels = {'ul':{}, 'ol':{}}, li = placeholder;
            
        for (var i = 0; i < blockChildren.length; i++) {
            var p = blockChildren[i];
            var html = p.innerHTML.replace(/<\/?\w+[^>]*>/g, '').replace(/&nbsp;/g, '\u00a0');      
            var type = this.listType(html);
                
            if (!type || dom.name(p) != 'p') { 
                if (p.innerHTML == '') {
                    dom.remove(p);
                } else {
                    levels = {'ul':{}, 'ol':{}};
                    li = placeholder;
                    lastMargin = -1;
                }
                continue;
            }
                
            var margin = parseFloat(p.style.marginLeft || 0);
            var list = levels[type][margin];

            if (margin > lastMargin || !list) {
                list = dom.create(document, type);
                    
                if (li == placeholder)
                    dom.insertBefore(list, p);
                else 
                    li.appendChild(list);
                    
                levels[type][margin] = list;
            }
                
            if (lastType != type) {
                for (var key in levels)
                    for (var child in levels[key])
                        if ($.contains(list, levels[key][child]))
                            delete levels[key][child];
            }

            dom.remove(p.firstChild);
            li = dom.create(document, 'li', {innerHTML:p.innerHTML});
            list.appendChild(li);
            dom.remove(p);
            lastMargin = margin;
            lastType = type;
        }
        return placeholder.innerHTML;
    },

    stripEmptyAnchors: function(html) {
        return html.replace(/<a([^>]*)>\s*<\/a>/ig, function(a, attributes) {
            if (!attributes || attributes.indexOf("href") < 0) {
                return "";
            }

            return a;
        });
    },

    clean: function(html) {
        for (var i = 0, l = this.replacements.length; i < l; i+= 2)
            html = html.replace(this.replacements[i], this.replacements[i+1]);

        html = this.stripEmptyAnchors(html);
        html = this.lists(html);
        html = html.replace(/\s+class="?[^"\s>]*"?/ig, '');
           
        return html;
    }
});

extend(kendo.ui.Editor, {
    Command: Command,
    GenericCommand: GenericCommand,
    InsertHtmlCommand: InsertHtmlCommand,
    InsertHtmlTool: InsertHtmlTool,
    UndoRedoStack: UndoRedoStack,
    TypingHandler: TypingHandler,
    SystemHandler: SystemHandler,
    Keyboard: Keyboard,
    Clipboard: Clipboard,
    MSWordFormatCleaner: MSWordFormatCleaner
});

})(jQuery);