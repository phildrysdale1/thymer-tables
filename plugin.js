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
 * @author phild & Niklas (with help from Claude & Gemini)
 * @version 1.1.2
 * @license GPL3
 */
class Plugin extends AppPlugin {
    onLoad() {
        console.log("[Table Plugin] Loading Forest Floor Edition...");
        this.isUpdating = false;
        this.selectionRevealWrappers = new Set();
        this.arrowRevealStates = new Map();
        this.enterExitStates = new Map();
        this.injectTableStyles();
        this.startSelectAllHandler();
        this.startArrowNavigationHandler();
        this.startTableObserver();
    }

    onUnload() {
        if (this.observer) this.observer.disconnect();
        if (this.clickHandler)
            document.removeEventListener("click", this.clickHandler, true);
        if (this.selectAllHandler)
            window.removeEventListener("keydown", this.selectAllHandler, true);
        if (this.arrowNavigationHandler)
            window.removeEventListener("keydown", this.arrowNavigationHandler, true);
        if (this.restoreSelectionRevealTimer)
            clearTimeout(this.restoreSelectionRevealTimer);
        if (this.scanTimer) clearTimeout(this.scanTimer);
    }

    /**
     * Map table elements to your specific Forest Floor variables.
     */
    getThemeColors() {
        return {
            // Text color for cells (Wet Bark)
            mainText: "var(--color-text-400)",

            // Title row (Deep Soot background with Light Timber text)
            titleRowBg: "var(--color-primary-500)",
            titleRowText: "var(--color-primary-text-100)",

            // Zebra rows (Main Earth Base & Crust)
            rowBase: "var(--color-bg-600)",
            rowAlt: "var(--color-bg-700)",

            // Borders (Forest Depth / Wet Bark)
            containerBorder: "var(--cards-border-color)",
            gridLines: "rgba(26, 21, 19, 0.12)", // Subtle soot for cell borders
            hintText: "var(--ed-datetime-color)",
        };
    }

    applyThemeToTable(wrapper) {
        const colors = this.getThemeColors();
        const container = wrapper.querySelector(".thymer-table-container");
        if (container) {
            container.style.setProperty(
                "border-color",
                colors.containerBorder,
                "important",
            );
            container.style.setProperty(
                "background-color",
                colors.rowBase,
                "important",
            );
        }

        const table = wrapper.querySelector(".thymer-table");
        if (!table) return;

        // Apply Header styles
        table.querySelectorAll("th").forEach((th) => {
            th.style.setProperty(
                "background-color",
                colors.titleRowBg,
                "important",
            );
            th.style.setProperty("color", colors.titleRowText, "important");
        });

        // Apply Cell styles
        table.querySelectorAll("td").forEach((td) => {
            td.style.setProperty("color", colors.mainText, "important");
            td.style.setProperty("border-color", colors.gridLines, "important");
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

    startSelectAllHandler() {
        this.selectAllHandler = (e) => {
            if (this.isSelectAllShortcut(e)) {
                // Thymer's Select All works on the editable list items, not on
                // plugin-rendered replacement DOM. Reveal the source rows before
                // Thymer/native selection logic runs so Ctrl/Cmd+A selects the
                // original pipe-table text instead of the rendered HTML table.
                this.revealAllTablesForSelection();
                return;
            }

            if (this.shouldRestoreAfterSelectionReveal(e)) {
                this.scheduleRestoreSelectionRevealedTables();
            }
        };

        // Use window capture so Ctrl/Cmd+A runs before Thymer's document/editor
        // key handlers. Do not preventDefault/stopPropagation; Thymer should
        // still perform its normal Select All behavior.
        window.addEventListener("keydown", this.selectAllHandler, true);
    }

    isSelectAllShortcut(e) {
        const key = (e.key || "").toLowerCase();
        return key === "a" && (e.ctrlKey || e.metaKey) && !e.altKey;
    }

    shouldRestoreAfterSelectionReveal(e) {
        if (!this.selectionRevealWrappers?.size) return false;
        if (e.ctrlKey || e.metaKey || e.altKey) return false;

        return [
            "Enter",
            "Escape",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
            "PageUp",
            "PageDown",
            "Tab",
        ].includes(e.key);
    }

    revealAllTablesForSelection() {
        document
            .querySelectorAll(".thymer-table-wrapper:not(.thymer-editing)")
            .forEach((wrapper) => {
                this.selectionRevealWrappers.add(wrapper);
                this.editTable(wrapper);
            });
    }

    scheduleRestoreSelectionRevealedTables() {
        if (this.restoreSelectionRevealTimer)
            clearTimeout(this.restoreSelectionRevealTimer);

        // Let Thymer handle the navigation/action key first, then re-render only
        // the tables that were temporarily revealed by Ctrl/Cmd+A. Tables opened
        // by clicking remain in normal edit mode.
        this.restoreSelectionRevealTimer = setTimeout(
            () => this.restoreSelectionRevealedTables(),
            0,
        );
    }

    restoreSelectionRevealedTables() {
        if (!this.selectionRevealWrappers?.size) return;

        const wrappers = Array.from(this.selectionRevealWrappers);
        this.selectionRevealWrappers.clear();
        wrappers.forEach((wrapper) => {
            if (wrapper.isConnected && wrapper.classList.contains("thymer-editing")) {
                this.finishEditing(wrapper);
            }
        });
    }

    startArrowNavigationHandler() {
        this.arrowNavigationHandler = (e) => {
            if (
                e.key !== "ArrowDown" &&
                e.key !== "ArrowUp" &&
                e.key !== "Enter"
            ) {
                this.enterExitStates?.clear();
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (this.selectionRevealWrappers?.size) return;

            if (e.key === "Enter") {
                setTimeout(() => this.handleEnterExitFromTables(), 0);
                return;
            }

            const wrapper =
                this.getRenderedTableNearCaret(e.key) ||
                this.getRenderedTableNearCurrentItem(e.key);

            if (wrapper) {
                // Capture the bordering table on keydown, but reveal it only
                // after Thymer has handled its own caret movement. The earlier
                // attempt changed the DOM synchronously during keydown, which
                // could leave Thymer with stale render/edit state.
                setTimeout(() => {
                    if (
                        wrapper.isConnected &&
                        !wrapper.classList.contains("thymer-editing")
                    ) {
                        this.editTable(wrapper);
                        this.arrowRevealStates.set(wrapper, { entered: false });
                    }
                }, 0);
                return;
            }

            if (this.arrowRevealStates?.size) {
                setTimeout(() => this.restoreArrowRevealedTablesIfExited(), 0);
            }
        };

        window.addEventListener("keydown", this.arrowNavigationHandler, true);
    }

    handleEnterExitFromTables() {
        const wrappers = Array.from(
            document.querySelectorAll(".thymer-table-wrapper.thymer-editing"),
        );
        if (!wrappers.length) {
            this.enterExitStates?.clear();
            return;
        }

        const currentItem = this.getCurrentListItem();
        wrappers.forEach((wrapper) => {
            if (this.isCaretInsideTableSource(wrapper)) {
                this.enterExitStates.delete(wrapper);
                return;
            }

            if (!this.isCaretJustAfterTableSource(wrapper, currentItem)) {
                this.enterExitStates.delete(wrapper);
                return;
            }

            const count = (this.enterExitStates.get(wrapper) || 0) + 1;
            if (count >= 2) {
                this.enterExitStates.delete(wrapper);
                this.finishEditing(wrapper);
            } else {
                this.enterExitStates.set(wrapper, count);
            }
        });
    }

    isCaretJustAfterTableSource(wrapper, currentItem) {
        const items = this.getGroupItems(wrapper);
        if (!items.length || !currentItem || items.includes(currentItem))
            return false;

        const last = items[items.length - 1];
        const lastRect = last.getBoundingClientRect();
        const currentRect = currentItem.getBoundingClientRect();
        if (!lastRect.height && !currentRect.height) return false;

        return (
            currentRect.top >= lastRect.bottom - 4 &&
            currentRect.top <= lastRect.bottom + 180
        );
    }

    restoreArrowRevealedTablesIfExited() {
        if (!this.arrowRevealStates?.size) return;

        for (const [wrapper, state] of Array.from(
            this.arrowRevealStates.entries(),
        )) {
            if (
                !wrapper.isConnected ||
                !wrapper.classList.contains("thymer-editing")
            ) {
                this.arrowRevealStates.delete(wrapper);
                continue;
            }

            if (this.isCaretInsideTableSource(wrapper)) {
                state.entered = true;
                continue;
            }

            if (state.entered) {
                this.arrowRevealStates.delete(wrapper);
                this.finishEditing(wrapper);
            }
        }
    }

    isCaretInsideTableSource(wrapper) {
        const items = this.getGroupItems(wrapper);
        if (!items.length) return false;

        const currentItem = this.getCurrentListItem();
        if (currentItem && items.includes(currentItem)) return true;

        const caretRect = this.getActiveCaretRect();
        if (!caretRect) return false;

        const bounds = this.getUnionRect(items);
        if (!bounds) return false;

        const caretY = caretRect.top + caretRect.height / 2;
        return caretY >= bounds.top - 4 && caretY <= bounds.bottom + 4;
    }

    getUnionRect(elements) {
        let bounds = null;
        elements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (!rect.width && !rect.height) return;
            if (!bounds) {
                bounds = {
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    left: rect.left,
                };
                return;
            }
            bounds.top = Math.min(bounds.top, rect.top);
            bounds.right = Math.max(bounds.right, rect.right);
            bounds.bottom = Math.max(bounds.bottom, rect.bottom);
            bounds.left = Math.min(bounds.left, rect.left);
        });
        return bounds;
    }

    getRenderedTableNearCaret(key) {
        const caretRect = this.getActiveCaretRect();
        if (!caretRect) return null;

        const wrappers = Array.from(
            document.querySelectorAll(
                ".thymer-table-wrapper:not(.thymer-editing)",
            ),
        );
        let best = null;
        let bestGap = Infinity;

        wrappers.forEach((wrapper) => {
            const rect = wrapper.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            if (!this.rectsHorizontallyOverlap(caretRect, rect)) return;

            const gap =
                key === "ArrowDown"
                    ? rect.top - caretRect.bottom
                    : caretRect.top - rect.bottom;

            if (gap >= -2 && gap < bestGap && gap <= 120) {
                best = wrapper;
                bestGap = gap;
            }
        });

        return best;
    }

    getActiveCaretRect() {
        const carets = Array.from(
            document.querySelectorAll(
                ".panel.has-focus .listview-caret-self, .listview-caret-self",
            ),
        );

        for (const caret of carets) {
            const rect = caret.getBoundingClientRect();
            if (rect.width || rect.height) return rect;
        }

        const selection = window.getSelection?.();
        if (selection?.rangeCount) {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            if (rect.width || rect.height) return rect;
        }

        return null;
    }

    rectsHorizontallyOverlap(a, b) {
        return a.left <= b.right && a.right >= b.left;
    }

    getRenderedTableNearCurrentItem(key) {
        const item = this.getCurrentListItem();
        if (!item) return null;
        return key === "ArrowDown"
            ? this.getRenderedTableAfterItem(item)
            : this.getRenderedTableBeforeItem(item);
    }

    getCurrentListItem() {
        const selection = window.getSelection?.();
        let node = selection?.anchorNode || document.activeElement;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        return node?.closest?.(".listitem") || null;
    }

    getRenderedTableAfterItem(item) {
        let node = item.nextElementSibling;
        while (node?.matches?.(".listitem.has-table-render")) {
            node = node.nextElementSibling;
        }
        return node?.matches?.(".thymer-table-wrapper:not(.thymer-editing)")
            ? node
            : null;
    }

    getRenderedTableBeforeItem(item) {
        const node = item.previousElementSibling;
        return node?.matches?.(".thymer-table-wrapper:not(.thymer-editing)")
            ? node
            : null;
    }

    startTableObserver() {
        this.clickHandler = (e) => {
            const wrapper = e.target.closest(".thymer-table-wrapper");
            if (wrapper && !wrapper.classList.contains("thymer-editing")) {
                this.editTable(wrapper);
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            document
                .querySelectorAll(".thymer-table-wrapper.thymer-editing")
                .forEach((w) => {
                    const items = this.getGroupItems(w);
                    if (
                        items.length > 0 &&
                        !items.some((item) => item.contains(e.target))
                    )
                        this.finishEditing(w);
                });
        };
        document.addEventListener("click", this.clickHandler, true);
        this.scheduleScan(100);
        this.scheduleScan(500);
        this.scheduleScan(1500);
        this.observer = new MutationObserver(() => {
            if (this.isUpdating) return;
            this.scheduleScan(100);
        });
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    editTable(wrapper) {
        wrapper.classList.add("thymer-editing");
        this.getGroupItems(wrapper).forEach((item) =>
            item.classList.add("editing"),
        );
    }

    measureVisualIndentation(block) {
        const textElement =
            block.querySelector(".cm-content") ||
            block.querySelector("code") ||
            block.querySelector(".listitem-text");
        if (!textElement) return 0;
        const wasHidden = block.classList.contains("has-table-render");
        if (wasHidden) block.classList.remove("has-table-render");
        let offset = 0;
        try {
            const textRect = textElement.getBoundingClientRect();
            const blockRect = block.getBoundingClientRect();
            offset = Math.max(0, textRect.left - blockRect.left);
        } catch (e) {}
        if (wasHidden) block.classList.add("has-table-render");
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
            const all = document.querySelectorAll(".listitem");
            const processed = new WeakSet();
            for (const item of all) {
                if (processed.has(item) || item.dataset.tgProcessed) continue;
                if (!this.isTableLine(item)) continue;

                const group = this.collectTableGroup(item);
                group.forEach((el) => processed.add(el));
                if (group.length < 2) continue;

                const tableText = this.getRenderableTableText(
                    group.map((el) => this.extractItemText(el)).join("\n"),
                );
                const tableHTML = this.parseTable(tableText);
                if (!tableHTML) continue;

                const wrapper = this.buildWrapper(tableHTML);
                const groupId =
                    "tg-" +
                    String(Date.now()) +
                    "-" +
                    Math.random().toString(36).slice(2, 6);
                wrapper.dataset.tgGroupId = groupId;
                group.forEach((el) => {
                    el.dataset.tgGroupId = groupId;
                    el.dataset.tgProcessed = "1";
                    el.classList.add("has-table-render");
                });
                group[group.length - 1].after(wrapper);
            }
        } finally {
            this.isUpdating = false;
        }
    }

    shouldProcessBlock(block) {
        if (!block || block.nodeType !== Node.ELEMENT_NODE) return false;
        return !this.isCodeContext(block);
    }

    isCodeContext(el) {
        const codeSelector =
            ".block-code, .code-block, pre, code, .cm-editor, .cm-content, .cm-line";
        if (el.closest(codeSelector) || el.querySelector(codeSelector))
            return true;

        const hasCodeClass = (node) => {
            const className =
                typeof node.className === "string" ? node.className : "";
            return /(^|\s)(block-code|code-block|cm-\S+|\S*code\S*)(\s|$)/i.test(
                className,
            );
        };

        let node = el;
        while (node && node !== document.body) {
            if (hasCodeClass(node)) return true;
            node = node.parentElement;
        }

        return Array.from(el.querySelectorAll("*")).some(hasCodeClass);
    }

    cleanupInvalidRenderedTables() {
        document
            .querySelectorAll(".thymer-table-wrapper")
            .forEach((wrapper) => {
                const items = this.getGroupItems(wrapper);
                if (!items.length) return;
                if (
                    items.some(
                        (item) =>
                            !this.shouldProcessBlock(item) ||
                            this.isInsideSiblingFence(item),
                    )
                ) {
                    items.forEach((item) => {
                        delete item.dataset.tgGroupId;
                        delete item.dataset.tgProcessed;
                        item.classList.remove("has-table-render", "editing");
                    });
                    wrapper.remove();
                }
            });
    }

    isTableLine(item) {
        if (!this.shouldProcessBlock(item) || this.isInsideSiblingFence(item))
            return false;
        const text = this.extractItemText(item).trim();
        return text.includes("|") && this.parseRow(text).length >= 2;
    }

    isFenceLine(text) {
        return /^\s{0,3}(```+|~~~+)/.test(text || "");
    }

    isInsideSiblingFence(item) {
        let inFence = false;
        let node = item.parentElement?.firstElementChild;
        while (node && node !== item) {
            if (node.matches?.(".listitem")) {
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
        while (
            prev &&
            prev.matches(".listitem") &&
            !prev.dataset.tgProcessed &&
            this.isTableLine(prev)
        ) {
            group.unshift(prev);
            prev = prev.previousElementSibling;
        }
        let next = start.nextElementSibling;
        while (
            next &&
            next.matches(".listitem") &&
            !next.dataset.tgProcessed &&
            this.isTableLine(next)
        ) {
            group.push(next);
            next = next.nextElementSibling;
        }
        return group;
    }

    buildWrapper(tableHTML) {
        const wrapper = document.createElement("div");
        wrapper.className = "thymer-table-wrapper";
        wrapper.innerHTML = `<div class="thymer-table-container">${tableHTML}</div><div class="thymer-table-edit-hint">Click to edit</div>`;
        this.applyThemeToTable(wrapper);
        return wrapper;
    }

    getGroupItems(wrapper) {
        const groupId = wrapper.dataset.tgGroupId;
        if (!groupId) return [];

        // Prefer the tracked group id over sibling walking. Pressing Enter to
        // leave a table can insert a blank list item between the table source
        // rows and the rendered wrapper; sibling-only lookup then loses the
        // table rows and cannot re-render.
        return Array.from(document.querySelectorAll(".listitem")).filter(
            (el) => el.dataset?.tgGroupId === groupId,
        );
    }

    finishEditing(wrapper) {
        this.arrowRevealStates?.delete(wrapper);
        this.enterExitStates?.delete(wrapper);
        const items = this.getGroupItems(wrapper);
        const tableText = this.getRenderableTableText(
            items.map((el) => this.extractItemText(el)).join("\n"),
        );
        const tableHTML = this.parseTable(tableText);
        if (items.length >= 2 && tableHTML) {
            const container = wrapper.querySelector(".thymer-table-container");
            if (container) container.innerHTML = tableHTML;
            this.applyThemeToTable(wrapper);
            items.forEach((el) => el.classList.remove("editing"));
            wrapper.classList.remove("thymer-editing");
            return;
        }
        items.forEach((el) => {
            delete el.dataset.tgGroupId;
            delete el.dataset.tgProcessed;
            el.classList.remove("has-table-render", "editing");
        });
        wrapper.remove();
    }

    extractItemText(item) {
        const inner = item.querySelector(".listitem-text") || item;
        return this.stripInlineCode(this.getTextExcludingCode(inner)).trim();
    }

    extractRenderableText(block) {
        return this.extractItemText(block);
    }

    getTextExcludingCode(root) {
        const ignoredSelector =
            ".thymer-table-wrapper, pre, code, .inline-code, .cm-inline-code, .cm-code, .cm-formatting-code";
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent || parent.closest(ignoredSelector))
                    return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });
        let text = "";
        let node;
        while ((node = walker.nextNode())) text += node.textContent;
        return text;
    }

    stripInlineCode(text) {
        if (!text) return "";
        let result = "";
        for (let i = 0; i < text.length; ) {
            if (text[i] !== "`") {
                result += text[i++];
                continue;
            }
            let tickCount = 1;
            while (text[i + tickCount] === "`") tickCount++;
            const marker = "`".repeat(tickCount);
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
        if (!content) return "";
        const lines = content.split("\n");
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
        return kept.join("\n");
    }

    parseTable(content) {
        const lines = content
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l);
        if (lines.length < 2) return null;
        let headerRow = lines[0],
            dataRows = lines[1].match(/^[\s\-|:]+$/)
                ? lines.slice(2)
                : lines.slice(1);
        const headers = this.parseRow(headerRow);
        if (!headers.length) return null;
        let html = '<table class="thymer-table"><thead><tr>';
        headers.forEach((h) => (html += `<th>${this.escapeHtml(h)}</th>`));
        html += "</tr></thead><tbody>";
        dataRows.forEach((rowText) => {
            const row = this.parseRow(rowText);
            html += "<tr>";
            for (let i = 0; i < headers.length; i++)
                html += `<td>${this.escapeHtml(row[i] || "")}</td>`;
            html += "</tr>";
        });
        return html + "</tbody></table>";
    }

    parseRow(rowText) {
        const cells = rowText.split("|").map((c) => c.trim());
        if (cells[0] === "") cells.shift();
        if (cells[cells.length - 1] === "") cells.pop();
        return cells;
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
}
