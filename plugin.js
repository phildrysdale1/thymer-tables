/**
 * Thymer Table Plugin
 * 
 * Renders pipe-separated tables in Thymer code blocks.
 * 
 * USAGE:
 * 1. Create a code block (Ctrl/Cmd + P → "code block")
 * 2. Type pipe-separated data:
 *    Name | Age | City
 *    Alice | 30 | NYC
 *    Bob | 25 | LA
 * 3. Click outside → table renders
 * 4. Click table → edit mode
 * 5. Click outside → re-renders
 * 
 * @author Phil (with Claude's help)
 * @version 1.0.0
 * @license MIT
 */

class Plugin extends AppPlugin {

    onLoad() {
        console.log('[Table Plugin] Loading...');
        
        // Flag to prevent infinite loops during DOM updates
        this.isUpdating = false;
        
        // Detect initial theme
        this.currentTheme = this.detectTheme();
        
        this.injectTableStyles();
        this.startTableObserver();
        
        // Watch for theme changes
        this.startThemeObserver();
        
        console.log(`[Table Plugin] Loaded successfully (${this.currentTheme} mode)`);
    }

    onUnload() {
        console.log('[Table Plugin] Unloading...');
        
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.themeObserver) {
            this.themeObserver.disconnect();
        }
        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler);
        }
    }

    /**
     * Detect if Thymer is in dark mode
     * Uses multiple detection methods for reliability
     * @returns {string} 'dark' or 'light'
     */
    detectTheme() {
        const body = document.body;
        
        // Method 1: Check for dark/dark-mode class
        if (body.classList.contains('dark') || body.classList.contains('dark-mode')) {
            return 'dark';
        }
        
        // Method 2: Check data-theme attribute
        if (body.dataset.theme === 'dark') {
            return 'dark';
        }
        
        // Method 3: Check computed background color luminance
        const bgColor = window.getComputedStyle(body).backgroundColor;
        if (bgColor) {
            const rgb = bgColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
                return luminance < 0.5 ? 'dark' : 'light';
            }
        }
        
        // Default to dark
        return 'dark';
    }

    /**
     * Get theme-specific colors
     * @returns {Object} Color palette for current theme
     */
    getThemeColors() {
        const isDark = this.currentTheme === 'dark';
        
        if (isDark) {
            return {
                containerBg: '#1e1e1e',
                containerBorder: '#3d3d3d',
                headerBg: '#2d2d2d',
                headerText: '#e0e0e0',
                headerBorder: '#4d4d4d',
                cellText: '#e0e0e0',
                cellBorder: '#3d3d3d',
                rowHover: 'rgba(255, 255, 255, 0.05)',
                rowAlt: 'rgba(255, 255, 255, 0.02)',
                hintBg: '#2d2d2d',
                hintBorder: '#3d3d3d',
                hintText: '#888'
            };
        } else {
            return {
                containerBg: '#ffffff',
                containerBorder: '#ddd',
                headerBg: '#f5f5f5',
                headerText: '#333',
                headerBorder: '#ccc',
                cellText: '#333',
                cellBorder: '#ddd',
                rowHover: 'rgba(0, 0, 0, 0.03)',
                rowAlt: 'rgba(0, 0, 0, 0.02)',
                hintBg: '#f5f5f5',
                hintBorder: '#ddd',
                hintText: '#666'
            };
        }
    }

    /**
     * Watch for theme changes and update tables
     */
    startThemeObserver() {
        this.themeObserver = new MutationObserver(() => {
            const newTheme = this.detectTheme();
            if (newTheme !== this.currentTheme) {
                console.log(`[Table Plugin] Theme changed: ${this.currentTheme} → ${newTheme}`);
                this.currentTheme = newTheme;
                this.updateAllTableThemes();
            }
        });

        this.themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['class', 'data-theme', 'style']
        });
        
        console.log('[Table Plugin] Theme observer started');
    }

    /**
     * Update theme for all existing tables
     */
    updateAllTableThemes() {
        const tables = document.querySelectorAll('.thymer-table-wrapper');
        console.log(`[Table Plugin] Updating ${tables.length} tables to ${this.currentTheme} mode`);
        tables.forEach(wrapper => {
            this.applyThemeToTable(wrapper);
        });
    }

    /**
     * Apply current theme colors to a table wrapper
     * @param {HTMLElement} wrapper - Table wrapper element
     */
    applyThemeToTable(wrapper) {
        const colors = this.getThemeColors();
        console.log(`[Table Plugin] Applying ${this.currentTheme} theme colors:`, colors);
        
        const container = wrapper.querySelector('.thymer-table-container');
        if (container) {
            container.style.setProperty('background-color', colors.containerBg, 'important');
            container.style.setProperty('border-color', colors.containerBorder, 'important');
        }
        
        const hint = wrapper.querySelector('.thymer-table-edit-hint');
        if (hint) {
            hint.style.setProperty('background-color', colors.hintBg, 'important');
            hint.style.setProperty('border-color', colors.hintBorder, 'important');
            hint.style.setProperty('color', colors.hintText, 'important');
        }
        
        const table = wrapper.querySelector('.thymer-table');
        if (!table) return;
        
        // Update header cells
        const headers = table.querySelectorAll('th');
        headers.forEach(th => {
            th.style.setProperty('background-color', colors.headerBg, 'important');
            th.style.setProperty('color', colors.headerText, 'important');
            th.style.setProperty('border-bottom-color', colors.headerBorder, 'important');
        });
        
        // Update all cells
        const cells = table.querySelectorAll('td');
        cells.forEach(td => {
            td.style.setProperty('color', colors.cellText, 'important');
            td.style.setProperty('border-bottom-color', colors.cellBorder, 'important');
        });
        
        // Update row backgrounds
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, idx) => {
            // Set base background
            if (idx % 2 === 1) {
                row.style.setProperty('background-color', colors.rowAlt, 'important');
            } else {
                row.style.removeProperty('background-color');
            }
            
            // Clear old handlers and add new ones
            const oldRow = row;
            const newRow = row.cloneNode(true);
            row.parentNode.replaceChild(newRow, row);
            
            newRow.addEventListener('mouseenter', () => {
                newRow.style.setProperty('background-color', colors.rowHover, 'important');
            });
            newRow.addEventListener('mouseleave', () => {
                if (idx % 2 === 1) {
                    newRow.style.setProperty('background-color', colors.rowAlt, 'important');
                } else {
                    newRow.style.removeProperty('background-color');
                }
            });
        });
    }

    /**
     * Inject CSS styles for table rendering
     * Colors are applied dynamically via JavaScript based on theme
     */
    injectTableStyles() {
        this.ui.injectCSS(`
            /* Hide code block children when showing table */
            .listitem-block.has-table-render:not(.editing) > *:not(.thymer-table-wrapper) {
                display: none !important;
            }
            
            /* When editing, hide table and show code */
            .listitem-block.has-table-render.editing .thymer-table-wrapper {
                display: none !important;
            }
            
            /* Table wrapper - clickable container */
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
            
            /* Edit hint that appears on hover */
            .thymer-table-edit-hint {
                position: absolute;
                top: 8px;
                right: 8px;
                border: 1px solid;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                opacity: 0;
                transition: opacity 0.2s;
                pointer-events: none;
                z-index: 10;
            }
            
            /* Table container with border and scrolling */
            .thymer-table-container {
                overflow-x: auto;
                border-radius: 8px;
                border: 1px solid;
            }

            /* Table styles */
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
                border-bottom: 1px solid;
            }

            .thymer-table th {
                font-weight: 600;
                border-bottom: 2px solid;
                position: sticky;
                top: 0;
                z-index: 1;
            }

            .thymer-table tbody tr:last-child td {
                border-bottom: none;
            }
        `);
    }

    /**
     * Start observing for code blocks and set up click handlers
     */
    startTableObserver() {
        // Click handler for entering edit mode
        this.clickHandler = (e) => {
            const block = e.target.closest('.listitem-block.has-table-render');
            if (block && !block.classList.contains('editing')) {
                this.editTable(block);
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener('click', this.clickHandler, true);
        
        // Process existing code blocks on page load
        this.processExistingCodeBlocks();

        // Watch for new code blocks being added to the DOM
        // Note: We only watch childList to avoid infinite loops
        this.observer = new MutationObserver((mutations) => {
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
        });
        
        console.log('[Table Plugin] Observer started');
    }
    
    /**
     * Enter edit mode for a table block
     * @param {HTMLElement} block - The code block element
     */
    editTable(block) {
        block.classList.add('editing');
        
        // Try to focus on an editable element
        const focusable = block.querySelector('input, textarea, [contenteditable]');
        if (focusable) {
            setTimeout(() => focusable.focus(), 50);
        }
        
        // Set up handler to exit edit mode when clicking outside
        const handleOutsideClick = (e) => {
            if (!block.contains(e.target)) {
                this.updateCodeBlock(block);
                block.classList.remove('editing');
                document.removeEventListener('click', handleOutsideClick, true);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick, true);
        }, 100);
    }
    
    /**
     * Update or create table rendering for a code block
     * @param {HTMLElement} block - The code block element
     */
    updateCodeBlock(block) {
        // Prevent re-entrant calls
        if (this.isUpdating) return;
        this.isUpdating = true;
        
        try {
            const text = this.extractCodeBlockText(block);
            
            // Check if content looks like a table (has pipes and multiple rows)
            const hasTableSyntax = text && 
                                   text.includes('|') && 
                                   text.split('\n').filter(l => l.includes('|')).length >= 2;
            
            if (!hasTableSyntax) {
                // Remove table if it exists
                const wrapper = block.querySelector('.thymer-table-wrapper');
                if (wrapper) {
                    wrapper.remove();
                }
                block.classList.remove('has-table-render');
                return;
            }
            
            // Parse table data
            const tableHTML = this.parseTable(text);
            if (!tableHTML) {
                return;
            }
            
            // Find or create table wrapper
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
                
                block.appendChild(wrapper);
                block.classList.add('has-table-render');
            }
            
            // Update table content
            const container = wrapper.querySelector('.thymer-table-container');
            if (container) {
                container.innerHTML = tableHTML;
            }
            
            // Apply theme colors
            this.applyThemeToTable(wrapper);
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * Process all existing code blocks on page
     */
    processExistingCodeBlocks() {
        const codeBlocks = document.querySelectorAll('.listitem-block, .block-code, [data-type="block"]');
        console.log(`[Table Plugin] Processing ${codeBlocks.length} existing code blocks`);
        
        codeBlocks.forEach(block => {
            this.processCodeBlock(block);
        });
    }

    /**
     * Process a newly added node and its children
     * @param {Node} node - DOM node to process
     */
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

    /**
     * Process a single code block
     * @param {HTMLElement} blockElement - The code block to process
     */
    processCodeBlock(blockElement) {
        if (blockElement.classList.contains('editing')) {
            return;
        }
        
        this.updateCodeBlock(blockElement);
    }

    /**
     * Extract text content from a code block
     * Tries multiple strategies to handle different DOM structures
     * @param {HTMLElement} blockElement - The code block element
     * @returns {string|null} Extracted text or null
     */
    extractCodeBlockText(blockElement) {
        // Strategy 1: Look for .listitem-text children
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
        
        // Strategy 3: Look for code element
        const codeEl = blockElement.querySelector('code');
        if (codeEl && codeEl.textContent) {
            return codeEl.textContent;
        }
        
        return null;
    }

    /**
     * Parse pipe-separated text into HTML table
     * @param {string} content - Pipe-separated text content
     * @returns {string|null} HTML table string or null
     */
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

        // Build HTML table
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
            // Pad row to match header length
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

    /**
     * Parse a single row of pipe-separated values
     * @param {string} rowText - Raw row text
     * @returns {string[]} Array of cell values
     */
    parseRow(rowText) {
        const cells = rowText.split('|').map(cell => cell.trim());
        
        // Remove empty first/last cells from leading/trailing pipes
        if (cells.length > 0 && cells[0] === '') {
            cells.shift();
        }
        if (cells.length > 0 && cells[cells.length - 1] === '') {
            cells.pop();
        }

        return cells;
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
