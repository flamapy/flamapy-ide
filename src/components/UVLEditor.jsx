/* eslint-disable react/prop-types */

import { useEffect, useRef } from "react";
import { Editor } from "@monaco-editor/react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";

function UVLEditor({
  editorRef,
  validateModel,
  defaultCode = "",
  hide,
  collabConfig,
  onEditorMount,
}) {
  const collabRefs = useRef({ provider: null, ydoc: null });

  useEffect(() => {
    return () => {
      collabRefs.current?.provider?.destroy();
      collabRefs.current?.ydoc?.destroy();
    };
  }, []);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    onEditorMount?.();
    monaco.languages.register({ id: "uvl" });

    // Set the tokens provider (syntax highlighting)
    monaco.languages.setMonarchTokensProvider("uvl", {
      defaultToken: "",
      tokenPostfix: ".uvl",

      keywords: [
        "root",
        "features",
        "constraints",
        "group",
        "and",
        "or",
        "xor",
        "alternative",
        "optional",
        "mandatory",
      ],

      operators: ["=", "==", "!", ">", "<", ">=", "<=", "&&", "||", "!", "+"],

      symbols: /[=><!~?:&|+\-*\/\^%]+/,

      escapes: /\\(?:[abfnrtv\\"'0-9x])/,

      tokenizer: {
        root: [
          // Identifiers and keywords
          [
            /[a-z_$][\w$]*/,
            {
              cases: {
                "@keywords": "keyword",
                "@default": "identifier",
              },
            },
          ],

          // Whitespace
          { include: "@whitespace" },

          // Delimiters and operators
          [/[{}()\[\]]/, "@brackets"],
          [/[<>](?!@symbols)/, "@brackets"],
          [
            /@symbols/,
            {
              cases: {
                "@operators": "operator",
                "@default": "",
              },
            },
          ],

          // Numbers
          [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
          [/\d+/, "number"],

          // Strings
          [/"([^"\\]|\\.)*$/, "string.invalid"], // Non-terminated string
          [/"$/, "string.escape", "@popall"],
          [/"/, "string", "@string"],

          // Comments
          [/\/\*/, "comment", "@comment"],
          [/\/\/.*$/, "comment"],
        ],

        comment: [
          [/[^\/*]+/, "comment"],
          [/\*\//, "comment", "@pop"],
          [/[\/*]/, "comment"],
        ],

        string: [
          [/[^\\"]+/, "string"],
          [/@escapes/, "string.escape"],
          [/\\./, "string.escape.invalid"],
          [/"/, "string", "@pop"],
        ],

        whitespace: [
          [/[ \t\r\n]+/, ""],
          [/\/\*/, "comment", "@comment"],
          [/\/\/.*$/, "comment"],
        ],
      },
    });

    // Define the language configuration (brackets, comments, etc.)
    monaco.languages.setLanguageConfiguration("uvl", {
      comments: {
        lineComment: "//",
        blockComment: ["/*", "*/"],
      },
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
      ],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: '"', close: '"' },
      ],
    });
    monaco.languages.registerCompletionItemProvider("uvl", {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        const kw = (label, insertText, detail) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail,
          range,
        });
        return {
          suggestions: [
            kw("namespace",  "namespace ${1:ModelName}\n",         "Declare model namespace"),
            kw("features",   "features\n\t${1:Root}\n",            "Feature declarations block"),
            kw("constraints","constraints\n\t${1:constraint}\n",   "Constraints block"),
            kw("mandatory",  "mandatory\n\t\t${1:Feature}\n",      "Mandatory group"),
            kw("optional",   "optional\n\t\t${1:Feature}\n",       "Optional group"),
            kw("alternative","alternative\n\t\t${1:Feature}\n",    "Alternative (XOR) group"),
            kw("or",         "or\n\t\t${1:Feature}\n",             "Or group"),
          ],
        };
      },
    });

    if (collabConfig?.enabled) {
      const ydoc = new Y.Doc();
      const provider = new WebsocketProvider(
        collabConfig.endpoint,
        collabConfig.docId,
        ydoc
      );
      const yText = ydoc.getText("uvl");

      if (yText.length === 0 && defaultCode) {
        yText.insert(0, defaultCode);
      }

      new MonacoBinding(
        yText,
        editor.getModel(),
        new Set([editor]),
        provider.awareness
      );

      provider.awareness.setLocalStateField("user", {
        name: collabConfig.userName || "anonymous",
      });

      collabRefs.current = { provider, ydoc };
    } else if (defaultCode) {
      editor.setValue(defaultCode);
    }
  }

  return (
    <div className={`flex-1 bg-gray-100 text-black p-4 ${hide && "hidden"}`}>
      <div className="grid grid-cols-1 grid-rows-1 h-full w-full rounded-lg">
        <Editor
          key={collabConfig?.enabled ? `collab-${collabConfig.docId}` : "solo"}
          defaultLanguage="uvl"
          defaultValue={collabConfig?.enabled ? "" : defaultCode}
          onMount={handleEditorDidMount}
          onChange={validateModel}
          options={{
            insertSpaces: false,
            tabSize: 4,
          }}
        />
      </div>
    </div>
  );
}

export default UVLEditor;
