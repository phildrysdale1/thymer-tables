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
 * @author phild & Niklas (with help from Claude & Gemini
 * @version 1.1.0
 * @license GPL3
 */
class Plugin extends AppPlugin {

    onLoad() {
        console.log('[Table Plugin] Loading Forest Floor Edition...');
        this.isUpdating = false;
        this.injectTableStyles();
        this.startTableObserver();
    }

    onUnload() {
        if (this.observer) this.observer.disconnect();
        if (this.clickHandler) document.removeEventListener('click', this.clickHandler);
    }

    /**
     * Map table elements to your specific Forest Floor variables.
     */
    getThemeColors() {
        return {
            // Text color for cells (Wet Bark)
            mainText: 'var(--color-text-400)',
            
            // Title row (Deep Soot background with Light Timber text)
            titleRowBg: 'var(--color-primary-500)',
            titleRowText: 'var(--color-primary-text-100)',
            
            // Zebra rows (Main Earth Base & Crust)
            rowBase: 'var(--color-bg-600)',
            rowAlt: 'var(--color-bg-700)',
            
            // Borders (Forest Depth / Wet Bark)
            containerBorder: 'var(--cards-border-color)',
            gridLines: 'rgba(26, 21, 19, 0.12)', // Subtle soot for cell borders
            hintText: 'var(--ed-datetime-color)'
        };
    }

    applyThemeToTable(wrapper) {
        const colors = this.getThemeColors();
        const container = wrapper.querySelector('.thymer-table-container');
        if (container) {
            container.style.setProperty('border-color', colors.containerBorder, 'important');
            container.style.setProperty('background-color', colors.rowBase, 'important');
        }
        
        const table = wrapper.querySelector('.thymer-table');
        if (!table) return;

        // Apply Header styles
        table.querySelectorAll('th').forEach(th => {
            th.style.setProperty('background-color', colors.titleRowBg, 'important');
            th.style.setProperty('color', colors.titleRowText, 'important');
        });

        // Apply Cell styles
        table.querySelectorAll('td').forEach(td => {
            td.style.setProperty('color', colors.mainText, 'important');
            td.style.setProperty('border-color', colors.gridLines, 'important');
        });
    }

    injectTableStyles() {
        this.ui.injectCSS(`
            /* 1. Interface Management */
            .listitem-block.has-table-render:not(.editing) > *:not(.thymer-table-wrapper) { display: none !important; }
            .listitem-block.has-table-render.editing .thymer-table-wrapper { display: none !important; }
            
            /* 2. Wrapper Layout */
            .thymer-table-wrapper { 
                position: relative; 
                margin: 1.5em 0; 
                box-sizing: border-box; 
                cursor: pointer;
            }

            .thymer-table-container { 
                overflow-x: auto; 
                border-radius: 4px; 
                border: 1px solid; 
                box-shadow: var(--color-shadow-cards);
            }

            /* 3. Table Structure */
            .thymer-table { 
                width: 100%; 
                border-collapse: collapse; 
                font-size: 13.5px; 
                font-family: var(--font-family, inherit); 
                margin: 0; 
            }

            .thymer-table th, .thymer-table td { 
                padding: 12px 16px; 
                text-align: left; 
                border-bottom: 1px solid rgba(0, 0, 0, 0.05);
                border-right: 1px solid rgba(0, 0, 0, 0.05); 
            }

            .thymer-table th:last-child, 
            .thymer-table td:last-child { 
                border-right: none; 
            }

            .thymer-table th { 
                font-weight: 700; 
                text-transform: uppercase;
                font-size: 11px;
                letter-spacing: 0.1em;
                border: none !important;
            }

            /* 4. FOREST ZEBRA STRIPING - Using Earth (900) and Crust (700) */
            .thymer-table tbody tr:nth-child(odd) {
                background-color: var(--color-bg-600) !important;
            }
            .thymer-table tbody tr:nth-child(even) {
                background-color: var(--color-bg-700) !important;
            }

            .thymer-table tbody tr:hover {
                background-color: var(--cards-hover-bg) !important;
            }

            /* 5. Hint Text */
            .thymer-table-edit-hint { 
                position: absolute; 
                bottom: -22px; 
                right: 4px; 
                font-size: 10px; 
                opacity: 0.6;
                color: var(--ed-datetime-color);
                font-family: var(--font-family, sans-serif);
                text-transform: uppercase;
            }
        `);
    }

    startTableObserver() {
        this.clickHandler = (e) => {
            const block = e.target.closest('.listitem-block.has-table-render');
            if (block && !block.classList.contains('editing')) {
                this.editTable(block);
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener('click', this.clickHandler, true);
        this.processExistingCodeBlocks();
        this.observer = new MutationObserver((mutations) => {
            if (this.isUpdating) return;
            mutations.forEach(m => m.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) this.processNode(node);
            }));
        });
        this.observer.observe(document.body, { childList: true, subtree: true });
    }
    
    editTable(block) {
        block.classList.add('editing');
        const handleOutsideClick = (e) => {
            if (!block.contains(e.target)) {
                this.updateCodeBlock(block);
                block.classList.remove('editing');
                document.removeEventListener('click', handleOutsideClick, true);
            }
        };
        setTimeout(() => document.addEventListener('click', handleOutsideClick, true), 100);
    }

    measureVisualIndentation(block) {
        const textElement = block.querySelector('.cm-content') || block.querySelector('code') || block.querySelector('.listitem-text');
        if (!textElement) return 0;
        const wasHidden = block.classList.contains('has-table-render');
        if (wasHidden) block.classList.remove('has-table-render');
        let offset = 0;
        try {
            const textRect = textElement.getBoundingClientRect();
            const blockRect = block.getBoundingClientRect();
            offset = Math.max(0, textRect.left - blockRect.left);
        } catch (e) {}
        if (wasHidden) block.classList.add('has-table-render');
        return offset;
    }
    
    updateCodeBlock(block) {
        if (this.isUpdating) return;
        this.isUpdating = true;
        try {
            const indentation = this.measureVisualIndentation(block);
            const text = this.extractCodeBlockText(block);
            const hasTableSyntax = text && text.includes('|') && text.split('\n').filter(l => l.includes('|')).length >= 2;
            if (!hasTableSyntax) {
                const wrapper = block.querySelector('.thymer-table-wrapper');
                if (wrapper) wrapper.remove();
                block.classList.remove('has-table-render');
                return;
            }
            const tableHTML = this.parseTable(text);
            if (!tableHTML) return;
            let wrapper = block.querySelector('.thymer-table-wrapper');
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'thymer-table-wrapper';
                wrapper.innerHTML = `<div class="thymer-table-container"></div><div class="thymer-table-edit-hint">Click to edit</div>`;
                block.appendChild(wrapper);
                block.classList.add('has-table-render');
            }
            if (indentation > 0) {
                wrapper.style.marginLeft = `${indentation}px`;
                wrapper.style.width = `calc(100% - ${indentation}px)`;
            }
            const container = wrapper.querySelector('.thymer-table-container');
            if (container) container.innerHTML = tableHTML;
            this.applyThemeToTable(wrapper);
        } finally { this.isUpdating = false; }
    }

    processExistingCodeBlocks() { document.querySelectorAll('.listitem-block, .block-code').forEach(b => this.updateCodeBlock(b)); }
    processNode(node) {
        if (node.classList && (node.classList.contains('listitem-block') || node.classList.contains('block-code'))) this.updateCodeBlock(node);
        node.querySelectorAll?.('.listitem-block, .block-code').forEach(b => this.updateCodeBlock(b));
    }
    extractCodeBlockText(block) {
        const textItems = block.querySelectorAll('.listitem-text, .listitem');
        if (textItems.length > 0) return Array.from(textItems).map(i => i.textContent?.trim()).join('\n');
        return block.querySelector('code')?.textContent || block.textContent;
    }

    parseTable(content) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) return null;
        let headerRow = lines[0], dataRows = lines[1].match(/^[\s\-|:]+$/) ? lines.slice(2) : lines.slice(1);
        const headers = this.parseRow(headerRow);
        if (!headers.length) return null;
        let html = '<table class="thymer-table"><thead><tr>';
        headers.forEach(h => html += `<th>${this.escapeHtml(h)}</th>`);
        html += '</tr></thead><tbody>';
        dataRows.forEach(rowText => {
            const row = this.parseRow(rowText);
            html += '<tr>';
            for (let i = 0; i < headers.length; i++) html += `<td>${this.escapeHtml(row[i] || '')}</td>`;
            html += '</tr>';
        });
        return html + '</tbody></table>';
    }

    parseRow(rowText) {
        const cells = rowText.split('|').map(c => c.trim());
        if (cells[0] === '') cells.shift();
        if (cells[cells.length - 1] === '') cells.pop();
        return cells;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
