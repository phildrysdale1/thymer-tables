/**
 * Thymer Table Plugin
 *
 * version 0.0.1
 * 
 * Renders tables in Thymer code blocks.
 * 
 * HOW TO USE:
 * 1. Press Ctrl+P or Cmd+P
 * 2. Type "code block" and select it
 * 3. Type your table using pipe separators:
 * 
 *    Name | Age | City
 *    Alice | 30 | NYC
 *    Bob | 25 | LA
 * 
 * 4. Click outside the code block - table renders!
 * 5. Click the table to edit it again
 */

class Plugin extends AppPlugin {

    onLoad() {
        console.log('[Table Plugin] Loading SAFE version...');
        
        // Flag to prevent infinite loops
        this.isUpdating = false;
        
        // Inject CSS for table styling
        this.injectTableStyles();
        
        // Start observing for code blocks
        this.startTableObserver();
        
        console.log('[Table Plugin] Loaded - click tables to edit');
    }

    onUnload() {
        console.log('[Table Plugin] Unloading...');
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler);
        }
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler, true);
        }
    }

    injectTableStyles() {
        this.ui.injectCSS(`
            /* Table Plugin Styles */
            
            /* Code blocks with tables hide their normal content */
            .listitem-block.has-table-render:not(.editing) > *:not(.thymer-table-wrapper) {
                display: none !important;
            }
            
            /* When editing, hide table and show code */
            .listitem-block.has-table-render.editing .thymer-table-wrapper {
                display: none !important;
            }
            
            /* Table wrapper positioning */
            .thymer-table-wrapper {
                position: relative;
                cursor: pointer;
                margin: 0;
                padding: 0;
            }
            
            .thymer-table-wrapper:hover {
                opacity: 0.95;
            }
            
            .thymer-table-wrapper:hover .thymer-table-edit-hint {
                opacity: 1;
            }
            
            /* Edit hint */
            .thymer-table-edit-hint {
                position: absolute;
                top: 8px;
                right: 8px;
                background: var(--bg-surface, #2d2d2d);
                border: 1px solid var(--border-default, #3d3d3d);
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                color: var(--text-muted, #888);
                opacity: 0;
                transition: opacity 0.2s;
                pointer-events: none;
                z-index: 10;
            }
            
            body:not(.dark) .thymer-table-edit-hint {
                background: #f5f5f5;
                border-color: #ddd;
                color: #666;
            }
            
            /* Table container */
            .thymer-table-container {
                overflow-x: auto;
                border-radius: 8px;
                border: 1px solid var(--border-default, #3d3d3d);
                background: var(--bg-default, #1e1e1e);
            }

            /* Table */
            .thymer-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
                font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
                margin: 0;
            }

            .thymer-table th,
            .thymer-table td {
                padding: 10px 14px;
                text-align: left;
                border-bottom: 1px solid var(--border-default, #3d3d3d);
            }

            .thymer-table th {
                background-color: var(--bg-surface, #2d2d2d);
                font-weight: 600;
                color: var(--text-default, #e0e0e0);
                border-bottom: 2px solid var(--border-strong, #4d4d4d);
                position: sticky;
                top: 0;
                z-index: 1;
            }

            .thymer-table td {
                color: var(--text-default, #e0e0e0);
            }

            .thymer-table tbody tr:hover {
                background-color: var(--bg-hover, rgba(255, 255, 255, 0.05));
            }

            .thymer-table tbody tr:nth-child(even) {
                background-color: var(--bg-surface, rgba(255, 255, 255, 0.02));
            }

            .thymer-table tbody tr:last-child td {
                border-bottom: none;
            }

            /* Light mode overrides */
            body:not(.dark) .thymer-table-container {
                border-color: #ddd;
                background: #fff;
            }

            body:not(.dark) .thymer-table th,
            body:not(.dark) .thymer-table td {
                border-color: #ddd;
            }

            body:not(.dark) .thymer-table th {
                background-color: #f5f5f5;
                color: #333;
                border-bottom-color: #ccc;
            }

            body:not(.dark) .thymer-table td {
                color: #333;
            }

            body:not(.dark) .thymer-table tbody tr:hover {
                background-color: rgba(0, 0, 0, 0.03);
            }

            body:not(.dark) .thymer-table tbody tr:nth-child(even) {
                background-color: rgba(0, 0, 0, 0.02);
            }
        `);
    }

    startTableObserver() {
        // Set up click handler for editing tables
        this.clickHandler = (e) => {
            const block = e.target.closest('.listitem-block.has-table-render');
            if (block && !block.classList.contains('editing')) {
                this.editTable(block);
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener('click', this.clickHandler, true);
        
        // Set up keyboard navigation handler
        this.keydownHandler = (e) => {
            // Only handle arrow up/down
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            
            // Find all table blocks
            const tableBlocks = document.querySelectorAll('.listitem-block.has-table-render:not(.editing)');
            if (tableBlocks.length === 0) return;
            
            // Get current selection/cursor position
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const cursorNode = range.startContainer.nodeType === Node.TEXT_NODE 
                ? range.startContainer.parentElement 
                : range.startContainer;
            
            // Find the current line item
            const currentLine = cursorNode.closest('.listitem, .listitem-text, .listitem-task, .listitem-heading');
            if (!currentLine) return;
            
            // Check if we're trying to navigate into a table block
            for (const block of tableBlocks) {
                let shouldEnterEdit = false;
                
                if (e.key === 'ArrowDown') {
                    // Check if table block is immediately after current line
                    const nextSibling = currentLine.nextElementSibling;
                    if (nextSibling === block || (nextSibling && nextSibling.contains(block))) {
                        shouldEnterEdit = true;
                    }
                } else if (e.key === 'ArrowUp') {
                    // Check if table block is immediately before current line
                    const prevSibling = currentLine.previousElementSibling;
                    if (prevSibling === block || (prevSibling && prevSibling.contains(block))) {
                        shouldEnterEdit = true;
                    }
                }
                
                if (shouldEnterEdit) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.editTable(block);
                    
                    // Focus the first/last editable element depending on direction
                    setTimeout(() => {
                        const editables = block.querySelectorAll('.listitem-text, [contenteditable]');
                        if (editables.length > 0) {
                            const target = e.key === 'ArrowDown' ? editables[0] : editables[editables.length - 1];
                            target.focus();
                            
                            // Place cursor at start/end
                            const textRange = document.createRange();
                            const sel = window.getSelection();
                            if (target.firstChild) {
                                if (e.key === 'ArrowDown') {
                                    textRange.setStart(target.firstChild, 0);
                                } else {
                                    const lastNode = target.lastChild;
                                    const offset = lastNode.nodeType === Node.TEXT_NODE ? lastNode.length : 0;
                                    textRange.setStart(lastNode, offset);
                                }
                                textRange.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(textRange);
                            }
                        }
                    }, 10);
                    
                    return;
                }
            }
        };
        document.addEventListener('keydown', this.keydownHandler, true);
        
        // Process existing code blocks on load
        this.processExistingCodeBlocks();

        // Watch ONLY for new nodes being added - NO characterData watching!
        this.observer = new MutationObserver((mutations) => {
            // Skip if we're currently updating to prevent loops
            if (this.isUpdating) return;
            
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.processNode(node);
                    }
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
            // NO characterData! This was causing the infinite loop
        });
        
        console.log('[Table Plugin] Observer started (safe mode with keyboard nav)');
    }
    
    editTable(block) {
        // Show code block content, hide table
        block.classList.add('editing');
        
        // Focus on the code block if possible
        const focusable = block.querySelector('input, textarea, [contenteditable]');
        if (focusable) {
            setTimeout(() => focusable.focus(), 50);
        }
        
        // Set up handlers to exit edit mode
        const handleOutsideClick = (e) => {
            if (!block.contains(e.target)) {
                exitEditMode();
            }
        };
        
        const handleKeyDown = (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            
            // Check if we're at the boundary of the code block
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const cursorNode = range.startContainer.nodeType === Node.TEXT_NODE 
                ? range.startContainer.parentElement 
                : range.startContainer;
            
            if (!block.contains(cursorNode)) return;
            
            // Get all editable lines in the block
            const editables = Array.from(block.querySelectorAll('.listitem-text, [contenteditable]'));
            const currentIdx = editables.findIndex(el => el.contains(cursorNode));
            
            // Check if trying to go up from first line or down from last line
            if ((e.key === 'ArrowUp' && currentIdx === 0) ||
                (e.key === 'ArrowDown' && currentIdx === editables.length - 1)) {
                // Let the navigation happen, then exit edit mode
                setTimeout(() => {
                    const newSelection = window.getSelection();
                    if (newSelection.rangeCount) {
                        const newNode = newSelection.getRangeAt(0).startContainer.nodeType === Node.TEXT_NODE
                            ? newSelection.getRangeAt(0).startContainer.parentElement
                            : newSelection.getRangeAt(0).startContainer;
                        
                        // If cursor moved outside the block, exit edit mode
                        if (!block.contains(newNode)) {
                            exitEditMode();
                        }
                    }
                }, 10);
            }
        };
        
        const exitEditMode = () => {
            this.updateCodeBlock(block);
            block.classList.remove('editing');
            document.removeEventListener('click', handleOutsideClick, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
        
        // Add handlers after a short delay to avoid immediate re-trigger
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick, true);
            document.addEventListener('keydown', handleKeyDown, true);
        }, 100);
    }
    
    updateCodeBlock(block) {
        // CRITICAL: Set flag to prevent infinite loops
        if (this.isUpdating) return;
        this.isUpdating = true;
        
        try {
            // Extract text content
            const text = this.extractCodeBlockText(block);
            
            // Check if content looks like a table
            const hasTableSyntax = text && text.includes('|') && text.split('\n').filter(l => l.includes('|')).length >= 2;
            
            if (!hasTableSyntax) {
                // Remove table if it exists
                const wrapper = block.querySelector('.thymer-table-wrapper');
                if (wrapper) {
                    wrapper.remove();
                }
                block.classList.remove('has-table-render');
                return;
            }
            
            // Parse and render table
            const tableHTML = this.parseTable(text);
            if (!tableHTML) {
                return;
            }
            
            // Find or create wrapper inside the code block
            let wrapper = block.querySelector('.thymer-table-wrapper');
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'thymer-table-wrapper';
                
                const editHint = document.createElement('div');
                editHint.className = 'thymer-table-edit-hint';
                editHint.textContent = 'Click to edit';
                
                const container = document.createElement('div');
                container.className = 'thymer-table-container';
                
                wrapper.appendChild(editHint);
                wrapper.appendChild(container);
                
                // Append to code block
                block.appendChild(wrapper);
                block.classList.add('has-table-render');
            }
            
            // Update table content
            const container = wrapper.querySelector('.thymer-table-container');
            if (container) {
                container.innerHTML = tableHTML;
            }
        } finally {
            // CRITICAL: Always clear the flag
            this.isUpdating = false;
        }
    }

    processExistingCodeBlocks() {
        const codeBlocks = document.querySelectorAll('.listitem-block, .block-code, [data-type="block"]');
        console.log(`[Table Plugin] Found ${codeBlocks.length} existing code blocks`);
        
        codeBlocks.forEach(block => {
            this.processCodeBlock(block);
        });
    }

    processNode(node) {
        if (node.classList && (
            node.classList.contains('listitem-block') ||
            node.classList.contains('block-code') ||
            node.dataset.type === 'block'
        )) {
            this.processCodeBlock(node);
        }
        
        if (node.querySelectorAll) {
            const blocks = node.querySelectorAll('.listitem-block, .block-code, [data-type="block"]');
            blocks.forEach(block => this.processCodeBlock(block));
        }
    }

    processCodeBlock(blockElement) {
        // Skip if currently editing
        if (blockElement.classList.contains('editing')) {
            return;
        }
        
        this.updateCodeBlock(blockElement);
    }

    extractCodeBlockText(blockElement) {
        // Try multiple strategies to extract text from code block
        
        // Strategy 1: Look for text in .listitem children
        const textItems = blockElement.querySelectorAll('.listitem-text, .listitem');
        if (textItems.length > 0) {
            const lines = [];
            textItems.forEach(item => {
                const text = item.textContent?.trim();
                if (text) lines.push(text);
            });
            if (lines.length > 0) {
                return lines.join('\n');
            }
        }
        
        // Strategy 2: Direct textContent
        if (blockElement.textContent) {
            return blockElement.textContent;
        }
        
        // Strategy 3: Look for code elements
        const codeEl = blockElement.querySelector('code');
        if (codeEl && codeEl.textContent) {
            return codeEl.textContent;
        }
        
        return null;
    }

    parseTable(content) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        
        if (lines.length < 2) {
            return null;
        }

        let headerRow = null;
        let dataRows = [];

        // Check if second row is a separator (---)
        if (lines[1].match(/^[\s\-|:]+$/)) {
            headerRow = lines[0];
            dataRows = lines.slice(2);
        } else {
            headerRow = lines[0];
            dataRows = lines.slice(1);
        }

        // Parse header
        const headers = this.parseRow(headerRow);
        if (!headers || headers.length === 0) {
            return null;
        }

        // Parse data rows
        const rows = dataRows.map(row => this.parseRow(row)).filter(r => r && r.length > 0);

        // Build HTML
        let html = '<table class="thymer-table">';
        
        // Header
        html += '<thead><tr>';
        headers.forEach(header => {
            html += `<th>${this.escapeHtml(header)}</th>`;
        });
        html += '</tr></thead>';

        // Body
        html += '<tbody>';
        rows.forEach(row => {
            html += '<tr>';
            for (let i = 0; i < headers.length; i++) {
                const cell = row[i] || '';
                html += `<td>${this.escapeHtml(cell)}</td>`;
            }
            html += '</tr>';
        });
        html += '</tbody>';

        html += '</table>';
        return html;
    }

    parseRow(rowText) {
        const cells = rowText.split('|').map(cell => cell.trim());
        
        if (cells.length > 0 && cells[0] === '') {
            cells.shift();
        }
        if (cells.length > 0 && cells[cells.length - 1] === '') {
            cells.pop();
        }

        return cells;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
