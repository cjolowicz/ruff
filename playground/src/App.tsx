import Editor, { useMonaco } from "@monaco-editor/react";
import lzstring from "lz-string";
import { MarkerSeverity } from "monaco-editor/esm/vs/editor/editor.api";
import { useCallback, useEffect, useState } from "react";
import { Config, getDefaultConfig, toRuffConfig } from "./config";

import init, { Check, check } from "./pkg/ruff.js";
import { AVAILABLE_OPTIONS } from "./ruff_options";

const DEFAULT_SOURCE =
  "# Define a function that takes an integer n and returns the nth number in the Fibonacci\n" +
  "# sequence.\n" +
  "def fibonacci(n):\n" +
  "  if n == 0:\n" +
  "    return 0\n" +
  "  elif n == 1:\n" +
  "    return 1\n" +
  "  else:\n" +
  "    return fibonacci(n-1) + fibonacci(n-2)\n" +
  "\n" +
  "# Use a for loop to generate and print the first 10 numbers in the Fibonacci sequence.\n" +
  "for i in range(10):\n" +
  "  print(fibonacci(i))\n" +
  "\n" +
  "# Output:\n" +
  "# 0\n" +
  "# 1\n" +
  "# 1\n" +
  "# 2\n" +
  "# 3\n" +
  "# 5\n" +
  "# 8\n" +
  "# 13\n" +
  "# 21\n" +
  "# 34\n";

function restoreConfigAndSource(): [Config, string] {
  const value = lzstring.decompressFromEncodedURIComponent(
    window.location.hash.slice(1)
  );
  let config = {};
  let source = DEFAULT_SOURCE;

  if (value) {
    const parts = value.split("$$$");
    config = JSON.parse(parts[0]);
    source = parts[1];
  }

  return [config, source];
}

function persistConfigAndSource(config: Config, source: string) {
  window.location.hash = lzstring.compressToEncodedURIComponent(
    JSON.stringify(config) + "$$$" + source
  );
}

const defaultConfig = getDefaultConfig(AVAILABLE_OPTIONS);

export default function App() {
  const monaco = useMonaco();
  const [initialized, setInitialized] = useState<boolean>(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init().then(() => setInitialized(true));
  }, []);

  useEffect(() => {
    if (source == null && config == null && monaco) {
      const [config, source] = restoreConfigAndSource();
      setConfig(config);
      setSource(source);
    }
  }, [monaco, source, config]);

  useEffect(() => {
    if (config != null && source != null) {
      persistConfigAndSource(config, source);
    }
  }, [config, source]);

  useEffect(() => {
    const editor = monaco?.editor;
    const model = editor?.getModels()[0];
    if (!editor || !model || !initialized || source == null || config == null) {
      return;
    }

    let checks: Check[];
    try {
      checks = check(source, toRuffConfig(config));
      setError(null);
    } catch (e) {
      setError(String(e));
      return;
    }

    editor.setModelMarkers(
      model,
      "owner",
      checks.map((check) => ({
        startLineNumber: check.location.row,
        startColumn: check.location.column + 1,
        endLineNumber: check.end_location.row,
        endColumn: check.end_location.column + 1,
        message: `${check.code}: ${check.message}`,
        severity: MarkerSeverity.Error,
      }))
    );

    const codeActionProvider = monaco?.languages.registerCodeActionProvider(
      "python",
      {
        // @ts-expect-error: The type definition is wrong.
        provideCodeActions: function (model, position) {
          const actions = checks
            .filter((check) => position.startLineNumber === check.location.row)
            .filter((check) => check.fix)
            .map((check) => ({
              title: `Fix ${check.code}`,
              id: `fix-${check.code}`,
              kind: "quickfix",
              edit: check.fix
                ? {
                    edits: [
                      {
                        resource: model.uri,
                        versionId: model.getVersionId(),
                        edit: {
                          range: {
                            startLineNumber: check.fix.location.row,
                            startColumn: check.fix.location.column + 1,
                            endLineNumber: check.fix.end_location.row,
                            endColumn: check.fix.end_location.column + 1,
                          },
                          text: check.fix.content,
                        },
                      },
                    ],
                  }
                : undefined,
            }));
          return { actions, dispose: () => {} };
        },
      }
    );

    return () => {
      codeActionProvider?.dispose();
    };
  }, [config, source, monaco, initialized]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      setSource(value || "");
    },
    [setSource]
  );

  const handleOptionChange = useCallback(
    (groupName: string, fieldName: string, value: string) => {
      const group = Object.assign({}, (config || {})[groupName]);
      if (value === defaultConfig[groupName][fieldName] || value === "") {
        delete group[fieldName];
      } else {
        group[fieldName] = value;
      }

      setConfig({
        ...config,
        [groupName]: group,
      });
    },
    [config]
  );

  useEffect(() => {
    monaco?.editor.defineTheme("Eiffel", {
      base: "vs-dark",
      inherit: true,
      rules: [
        {
          background: "000000",
          token: "",
        },
        {
          foreground: "ffffff",
          background: "0f0f0f",
          token: "text",
        },
        {
          background: "000000",
          token: "source.ruby.rails.embedded.html",
        },
        {
          foreground: "ffffff",
          background: "101010",
          token: "text.html.ruby",
        },
        {
          foreground: "ccff33",
          token: "constant.numeric.ruby",
        },
        {
          foreground: "ffffff",
          background: "000000",
          token: "source",
        },
        {
          foreground: "9933cc",
          token: "comment",
        },
        {
          foreground: "339999",
          token: "constant",
        },
        {
          foreground: "ff6600",
          token: "keyword",
        },
        {
          foreground: "edf8f9",
          token: "keyword.preprocessor",
        },
        {
          foreground: "ffffff",
          token: "keyword.preprocessor directive",
        },
        {
          foreground: "ffcc00",
          token: "entity.name.function",
        },
        {
          foreground: "ffcc00",
          token: "storage.type.function.js",
        },
        {
          fontStyle: "italic",
          token: "variable.parameter",
        },
        {
          foreground: "772cb7",
          background: "070707",
          token: "source comment.block",
        },
        {
          foreground: "ffffff",
          token: "variable.other",
        },
        {
          foreground: "999966",
          token: "support.function.activerecord.rails",
        },
        {
          foreground: "66ff00",
          token: "string",
        },
        {
          foreground: "aaaaaa",
          token: "string constant.character.escape",
        },
        {
          foreground: "000000",
          background: "cccc33",
          token: "string.interpolated",
        },
        {
          foreground: "44b4cc",
          token: "string.regexp",
        },
        {
          foreground: "cccc33",
          token: "string.literal",
        },
        {
          foreground: "555555",
          token: "string.interpolated constant.character.escape",
        },
        {
          fontStyle: "underline",
          token: "entity.name.class",
        },
        {
          fontStyle: "underline",
          token: "support.class.js",
        },
        {
          fontStyle: "italic underline",
          token: "entity.other.inherited-class",
        },
        {
          foreground: "ff6600",
          token: "meta.tag.inline.any.html",
        },
        {
          foreground: "ff6600",
          token: "meta.tag.block.any.html",
        },
        {
          foreground: "99cc99",
          fontStyle: "italic",
          token: "entity.other.attribute-name",
        },
        {
          foreground: "dde93d",
          token: "keyword.other",
        },
        {
          foreground: "ff6600",
          token: "meta.selector.css",
        },
        {
          foreground: "ff6600",
          token: "entity.other.attribute-name.pseudo-class.css",
        },
        {
          foreground: "ff6600",
          token: "entity.name.tag.wildcard.css",
        },
        {
          foreground: "ff6600",
          token: "entity.other.attribute-name.id.css",
        },
        {
          foreground: "ff6600",
          token: "entity.other.attribute-name.class.css",
        },
        {
          foreground: "999966",
          token: "support.type.property-name.css",
        },
        {
          foreground: "ffffff",
          token: "keyword.other.unit.css",
        },
        {
          foreground: "ffffff",
          token: "constant.other.rgb-value.css",
        },
        {
          foreground: "ffffff",
          token: "constant.numeric.css",
        },
        {
          foreground: "ffffff",
          token: "support.function.event-handler.js",
        },
        {
          foreground: "ffffff",
          token: "keyword.operator.js",
        },
        {
          foreground: "cccc66",
          token: "keyword.control.js",
        },
        {
          foreground: "ffffff",
          token: "support.class.prototype.js",
        },
        {
          foreground: "ff6600",
          token: "object.property.function.prototype.js",
        },
      ],
      colors: {
        "editor.foreground": "#FFFFFF",
        "editor.background": "#000000",
        "editor.selectionBackground": "#35493CE0",
        "editor.lineHighlightBackground": "#333300",
        "editorCursor.foreground": "#FFFFFF",
        "editorWhitespace.foreground": "#404040",
      },
    });
  }, [monaco]);

  return (
    <div className={"App"}>
      <header className={"Header"}>
        <span style={{ outlineColor: "transparent" }}>
          <button aria-label="Configuration Files" className={"IconButton"}>
            <svg
              width="40"
              height="32"
              fill="none"
              viewBox="0 0 40 32"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                fillRule="evenodd"
                d="M21.253 6h-3.076l-.463 1.85a8.413 8.413 0 00-2.13.931l-1.567-.94-2.176 2.176.94 1.567a8.414 8.414 0 00-1.01 2.435L10 14.462v3.077l1.772.442c.209.872.553 1.692 1.01 2.435l-.94 1.567 2.175 2.176 1.566-.94c.744.456 1.564.8 2.436 1.01L18.46 26h3.077l.443-1.772a8.411 8.411 0 002.435-1.01l1.567.94 2.176-2.175-.94-1.567c.456-.743.8-1.563 1.01-2.435L30 17.538v-3.077l-1.772-.442a8.411 8.411 0 00-1.01-2.436l.94-1.566-2.175-2.176-1.567.94a8.408 8.408 0 00-2.736-1.076zM20 20.286a4.286 4.286 0 100-8.572 4.286 4.286 0 000 8.572z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </span>

        <a
          href={"https://GitHub.com/charliermarsh/ruff"}
          style={{ width: 120, height: 24 }}
        >
          <img
            src={
              "https://img.shields.io/github/stars/charliermarsh/ruff.svg?style=social&label=GitHub&maxAge=2592000&?logoWidth=100"
            }
            alt={"GitHub stars"}
            style={{ width: 120, height: 24 }}
          />
        </a>
      </header>
      <div className={"Body"}>
        <nav className={"Nav"}></nav>
        <div className={"Editor"}>
          <Editor
            options={{
              readOnly: false,
              minimap: { enabled: false },
              fontSize: 14,
              roundedSelection: false,
              scrollBeyondLastLine: false,
            }}
            language={"python"}
            value={source || ""}
            theme={"vs"}
            onChange={handleEditorChange}
          />
        </div>
      </div>
      {error && <div className={"Error"}>{error}</div>}
    </div>
  );
}
