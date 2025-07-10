/**
 * Mobile Table Handler
 * Converts tables to card view on mobile devices
 */
class MobileTableHandler {
    constructor() {
        this.breakpoint = 768;
        this.tables = [];
        this.init();
    }

    init() {
        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupTables());
        } else {
            this.setupTables();
        }

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    setupTables() {
        // Find all tables with table-container or table-wrapper
        const tableContainers = document.querySelectorAll('.table-container, .table-wrapper');
        
        tableContainers.forEach(container => {
            this.setupTable(container);
        });
    }

    setupTable(container) {
        const table = container.querySelector('table');
        if (!table) return;

        const tableData = {
            container: container,
            table: table,
            headers: [],
            rows: [],
            cardView: null
        };

        // Extract headers
        const headerRows = table.querySelectorAll('thead tr');
        if (headerRows.length > 0) {
            const headerCells = headerRows[0].querySelectorAll('th');
            tableData.headers = Array.from(headerCells).map(th => ({
                text: th.textContent.trim(),
                class: th.className
            }));
        }

        // Create card view container
        const cardView = document.createElement('div');
        cardView.className = 'table-cards mobile-only';
        cardView.style.display = 'none';
        container.appendChild(cardView);
        tableData.cardView = cardView;

        this.tables.push(tableData);
        this.updateTable(tableData);
    }

    updateTable(tableData) {
        const { table, headers, cardView } = tableData;
        
        // Clear existing cards
        cardView.innerHTML = '';

        // Extract current table data
        const bodyRows = table.querySelectorAll('tbody tr');
        
        bodyRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 0) return;

            const card = document.createElement('div');
            card.className = 'table-card';

            // Add header if first cell has significant content
            const firstCell = cells[0];
            if (firstCell && firstCell.textContent.trim()) {
                const cardHeader = document.createElement('div');
                cardHeader.className = 'table-card-header';
                cardHeader.textContent = firstCell.textContent.trim();
                card.appendChild(cardHeader);
            }

            // Add remaining cells as key-value pairs
            cells.forEach((cell, index) => {
                if (index === 0) return; // Skip first cell as it's used for header

                const header = headers[index];
                if (!header) return;

                const cardRow = document.createElement('div');
                cardRow.className = 'table-card-row';

                const label = document.createElement('div');
                label.className = 'table-card-label';
                label.textContent = header.text;

                const value = document.createElement('div');
                value.className = 'table-card-value';
                value.innerHTML = cell.innerHTML;

                cardRow.appendChild(label);
                cardRow.appendChild(value);
                card.appendChild(cardRow);
            });

            // Handle action buttons
            const actionCells = row.querySelectorAll('td .table-actions, td .btn');
            if (actionCells.length > 0) {
                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'table-card-actions';

                actionCells.forEach(actionCell => {
                    const clonedActions = actionCell.cloneNode(true);
                    actionsContainer.appendChild(clonedActions);
                });

                card.appendChild(actionsContainer);
            }

            cardView.appendChild(card);
        });

        // Update visibility based on screen size
        this.updateVisibility();
    }

    handleResize() {
        this.updateVisibility();
    }

    updateVisibility() {
        const isMobile = window.innerWidth <= this.breakpoint;
        
        this.tables.forEach(tableData => {
            const { container, cardView, table } = tableData;
            
            if (isMobile) {
                // On mobile, force table to be wide enough to scroll
                table.style.minWidth = '800px';
                table.style.width = '800px';
                table.style.tableLayout = 'auto';
                
                // Ensure container allows scrolling
                container.style.overflowX = 'auto';
                container.style.overflowY = 'visible';
                container.style.webkitOverflowScrolling = 'touch';
                container.style.width = '100%';
                container.style.maxWidth = '100%';
                
                cardView.style.display = 'none';
                
                // Force a reflow to apply styles
                container.offsetHeight;
                
                // Add a visual indicator that table is scrollable
                if (!container.querySelector('.scroll-indicator')) {
                    const indicator = document.createElement('div');
                    indicator.className = 'scroll-indicator';
                    indicator.innerHTML = '← Swipe to see more columns →';
                    indicator.style.cssText = `
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        background: rgba(230, 57, 70, 0.9);
                        color: white;
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 11px;
                        z-index: 5;
                        pointer-events: none;
                        font-weight: bold;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    `;
                    container.style.position = 'relative';
                    container.appendChild(indicator);
                    
                    // Hide indicator after 5 seconds
                    setTimeout(() => {
                        if (indicator && indicator.parentNode) {
                            indicator.parentNode.removeChild(indicator);
                        }
                    }, 5000);
                }
            } else {
                // On desktop, remove mobile constraints
                table.style.minWidth = '';
                table.style.width = '';
                table.style.tableLayout = '';
                container.style.overflowX = '';
                container.style.overflowY = '';
                container.style.webkitOverflowScrolling = '';
                container.style.width = '';
                container.style.maxWidth = '';
                
                cardView.style.display = 'none';
                
                // Remove scroll indicator
                const indicator = container.querySelector('.scroll-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }
        });
    }

    // Method to refresh a specific table
    refreshTable(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const tableData = this.tables.find(t => t.container === container);
        if (tableData) {
            this.updateTable(tableData);
        }
    }

    // Method to refresh all tables
    refreshAllTables() {
        this.tables.forEach(tableData => {
            this.updateTable(tableData);
        });
    }

    // Debug method to check table setup
    debugTables() {
        console.log('Mobile Table Handler Debug:');
        console.log('Is Mobile:', window.innerWidth <= this.breakpoint);
        console.log('Tables found:', this.tables.length);
        
        this.tables.forEach((tableData, index) => {
            const { container, table } = tableData;
            console.log(`Table ${index + 1}:`, {
                containerWidth: container.offsetWidth,
                containerScrollWidth: container.scrollWidth,
                tableWidth: table.offsetWidth,
                tableScrollWidth: table.scrollWidth,
                containerOverflowX: getComputedStyle(container).overflowX,
                canScroll: container.scrollWidth > container.offsetWidth
            });
        });
    }

    // Force enable scrolling on all tables (for testing)
    forceEnableScrolling() {
        console.log('Force enabling scrolling on all tables...');
        this.tables.forEach((tableData, index) => {
            const { container, table } = tableData;
            
            // Force table to be wide
            table.style.minWidth = '800px';
            table.style.width = '800px';
            
            // Force container to allow scrolling
            container.style.overflowX = 'auto';
            container.style.width = '100%';
            container.style.maxWidth = '100%';
            
            console.log(`Table ${index + 1} forced to scroll. Container can scroll:`, container.scrollWidth > container.offsetWidth);
        });
    }
}

// Initialize mobile table handler
const mobileTableHandler = new MobileTableHandler();

// Export for use in other scripts
window.mobileTableHandler = mobileTableHandler;