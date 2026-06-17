/**
 * Thyme(s)r Tables Plugin
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
 * @version 1.1.1
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
        if (this.clickHandler) document.removeEventListener('click', this.clickHandler, true);
        if (this.scanTimer) clearTimeout(this.scanTimer);
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
            .listitem.has-table-render:not(.editing),
            .listitem-block.has-table-render:not(.editing) { display: none !important; }
            .listitem.has-table-render.editing,
            .listitem-block.has-table-render.editing { display: block !important; }
            .thymer-table-wrapper.thymer-editing { display: none !important; }
            
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
            const wrapper = e.target.closest('.thymer-table-wrapper');
            if (wrapper && !wrapper.classList.contains('thymer-editing')) {
                this.editTable(wrapper);
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            document.querySelectorAll('.thymer-table-wrapper.thymer-editing').forEach(w => {
                const items = this.getGroupItems(w);
                if (items.length > 0 && !items.some(item => item.contains(e.target))) this.finishEditing(w);
            });
        };
        document.addEventListener('click', this.clickHandler, true);
        this.scheduleScan(100);
        this.scheduleScan(500);
        this.scheduleScan(1500);
        this.observer = new MutationObserver(() => {
            if (this.isUpdating) return;
            this.scheduleScan(100);
        });
        this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    
    editTable(wrapper) {
        wrapper.classList.add('thymer-editing');
        this.getGroupItems(wrapper).forEach(item => item.classList.add('editing'));
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
    
    scheduleScan(ms) {
        if (this.scanTimer) clearTimeout(this.scanTimer);
        this.scanTimer = setTimeout(() => this.scanItemGroups(), ms);
    }

    scanItemGroups() {
        if (this.isUpdating) return;
        this.isUpdating = true;
        try {
            this.cleanupInvalidRenderedTables();
            const all = document.querySelectorAll('.listitem');
            const processed = new WeakSet();
            for (const item of all) {
                if (processed.has(item) || item.dataset.tgProcessed) continue;
                if (!this.isTableLine(item)) continue;

                const group = this.collectTableGroup(item);
                group.forEach(el => processed.add(el));
                if (group.length < 2) continue;

                const tableText = this.getRenderableTableText(group.map(el => this.extractItemText(el)).join('\n'));
                const tableHTML = this.parseTable(tableText);
                if (!tableHTML) continue;

                const wrapper = this.buildWrapper(tableHTML);
                const groupId = 'tg-' + String(Date.now()) + '-' + Math.random().toString(36).slice(2, 6);
                wrapper.dataset.tgGroupId = groupId;
                group.forEach(el => {
                    el.dataset.tgGroupId = groupId;
                    el.dataset.tgProcessed = '1';
                    el.classList.add('has-table-render');
                });
                group[group.length - 1].after(wrapper);
            }
        } finally { this.isUpdating = false; }
    }

    shouldProcessBlock(block) {
        if (!block || block.nodeType !== Node.ELEMENT_NODE) return false;
        return !this.isCodeContext(block);
    }

    isCodeContext(el) {
        const codeSelector = '.block-code, .code-block, pre, code, .cm-editor, .cm-content, .cm-line';
        if (el.closest(codeSelector) || el.querySelector(codeSelector)) return true;

        const hasCodeClass = (node) => {
            const className = typeof node.className === 'string' ? node.className : '';
            return /(^|\s)(block-code|code-block|cm-\S+|\S*code\S*)(\s|$)/i.test(className);
        };

        let node = el;
        while (node && node !== document.body) {
            if (hasCodeClass(node)) return true;
            node = node.parentElement;
        }

        return Array.from(el.querySelectorAll('*')).some(hasCodeClass);
    }

    cleanupInvalidRenderedTables() {
        document.querySelectorAll('.thymer-table-wrapper').forEach(wrapper => {
            const items = this.getGroupItems(wrapper);
            if (!items.length) return;
            if (items.some(item => !this.shouldProcessBlock(item) || this.isInsideSiblingFence(item))) {
                items.forEach(item => {
                    delete item.dataset.tgGroupId;
                    delete item.dataset.tgProcessed;
                    item.classList.remove('has-table-render', 'editing');
                });
                wrapper.remove();
            }
        });
    }

    isTableLine(item) {
        if (!this.shouldProcessBlock(item) || this.isInsideSiblingFence(item)) return false;
        const text = this.extractItemText(item).trim();
        return text.includes('|') && this.parseRow(text).length >= 2;
    }

    isFenceLine(text) {
        return /^\s{0,3}(```+|~~~+)/.test(text || '');
    }

    isInsideSiblingFence(item) {
        let inFence = false;
        let node = item.parentElement?.firstElementChild;
        while (node && node !== item) {
            if (node.matches?.('.listitem')) {
                const text = this.extractItemText(node).trim();
                if (this.isFenceLine(text)) inFence = !inFence;
            }
            node = node.nextElementSibling;
        }
        return inFence;
    }

    collectTableGroup(start) {
        const group = [start];
        let prev = start.previousElementSibling;
        while (prev && prev.matches('.listitem') && !prev.dataset.tgProcessed && this.isTableLine(prev)) {
            group.unshift(prev);
            prev = prev.previousElementSibling;
        }
        let next = start.nextElementSibling;
        while (next && next.matches('.listitem') && !next.dataset.tgProcessed && this.isTableLine(next)) {
            group.push(next);
            next = next.nextElementSibling;
        }
        return group;
    }

    buildWrapper(tableHTML) {
        const wrapper = document.createElement('div');
        wrapper.className = 'thymer-table-wrapper';
        wrapper.innerHTML = `<div class="thymer-table-container">${tableHTML}</div><div class="thymer-table-edit-hint">Click to edit</div>`;
        this.applyThemeToTable(wrapper);
        return wrapper;
    }

    getGroupItems(wrapper) {
        const groupId = wrapper.dataset.tgGroupId;
        if (!groupId) return [];
        const items = [];
        let el = wrapper.previousElementSibling;
        while (el && el.dataset?.tgGroupId === groupId) {
            items.unshift(el);
            el = el.previousElementSibling;
        }
        return items;
    }

    finishEditing(wrapper) {
        const items = this.getGroupItems(wrapper);
        const tableText = this.getRenderableTableText(items.map(el => this.extractItemText(el)).join('\n'));
        const tableHTML = this.parseTable(tableText);
        if (items.length >= 2 && tableHTML) {
            const container = wrapper.querySelector('.thymer-table-container');
            if (container) container.innerHTML = tableHTML;
            this.applyThemeToTable(wrapper);
            items.forEach(el => el.classList.remove('editing'));
            wrapper.classList.remove('thymer-editing');
            return;
        }
        items.forEach(el => {
            delete el.dataset.tgGroupId;
            delete el.dataset.tgProcessed;
            el.classList.remove('has-table-render', 'editing');
        });
        wrapper.remove();
    }

    extractItemText(item) {
        const inner = item.querySelector('.listitem-text') || item;
        return this.stripInlineCode(this.getTextExcludingCode(inner)).trim();
    }

    extractRenderableText(block) {
        return this.extractItemText(block);
    }

    getTextExcludingCode(root) {
        const ignoredSelector = '.thymer-table-wrapper, pre, code, .inline-code, .cm-inline-code, .cm-code, .cm-formatting-code';
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent || parent.closest(ignoredSelector)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        let text = '';
        let node;
        while ((node = walker.nextNode())) text += node.textContent;
        return text;
    }

    stripInlineCode(text) {
        if (!text) return '';
        let result = '';
        for (let i = 0; i < text.length;) {
            if (text[i] !== '`') {
                result += text[i++];
                continue;
            }
            let tickCount = 1;
            while (text[i + tickCount] === '`') tickCount++;
            const marker = '`'.repeat(tickCount);
            const end = text.indexOf(marker, i + tickCount);
            if (end === -1) {
                result += marker;
                i += tickCount;
            } else {
                i = end + tickCount;
            }
        }
        return result;
    }

    getRenderableTableText(content) {
        if (!content) return '';
        const lines = content.split('\n');
        const kept = [];
        let inFence = false;
        let fenceMarker = null;
        for (const line of lines) {
            const match = line.match(/^\s{0,3}(```+|~~~+)/);
            if (match && (!inFence || match[1][0] === fenceMarker)) {
                inFence = !inFence;
                fenceMarker = inFence ? match[1][0] : null;
                continue;
            }
            if (!inFence) kept.push(line);
        }
        return kept.join('\n');
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
