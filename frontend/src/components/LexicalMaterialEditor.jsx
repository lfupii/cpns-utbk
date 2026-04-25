import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { HeadingNode, QuoteNode, $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { LinkNode, TOGGLE_LINK_COMMAND, $isLinkNode } from '@lexical/link';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
  $isListNode,
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';

function LexicalInitialHtmlPlugin({ initialHtml }) {
  const [editor] = useLexicalComposerContext();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;
    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (initialHtml) {
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialHtml, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        root.append(...nodes);
      }

      if (!root.getFirstChild()) {
        root.append($createParagraphNode());
      }
    });
  }, [editor, initialHtml]);

  return null;
}

function resolveBlockTypeFromSelection(selection) {
  if (!$isRangeSelection(selection)) {
    return 'paragraph';
  }

  const anchorNode = selection.anchor.getNode();
  const topLevelElement = anchorNode.getTopLevelElementOrThrow();
  const parentNode = topLevelElement.getParent();

  if ($isListNode(topLevelElement)) {
    return topLevelElement.getListType();
  }

  if ($isListNode(parentNode)) {
    return parentNode.getListType();
  }

  const topLevelType = topLevelElement.getType();
  if (topLevelType === 'heading' && typeof topLevelElement.getTag === 'function') {
    return topLevelElement.getTag();
  }

  return topLevelType;
}

function setBlockType(editor, blockType) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }

    if (blockType === 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }

    if (blockType === 'number') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      return;
    }

    if (blockType === 'paragraph') {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      $setBlocksType(selection, () => $createParagraphNode());
      return;
    }

    if (blockType === 'quote') {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      $setBlocksType(selection, () => $createQuoteNode());
      return;
    }

    if (blockType === 'h2' || blockType === 'h3') {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      $setBlocksType(selection, () => $createHeadingNode(blockType));
    }
  });
}

function LexicalToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [blockType, setCurrentBlockType] = useState('paragraph');
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    link: false,
    align: 'left',
  });

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }

    const anchorNode = selection.anchor.getNode();
    const parentNode = anchorNode.getParent();
    setCurrentBlockType(resolveBlockTypeFromSelection(selection));
    setFormatState({
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      link: $isLinkNode(anchorNode) || $isLinkNode(parentNode),
      align: anchorNode.getTopLevelElementOrThrow().getFormatType() || 'left',
    });
  }, []);

  useEffect(() => {
    const unregisterUpdate = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar();
      });
    });

    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterCanUndo = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterCanRedo = editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregisterUpdate();
      unregisterSelection();
      unregisterCanUndo();
      unregisterCanRedo();
    };
  }, [editor, updateToolbar]);

  const toggleLink = () => {
    if (formatState.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }

    const nextUrl = window.prompt('Masukkan URL link');
    if (nextUrl && nextUrl.trim()) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, nextUrl.trim());
    }
  };

  return (
    <div className="admin-lexical-toolbar">
      <div className="admin-lexical-toolbar-group">
        <label className="admin-lexical-toolbar-label" htmlFor="lexical-block-type">Blok</label>
        <select
          id="lexical-block-type"
          value={blockType}
          onChange={(event) => setBlockType(editor, event.target.value)}
        >
          <option value="paragraph">Paragraf</option>
          <option value="h2">Heading 1</option>
          <option value="h3">Heading 2</option>
          <option value="quote">Quote</option>
          <option value="bullet">Bullet</option>
          <option value="number">Nomor</option>
        </select>
      </div>

      <div className="admin-lexical-toolbar-group">
        <button
          type="button"
          className={formatState.bold ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        >
          B
        </button>
        <button
          type="button"
          className={formatState.italic ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        >
          I
        </button>
        <button
          type="button"
          className={formatState.underline ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        >
          U
        </button>
        <button
          type="button"
          className={formatState.link ? 'admin-lexical-toolbar-button admin-lexical-toolbar-button-active' : 'admin-lexical-toolbar-button'}
          onClick={toggleLink}
        >
          Link
        </button>
      </div>

      <div className="admin-lexical-toolbar-group">
        <button type="button" className="admin-lexical-toolbar-button" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}>Kiri</button>
        <button type="button" className="admin-lexical-toolbar-button" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}>Tengah</button>
        <button type="button" className="admin-lexical-toolbar-button" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}>Kanan</button>
        <button type="button" className="admin-lexical-toolbar-button" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')}>Justify</button>
      </div>

      <div className="admin-lexical-toolbar-group">
        <button type="button" className="admin-lexical-toolbar-button" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} disabled={!canUndo}>Undo</button>
        <button type="button" className="admin-lexical-toolbar-button" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} disabled={!canRedo}>Redo</button>
      </div>
    </div>
  );
}

export default function LexicalMaterialEditor({
  documentKey,
  initialHtml,
  onChange,
}) {
  const initialConfig = useMemo(() => ({
    namespace: `material-lexical-editor-${documentKey}`,
    onError: (error) => {
      throw error;
    },
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode],
    theme: {
      paragraph: 'admin-lexical-paragraph',
      quote: 'admin-lexical-quote',
      heading: {
        h2: 'admin-lexical-heading admin-lexical-heading-h2',
        h3: 'admin-lexical-heading admin-lexical-heading-h3',
      },
      text: {
        bold: 'admin-lexical-text-bold',
        italic: 'admin-lexical-text-italic',
        underline: 'admin-lexical-text-underline',
      },
      list: {
        ul: 'admin-lexical-list-ul',
        ol: 'admin-lexical-list-ol',
        listitem: 'admin-lexical-list-item',
      },
      link: 'admin-lexical-link',
    },
  }), [documentKey]);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="admin-lexical-shell">
        <LexicalToolbarPlugin />
        <div className="admin-lexical-surface">
          <RichTextPlugin
            contentEditable={<ContentEditable className="admin-lexical-editor" />}
            placeholder={<div className="admin-lexical-placeholder">Mulai tulis materi di sini...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <LexicalInitialHtmlPlugin initialHtml={initialHtml} />
          <OnChangePlugin
            onChange={(editorState, editor) => {
              editorState.read(() => {
                onChange?.({
                  html: $generateHtmlFromNodes(editor, null),
                  json: editorState.toJSON(),
                });
              });
            }}
          />
        </div>
      </div>
    </LexicalComposer>
  );
}
