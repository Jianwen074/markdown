
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { marked } from 'marked'; // Import marked

// Declare hljs to inform TypeScript about the global variable from the CDN
declare global {
  interface Window {
    hljs: any;
  }
}

// Infer the base options type from marked.setOptions parameters
type BaseMarkedOptions = Parameters<typeof marked.setOptions>[0];

// Define a custom options type that explicitly includes 'highlight'
interface AppMarkedOptions extends BaseMarkedOptions {
  highlight?: (code: string, lang: string) => string;
}

interface ToolbarItemConfig {
  id: string;
  label: string;
  ariaLabel: string;
  title?: string;
}

const defaultInitialMarkdownLeft = `
# Welcome to the Markdown Editor!

## Type your Markdown on the left...
### ...and see the document preview on the right!

---

**Features:**

*   Markdown Editor with Toolbar
*   Live Document Preview with Syntax Highlighting
*   Styled with **Tailwind CSS**
*   Responsive design

---

**Examples:**

An unordered list:
*   Item 1
*   Item 2
    *   Sub-item A
    *   Sub-item B

A link: [Learn Markdown](https://www.markdownguide.org/)

An image: ![Placeholder](https://via.placeholder.com/150/CBD5E1/475569?text=Image)

A code block:
\`\`\`javascript
function greet(name) {
  // This is a comment
  return 'Hello, ' + name + '!';
}
console.log(greet('World'));
\`\`\`

Another code block (Python):
\`\`\`python
def Power(base, exp):
    if (exp == 0):
        return 1
    return (base * Power(base, exp - 1))

# Driver Code
base = 5
exp = 3
print("Result:", Power(base, exp))
\`\`\`
`;

const getMarkdownFromURL = (): string => {
  const params = new URLSearchParams(window.location.search);
  const mdFromQuery = params.get('md');
  if (mdFromQuery) {
    try {
      return decodeURIComponent(mdFromQuery);
    } catch (e) {
      console.error("Error decoding markdown from URL query parameter:", e);
      return defaultInitialMarkdownLeft;
    }
  }
  return defaultInitialMarkdownLeft;
};

const commonToolbarConfig: ToolbarItemConfig[] = [
  { id: 'bold', label: 'B', ariaLabel: 'Bold', title: 'Bold (Ctrl+B)' },
  { id: 'italic', label: 'I', ariaLabel: 'Italic', title: 'Italic (Ctrl+I)' },
  { id: 'heading', label: 'H', ariaLabel: 'Heading', title: 'Cycle Headings (H1-H3)' },
  { id: 'link', label: 'Link', ariaLabel: 'Insert Link', title: 'Insert Link' },
  { id: 'image', label: 'Img', ariaLabel: 'Insert Image', title: 'Insert Image' },
  { id: 'ul', label: 'UL', ariaLabel: 'Unordered List', title: 'Unordered List' },
  { id: 'ol', label: 'OL', ariaLabel: 'Ordered List', title: 'Ordered List' },
  { id: 'blockquote', label: '“ ”', ariaLabel: 'Blockquote', title: 'Blockquote' },
  { id: 'code', label: '`Code`', ariaLabel: 'Inline Code', title: 'Inline Code' },
  { id: 'codeblock', label: '```', ariaLabel: 'Code Block', title: 'Code Block' },
];

interface ToolbarItemWithAction extends ToolbarItemConfig {
  action: () => void;
}

interface EditorPaneProps {
  title: string;
  markdown: string;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  toolbarItems: ToolbarItemWithAction[];
  onClearEditor: () => void;
}

const EditorPaneComponent: React.FC<EditorPaneProps> = React.memo(({ title, markdown, onInputChange, textareaRef, toolbarItems, onClearEditor }) => (
  <section className="flex flex-col w-1/2 bg-white rounded-xl shadow-2xl border border-gray-300">
    <div className="p-3 bg-gray-200 rounded-t-xl border-b border-gray-300 flex justify-between items-center relative">
      <h2 className="text-lg font-semibold text-gray-700">{title}</h2>
      <button
          onClick={onClearEditor}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md text-sm shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
          aria-label={`Clear ${title} content`}
      >
          Empty
      </button>
    </div>
    <div className="bg-gray-200 p-2 flex flex-wrap gap-1 border-b border-gray-300">
      {toolbarItems.map(item => (
        <button
          key={item.id}
          onClick={item.action}
          title={item.title || item.label}
          aria-label={item.ariaLabel}
          className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-mono py-1 px-2.5 rounded text-xs sm:text-sm shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-sky-500 focus:ring-opacity-75"
        >
          {item.label}
        </button>
      ))}
    </div>
    <textarea
      ref={textareaRef}
      value={markdown}
      onChange={onInputChange}
      className="flex-1 p-4 bg-white text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 rounded-b-xl custom-scrollbar custom-scrollbar-firefox leading-relaxed text-sm sm:text-base"
      placeholder="Enter your Markdown here..."
      spellCheck="false"
      aria-label={`${title} Input Area`}
    />
  </section>
));
EditorPaneComponent.displayName = 'EditorPaneComponent';


const App: React.FC = () => {
  // Left Editor State (Markdown Editor)
  const [leftMarkdown, setLeftMarkdown] = useState<string>(getMarkdownFromURL);
  const leftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [leftDesiredSelectionStart, setLeftDesiredSelectionStart] = useState<number | null>(null);
  const [leftDesiredSelectionEnd, setLeftDesiredSelectionEnd] = useState<number | null>(null);

  // Document Preview State
  const [documentOutput, setDocumentOutput] = useState<string>('');
  const [copyPreviewFeedback, setCopyPreviewFeedback] = useState<string>('');

  const [shareLinkFeedback, setShareLinkFeedback] = useState<string>('');
  const [loadFileFeedback, setLoadFileFeedback] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configure marked on component mount
  useEffect(() => {
    if (window.hljs) {
        marked.setOptions({
            gfm: true,
            breaks: true,
            pedantic: false,
            highlight: function(code: string, lang: string): string {
                const language = lang && window.hljs.getLanguage(lang) ? lang : 'plaintext';
                return window.hljs.highlight(code, { language, ignoreIllegals: true }).value;
            }
        } as AppMarkedOptions);
    } else {
         marked.setOptions({
            gfm: true,
            breaks: true,
            pedantic: false,
        } as AppMarkedOptions);
        console.warn("highlight.js not available for syntax highlighting.");
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to update document preview when leftMarkdown changes (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDocumentOutput(marked.parse(leftMarkdown) as string);
    }, 250); // Debounce time in milliseconds

    return () => {
      clearTimeout(handler);
    };
  }, [leftMarkdown]);


  // Effect for left editor cursor position (after toolbar actions)
  useEffect(() => {
    if (leftTextareaRef.current && leftDesiredSelectionStart !== null && leftDesiredSelectionEnd !== null) {
      const textarea = leftTextareaRef.current;
      const scrollTop = textarea.scrollTop;
      const scrollLeft = textarea.scrollLeft;

      textarea.focus();
      textarea.setSelectionRange(leftDesiredSelectionStart, leftDesiredSelectionEnd);
      
      textarea.scrollTop = scrollTop;
      textarea.scrollLeft = scrollLeft;

      setLeftDesiredSelectionStart(null);
      setLeftDesiredSelectionEnd(null);
    }
  }, [leftDesiredSelectionStart, leftDesiredSelectionEnd]); // Runs only when desired selection changes

  const handleLeftInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLeftMarkdown(event.target.value);
  }, [setLeftMarkdown]);

  const handleShareLink = async () => {
    if (!leftMarkdown.trim()) {
      setShareLinkFeedback('Editor is empty!');
      setTimeout(() => setShareLinkFeedback(''), 2000);
      return;
    }
    const encodedMarkdown = encodeURIComponent(leftMarkdown);
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = `${baseUrl}?md=${encodedMarkdown}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareLinkFeedback('Link copied!');
    } catch (err) {
      console.error('Failed to copy link: ', err);
      setShareLinkFeedback('Failed to copy!');
    }
    setTimeout(() => setShareLinkFeedback(''), 3000);
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) { // Always reset the input value to allow re-selection of the same file
        fileInputRef.current.value = '';
    }
    if (!file) {
      return;
    }

    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown') && file.type !== 'text/markdown') {
        setLoadFileFeedback('Invalid file type. Please select a .md file.');
        setTimeout(() => setLoadFileFeedback(''), 3000);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setLeftMarkdown(text);
        setLoadFileFeedback('File loaded successfully!');
      } else {
        setLoadFileFeedback('Failed to read file content.');
      }
      setTimeout(() => setLoadFileFeedback(''), 3000);
    };
    reader.onerror = () => {
      setLoadFileFeedback('Error reading file.');
      setTimeout(() => setLoadFileFeedback(''), 3000);
    };
    reader.readAsText(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };


  const handleClearLeftEditor = useCallback(() => {
    setLeftMarkdown('');
    if (leftTextareaRef.current) {
        leftTextareaRef.current.focus();
    }
  }, [setLeftMarkdown, leftTextareaRef]);

  const handleCopyPreviewContent = async () => {
    const trimmedDocumentOutput = documentOutput.trim();
    if (!trimmedDocumentOutput) {
        setCopyPreviewFeedback('Preview is empty!');
        setTimeout(() => setCopyPreviewFeedback(''), 2000);
        return;
    }
    try {
        if (navigator.clipboard && navigator.clipboard.write) {
            const htmlBlob = new Blob([documentOutput], { type: 'text/html' });
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = documentOutput;
            const plainText = tempDiv.textContent || tempDiv.innerText || documentOutput;
            const textBlob = new Blob([plainText], { type: 'text/plain' });

            const clipboardItem = new ClipboardItem({
                'text/html': htmlBlob,
                'text/plain': textBlob,
            });
            await navigator.clipboard.write([clipboardItem]);
            setCopyPreviewFeedback('Content copied!');
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(documentOutput);
            setCopyPreviewFeedback('Content copied (as HTML text)!');
        } else {
            throw new Error('Clipboard API not fully supported');
        }
    } catch (err) {
      console.error('Failed to copy content: ', err);
      setCopyPreviewFeedback('Failed to copy content!');
    }
    setTimeout(() => setCopyPreviewFeedback(''), 3000);
  };


  const createToolbarActions = (
    textareaRef: React.RefObject<HTMLTextAreaElement>,
    setMarkdown: React.Dispatch<React.SetStateAction<string>>,
    setDesiredSelectionStart: React.Dispatch<React.SetStateAction<number | null>>,
    setDesiredSelectionEnd: React.Dispatch<React.SetStateAction<number | null>>
  ) => {
    const insertTextAroundSelection = (prefix: string, suffix: string, defaultText: string = '') => {
      if (!textareaRef.current) return;
      const { selectionStart, selectionEnd, value } = textareaRef.current;
      const selectedText = value.substring(selectionStart, selectionEnd);
      let newText;
      let newSelStart;
      let newSelEnd;

      if (selectedText) {
        newText = `${value.substring(0, selectionStart)}${prefix}${selectedText}${suffix}${value.substring(selectionEnd)}`;
        newSelStart = selectionStart + prefix.length;
        newSelEnd = newSelStart + selectedText.length;
      } else {
        newText = `${value.substring(0, selectionStart)}${prefix}${defaultText}${suffix}${value.substring(selectionEnd)}`;
        newSelStart = selectionStart + prefix.length;
        newSelEnd = newSelStart + defaultText.length;
      }

      setMarkdown(newText); // This will trigger a re-render
      // The selection effect will pick up these desired values in the next render cycle
      setDesiredSelectionStart(newSelStart);
      setDesiredSelectionEnd(newSelEnd);
    };

    const modifySelectedLines = (action: 'heading' | 'ul' | 'ol' | 'blockquote') => {
      if (!textareaRef.current) return;
      const { selectionStart, selectionEnd, value } = textareaRef.current;
      const lines = value.split('\n');
      let currentLineStart = 0;
      let startLineIndex = -1, endLineIndex = -1;

      for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i].length + 1; // +1 for newline character
          if (selectionStart >= currentLineStart && selectionStart < currentLineStart + lineLength) startLineIndex = i;
          if (selectionEnd > currentLineStart && selectionEnd <= currentLineStart + lineLength) endLineIndex = i;
          if (selectionEnd === currentLineStart && selectionEnd > 0) endLineIndex = i -1;

          if (startLineIndex !== -1 && endLineIndex !== -1) break;
          currentLineStart += lineLength;
      }
      
      if (startLineIndex === -1 && selectionStart === value.length && lines.length > 0) startLineIndex = lines.length -1;
      else if (startLineIndex === -1 ) startLineIndex = 0;

      if (endLineIndex === -1 && selectionEnd === value.length && lines.length > 0) endLineIndex = lines.length -1;
      else if (endLineIndex === -1) endLineIndex = startLineIndex;


      let firstModifiedLinePrefixLengthChange = 0;

      const modifiedLines = lines.map((line, index) => {
          if (index >= startLineIndex && index <= endLineIndex) {
              let prefixLengthChange = 0;
              let modifiedLine = line;

              if (action === 'heading') {
                  if (line.startsWith('### ')) { modifiedLine = line.substring(4); prefixLengthChange = -4;}
                  else if (line.startsWith('## ')) { modifiedLine = '### ' + line.substring(3); prefixLengthChange = 1;}
                  else if (line.startsWith('# ')) { modifiedLine = '## ' + line.substring(2); prefixLengthChange = 1;}
                  else { modifiedLine = '# ' + line; prefixLengthChange = 2;}
              } else if (action === 'ul') {
                  const match = line.match(/^\s*-\s+/);
                  if (match) { modifiedLine = line.substring(match[0].length); prefixLengthChange = -match[0].length; }
                  else { modifiedLine = '- ' + line; prefixLengthChange = 2; }
              } else if (action === 'ol') {
                  const olMatch = line.match(/^\s*(\d+)\.\s+/);
                  if (olMatch) { modifiedLine = line.substring(olMatch[0].length); prefixLengthChange = -olMatch[0].length; }
                  else {
                      modifiedLine = `1. ${line}`; prefixLengthChange = 3;
                  }
              } else if (action === 'blockquote') {
                  if (line.startsWith('> ')) { modifiedLine = line.substring(2); prefixLengthChange = -2; }
                  else { modifiedLine = '> ' + line; prefixLengthChange = 2; }
              }
              if (index === startLineIndex) firstModifiedLinePrefixLengthChange = prefixLengthChange;
              return modifiedLine;
          }
          return line;
      });

      if (action === 'ol') {
          let currentOlNumber = 1;
          let inOlBlockStartedBySelection = false;
          let selectionLinesWereOl = true; 
          for(let i=startLineIndex; i<=endLineIndex; i++){
            if(!lines[i].match(/^\s*(\d+)\.\s+/)){
                selectionLinesWereOl = false;
                break;
            }
          }

          for (let i = 0; i < modifiedLines.length; i++) {
              const currentLineIsNowOl = modifiedLines[i].match(/^\s*1\.\s+/) && !selectionLinesWereOl && (i >= startLineIndex && i <= endLineIndex);
              const existingOlItem = modifiedLines[i].match(/^\s*(\d+)\.\s+/);

              if (i >= startLineIndex && i <= endLineIndex) { // Within selected lines
                  if (currentLineIsNowOl) { // Line was just converted to an OL item
                      if (!inOlBlockStartedBySelection) {
                          inOlBlockStartedBySelection = true;
                          currentOlNumber = 1;
                      }
                      const lineContent = modifiedLines[i].substring(modifiedLines[i].indexOf('.') + 2);
                      modifiedLines[i] = `${currentOlNumber}. ${lineContent}`;
                      currentOlNumber++;
                  } else if (!existingOlItem) { // Line is not OL, or was de-OL'd
                      inOlBlockStartedBySelection = false;
                  } else if (existingOlItem && inOlBlockStartedBySelection) { // Line was already OL and is part of current renumbering
                      const lineContent = modifiedLines[i].substring(modifiedLines[i].indexOf('.') + 2);
                      modifiedLines[i] = `${currentOlNumber}. ${lineContent}`;
                      currentOlNumber++;
                  } else if (existingOlItem && !inOlBlockStartedBySelection) { // Encountered an existing OL item, start numbering from it
                      inOlBlockStartedBySelection = true;
                      currentOlNumber = parseInt(existingOlItem[1], 10);
                      currentOlNumber++;
                  }
              } else { // Lines outside the selection
                  if (inOlBlockStartedBySelection && existingOlItem) { // Renumber subsequent list items if they exist and are part of the flow
                     const lineContent = modifiedLines[i].substring(modifiedLines[i].indexOf('.') + 2);
                     modifiedLines[i] = `${currentOlNumber}. ${lineContent}`;
                     currentOlNumber++;
                  } else if (existingOlItem) { // Existing OL item outside selection, not part of current flow
                    inOlBlockStartedBySelection = false; 
                    // currentOlNumber will naturally be correct if this is a new list later, or reset
                  } else { // Non-OL line, break any renumbering sequence from selection
                    inOlBlockStartedBySelection = false;
                  }
              }
          }
      }

      const newMarkdown = modifiedLines.join('\n');
      setMarkdown(newMarkdown);

      const newCursorPos = Math.max(0, selectionStart + firstModifiedLinePrefixLengthChange);
      
      let totalLengthChangeInSelection = 0;
      for (let i = startLineIndex; i <= endLineIndex; i++) {
        totalLengthChangeInSelection += (modifiedLines[i].length - lines[i].length);
      }

      setDesiredSelectionStart(newCursorPos);
      setDesiredSelectionEnd(Math.max(newCursorPos, selectionEnd + totalLengthChangeInSelection));
    };

    const insertCodeBlock = () => {
      if (!textareaRef.current) return;
      const { selectionStart, value } = textareaRef.current;
      const codeBlock = "\n```language\ncode here\n```\n";
      const newText = value.substring(0, selectionStart) + codeBlock + value.substring(selectionStart);
      setMarkdown(newText);
      const newCursorPos = selectionStart + codeBlock.indexOf('code here');
      setDesiredSelectionStart(newCursorPos);
      setDesiredSelectionEnd(newCursorPos + 'code here'.length);
    };

    return { insertTextAroundSelection, modifySelectedLines, insertCodeBlock };
  };
  
  const createToolbarItems = (
        actions: ReturnType<typeof createToolbarActions>,
        config: ToolbarItemConfig[] // Renamed from toolbarConfig to avoid conflict
    ): ToolbarItemWithAction[] => {
    return config.map(item => {
      let actionFunc: () => void;
      switch (item.id) {
        case 'bold': actionFunc = () => actions.insertTextAroundSelection('**', '**', 'bold text'); break;
        case 'italic': actionFunc = () => actions.insertTextAroundSelection('*', '*', 'italic text'); break;
        case 'heading': actionFunc = () => actions.modifySelectedLines('heading'); break;
        case 'link': actionFunc = () => {
          const url = prompt('Enter link URL:', 'https://');
          if (url) actions.insertTextAroundSelection('[', `](${url})`, 'link text');
        }; break;
        case 'image': actionFunc = () => {
          const url = prompt('Enter image URL:', 'https://');
          if (url) {
            const alt = prompt('Enter alt text:', 'image');
            actions.insertTextAroundSelection(`![${alt || 'image'}]`, `(${url})`, '');
          }
        }; break;
        case 'ul': actionFunc = () => actions.modifySelectedLines('ul'); break;
        case 'ol': actionFunc = () => actions.modifySelectedLines('ol'); break;
        case 'blockquote': actionFunc = () => actions.modifySelectedLines('blockquote'); break;
        case 'code': actionFunc = () => actions.insertTextAroundSelection('`', '`', 'inline code'); break;
        case 'codeblock': actionFunc = actions.insertCodeBlock; break;
        default: actionFunc = () => console.warn(`Unknown toolbar item: ${item.id}`);
      }
      return { ...item, action: actionFunc };
    });
  };

  const leftToolbarActions = useMemo(() => createToolbarActions(
    leftTextareaRef,
    setLeftMarkdown,
    setLeftDesiredSelectionStart,
    setLeftDesiredSelectionEnd
  ), [leftTextareaRef, setLeftMarkdown, setLeftDesiredSelectionStart, setLeftDesiredSelectionEnd]);
  
  const leftToolbarItems = useMemo(() => createToolbarItems(leftToolbarActions, commonToolbarConfig), [leftToolbarActions]); // commonToolbarConfig is stable


  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-800 font-sans antialiased"> {/* Main background and text color */}
      <header className="bg-white p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center border-b border-gray-200"> {/* Header styles */}
        <h1 className="text-3xl font-bold text-sky-600 tracking-tight"> {/* Title color */}
          Markdown Editor & Document Preview
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={triggerFileInput}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75"
              aria-label="Load Markdown file from disk"
            >
              Load File
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept=".md,.markdown,text/markdown"
              className="hidden"
              aria-hidden="true"
            />
            {loadFileFeedback && (
              <span
                className={`absolute -bottom-7 left-0 text-xs text-white px-2 py-1 rounded shadow-lg transition-all duration-300 ease-in-out ${
                  loadFileFeedback.startsWith('Failed') || loadFileFeedback.startsWith('Error') || loadFileFeedback.startsWith('Invalid') ? 'bg-red-500' : 'bg-green-500'
                }`}
                role="status"
                aria-live="polite"
              >
                {loadFileFeedback}
              </span>
            )}
          </div>
          <div className="relative">
            <button
              onClick={handleShareLink}
              className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
              aria-label="Copy shareable link for Editor to clipboard"
            >
              Share Link
            </button>
            {shareLinkFeedback && (
              <span
                className={`absolute -bottom-7 right-0 text-xs text-white px-2 py-1 rounded shadow-lg transition-all duration-300 ease-in-out ${
                  shareLinkFeedback.startsWith('Failed') || shareLinkFeedback.startsWith('Editor is empty') ? 'bg-red-500' : 'bg-green-500'
                }`}
                role="status"
                aria-live="polite"
              >
                {shareLinkFeedback}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-row overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
        <EditorPaneComponent
          title="Markdown Editor"
          markdown={leftMarkdown}
          onInputChange={handleLeftInputChange}
          textareaRef={leftTextareaRef}
          toolbarItems={leftToolbarItems}
          onClearEditor={handleClearLeftEditor}
        />
        <section className="flex flex-col w-1/2 bg-white rounded-xl shadow-2xl border border-gray-300"> {/* Preview pane styles */}
            <div className="p-3 bg-gray-200 rounded-t-xl border-b border-gray-300 flex justify-between items-center relative"> {/* Preview header */}
                <h2 className="text-lg font-semibold text-gray-700">Document Preview</h2>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={handleCopyPreviewContent}
                        className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-1 px-3 rounded-md text-sm shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
                        aria-label="Copy content from Document Preview to clipboard"
                    >
                        Copy Content
                    </button>
                    {/* The "Empty" button previously here has been removed for simplicity */}
                </div>
                {copyPreviewFeedback && (
                    <span
                        className={`absolute -bottom-6 right-0 text-xs text-white px-2 py-1 rounded shadow-lg transition-all duration-300 ease-in-out ${
                        copyPreviewFeedback.startsWith('Failed') || copyPreviewFeedback.startsWith('Preview is empty') ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        role="status"
                        aria-live="polite"
                    >
                        {copyPreviewFeedback}
                    </span>
                )}
            </div>
            <div
                className="flex-1 p-4 bg-white text-gray-800 rounded-b-xl overflow-y-auto custom-scrollbar custom-scrollbar-firefox prose-preview leading-relaxed text-sm sm:text-base" /* Preview content area */
                dangerouslySetInnerHTML={{ __html: documentOutput }}
                aria-live="polite"
                aria-label="Document Preview Area"
            />
        </section>
      </main>

      <footer className="bg-gray-200 p-3 text-center text-xs sm:text-sm text-gray-600 border-t border-gray-300"> {/* Footer styles */}
        Markdown Editor with Live Document Preview. Powered by React, Tailwind CSS, Marked.js, and Highlight.js.
      </footer>
    </div>
  );
};

export default App;
