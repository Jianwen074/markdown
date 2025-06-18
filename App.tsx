

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { marked, MarkedOptions } from 'marked'; // Import marked and MarkedOptions

// Declare hljs and ClipboardItem to inform TypeScript about global variables
declare global {
  interface Window {
    hljs: any;
    ClipboardItem?: any; // Declare ClipboardItem as potentially existing on window
  }
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
    const options: MarkedOptions & { highlight?: (code: string, lang: string) => string } = {
        gfm: true,
        breaks: true,
        pedantic: false,
    };

    if (window.hljs) {
        options.highlight = (code: string, lang: string): string => {
            const language = lang && window.hljs.getLanguage(lang) ? lang : 'plaintext';
            return window.hljs.highlight(code, { language, ignoreIllegals: true }).value;
        };
    } else {
        console.warn("highlight.js not available for syntax highlighting.");
    }
    marked.setOptions(options);
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
        if (navigator.clipboard) {
            if (window.ClipboardItem && navigator.clipboard.write) {
                const htmlBlob = new Blob([documentOutput], { type: 'text/html' });
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = documentOutput;
                const plainText = tempDiv.textContent || tempDiv.innerText || '';
                const textBlob = new Blob([plainText], { type: 'text/plain' });

                const item = new window.ClipboardItem({ 
                    'text/html': htmlBlob,
                    'text/plain': textBlob,
                });
                await navigator.clipboard.write([item]);
                setCopyPreviewFeedback('Copied as HTML & Text!');
            } 
            else if (navigator.clipboard.writeText) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = documentOutput;
                const plainText = tempDiv.textContent || tempDiv.innerText || documentOutput; 
                await navigator.clipboard.writeText(plainText);
                setCopyPreviewFeedback('Copied as Plain Text!');
            } else {
                throw new Error('Modern clipboard write methods not supported.');
            }
        } else {
            const textArea = document.createElement('textarea');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = documentOutput;
            textArea.value = tempDiv.textContent || tempDiv.innerText || documentOutput; 
            
            textArea.style.position = 'fixed'; 
            textArea.style.left = '-9999px';
            textArea.style.top = '0px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const success = document.execCommand('copy');
                if (!success) {
                    throw new Error('document.execCommand("copy") failed.');
                }
                setCopyPreviewFeedback('Copied (legacy method)!');
            } catch (execErr) {
                console.error('Legacy copy failed:', execErr);
                throw new Error('Clipboard API not available and legacy fallback failed.');
            } finally {
                document.body.removeChild(textArea);
            }
        }
    } catch (err) {
        console.error('Failed to copy content: ', err instanceof Error ? err.message : String(err));
        setCopyPreviewFeedback('Copy failed!');
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

      setMarkdown(newText); 
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
          const lineLength = lines[i].length + 1; 
          if (selectionStart >= currentLineStart && selectionStart < currentLineStart + lineLength) startLineIndex = i;
          if (selectionEnd > currentLineStart && selectionEnd <= currentLineStart + lineLength) endLineIndex = i;
          if (selectionEnd === currentLineStart && selectionEnd > 0 && i > 0) {
             endLineIndex = i - 1;
          }
          if (startLineIndex !== -1 && endLineIndex !== -1) break;
          currentLineStart += lineLength;
      }
      
      if (startLineIndex === -1 && selectionStart === value.length && lines.length > 0) startLineIndex = lines.length - 1;
      else if (startLineIndex === -1) startLineIndex = 0;


      if (endLineIndex === -1 && selectionEnd === value.length && lines.length > 0) endLineIndex = lines.length - 1;
      else if (endLineIndex === -1 && startLineIndex !== -1) endLineIndex = startLineIndex; // Ensure endLineIndex is at least startLineIndex
      else if (endLineIndex === -1) endLineIndex = 0;


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
          if (startLineIndex >= 0 && endLineIndex >=startLineIndex) { // Check valid range for lines access
            for(let i=startLineIndex; i<=endLineIndex; i++){
                if(i < lines.length && !lines[i].match(/^\s*(\d+)\.\s+/)){
                    selectionLinesWereOl = false;
                    break;
                } else if (i >= lines.length) { // Should not happen if indices are correct
                    selectionLinesWereOl = false; break;
                }
            }
          } else {
            selectionLinesWereOl = false; // Invalid range, assume not OL
          }


          for (let i = 0; i < modifiedLines.length; i++) {
              const currentLineIsNowOl = modifiedLines[i].match(/^\s*1\.\s+/) && !selectionLinesWereOl && (i >= startLineIndex && i <= endLineIndex);
              const existingOlItem = modifiedLines[i].match(/^\s*(\d+)\.\s+/);

              if (i >= startLineIndex && i <= endLineIndex) { 
                  if (currentLineIsNowOl) { 
                      if (!inOlBlockStartedBySelection) {
                          inOlBlockStartedBySelection = true;
                          currentOlNumber = 1;
                      }
                      const lineContent = modifiedLines[i].substring(modifiedLines[i].indexOf('.') + 2);
                      modifiedLines[i] = `${currentOlNumber}. ${lineContent}`;
                      currentOlNumber++;
                  } else if (!existingOlItem) { 
                      inOlBlockStartedBySelection = false;
                  } else if (existingOlItem && inOlBlockStartedBySelection) { 
                      const lineContent = modifiedLines[i].substring(modifiedLines[i].indexOf('.') + 2);
                      modifiedLines[i] = `${currentOlNumber}. ${lineContent}`;
                      currentOlNumber++;
                  } else if (existingOlItem && !inOlBlockStartedBySelection) { 
                      inOlBlockStartedBySelection = true;
                      currentOlNumber = parseInt(existingOlItem[1], 10);
                      currentOlNumber++;
                  }
              } else { 
                  if (inOlBlockStartedBySelection && existingOlItem) { 
                     const lineContent = modifiedLines[i].substring(modifiedLines[i].indexOf('.') + 2);
                     modifiedLines[i] = `${currentOlNumber}. ${lineContent}`;
                     currentOlNumber++;
                  } else if (existingOlItem) { 
                    inOlBlockStartedBySelection = false; 
                  } else { 
                    inOlBlockStartedBySelection = false;
                  }
              }
          }
      }

      const newMarkdown = modifiedLines.join('\n');
      setMarkdown(newMarkdown);

      const newCursorPos = Math.max(0, selectionStart + firstModifiedLinePrefixLengthChange);
      
      let totalLengthChangeInSelection = 0;
      if (startLineIndex >=0 && endLineIndex >= startLineIndex && endLineIndex < lines.length) { // Ensure indices are valid for lines & modifiedLines
        for (let i = startLineIndex; i <= endLineIndex; i++) {
            totalLengthChangeInSelection += (modifiedLines[i].length - lines[i].length);
        }
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
        config: ToolbarItemConfig[] 
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
  
  const leftToolbarItems = useMemo(() => createToolbarItems(leftToolbarActions, commonToolbarConfig), [leftToolbarActions]);


  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-800 font-sans antialiased">
      <header className="bg-white p-4 shadow-lg sticky top-0 z-10 flex justify-between items-center border-b border-gray-200">
        <h1 className="text-3xl font-bold text-sky-600 tracking-tight">
          Markdown Editor & Document Preview
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={triggerFileInput}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75"
              aria-label="Load Markdown File"
            >
              Load .md File
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              className="hidden"
              accept=".md,.markdown,text/markdown"
              aria-label="File input for Markdown"
            />
            {loadFileFeedback && (
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs bg-gray-700 text-white px-2 py-0.5 rounded-md shadow whitespace-nowrap z-20">
                {loadFileFeedback}
              </span>
            )}
          </div>

          <div className="relative">
            <button
              onClick={handleShareLink}
              className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
              aria-label="Share Link to Markdown Content"
            >
              Share Link
            </button>
            {shareLinkFeedback && (
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs bg-gray-700 text-white px-2 py-0.5 rounded-md shadow whitespace-nowrap z-20">
                {shareLinkFeedback}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex p-4 gap-4 overflow-hidden">
        <EditorPaneComponent
          title="Markdown Editor"
          markdown={leftMarkdown}
          onInputChange={handleLeftInputChange}
          textareaRef={leftTextareaRef}
          toolbarItems={leftToolbarItems}
          onClearEditor={handleClearLeftEditor}
        />
        
        <section className="flex flex-col w-1/2 bg-white rounded-xl shadow-2xl border border-gray-300 overflow-hidden">
          <div className="p-3 bg-gray-200 rounded-t-xl border-b border-gray-300 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-700">Document Preview</h2>
            <div className="relative">
              <button
                onClick={handleCopyPreviewContent}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-1 px-3 rounded-md text-sm shadow-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-opacity-75"
                aria-label="Copy Document Preview Content"
              >
                Copy Preview
              </button>
              {copyPreviewFeedback && (
                <span className="absolute -bottom-6 right-0 text-xs bg-gray-700 text-white px-2 py-0.5 rounded-md shadow whitespace-nowrap z-20">
                  {copyPreviewFeedback}
                </span>
              )}
            </div>
          </div>
          <div
            className="flex-1 p-4 overflow-auto custom-scrollbar custom-scrollbar-firefox prose-preview"
            dangerouslySetInnerHTML={{ __html: documentOutput }}
            aria-live="polite"
            aria-atomic="true"
            role="article" 
            aria-label="Formatted document preview"
          />
        </section>
      </main>
    </div>
  );
};

export default App;
