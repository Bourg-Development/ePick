// System Update Notifications
(function() {
    'use strict';

    // Translation function fallback
    if (typeof __ === 'undefined') {
        window.__ = function(key) {
            if (window.translations) {
                const keys = key.split('.');
                let value = window.translations;
                for (const k of keys) {
                    value = value[k];
                    if (!value) break;
                }
                return value || key;
            }
            return key;
        };
    }

    // Check for pending updates on page load
    document.addEventListener('DOMContentLoaded', function() {
        // Only check for authenticated users
        if (window.location.pathname.includes('/auth/') || window.location.pathname === '/') {
            return;
        }

        // Check after a small delay to ensure page is fully loaded
        setTimeout(checkForPendingUpdates, 2000);
    });

    async function checkForPendingUpdates() {
        try {
            const response = await fetch('/api/system-updates/user/pending', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.updates && data.data.updates.length > 0) {
                    // Show popup for the most recent update
                    showUpdateNotificationPopup(data.data.updates[0]);
                }
            }
        } catch (error) {
            console.error('Error checking for pending updates:', error);
        }
    }

    function showUpdateNotificationPopup(update) {
        // Check if popup was already shown recently (localStorage cache)
        const shownKey = `update_popup_shown_${update.id}`;
        const lastShown = localStorage.getItem(shownKey);
        
        if (lastShown) {
            const lastShownTime = new Date(lastShown);
            const now = new Date();
            const hoursSinceShown = (now - lastShownTime) / (1000 * 60 * 60);
            
            // Don't show again if shown within last 24 hours
            if (hoursSinceShown < 24) {
                return;
            }
        }

        // Create popup HTML
        const popupHtml = createUpdatePopupHtml(update);
        
        // Create popup container
        const popupContainer = document.createElement('div');
        popupContainer.id = 'updateNotificationPopup';
        popupContainer.innerHTML = popupHtml;
        
        // Add to document
        document.body.appendChild(popupContainer);
        
        // Show popup with animation
        setTimeout(() => {
            popupContainer.classList.add('show');
        }, 100);

        // Mark popup as shown
        markPopupShown(update.id);
        
        // Cache that popup was shown
        localStorage.setItem(shownKey, new Date().toISOString());
    }

    function createUpdatePopupHtml(update) {
        const formatDate = (dateString) => {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        const getCategoryIcon = (category) => {
            const icons = {
                'new': '✨',
                'improved': '🚀',
                'fixed': '🔧',
                'security': '🔒',
                'performance': '⚡',
                'ui': '🎨',
                'api': '🔗',
                'other': '📝'
            };
            return icons[category] || '•';
        };

        let changesHtml = '';
        if (update.changes && Array.isArray(update.changes)) {
            changesHtml = `
                <div class="update-changes">
                    <h4>What's New</h4>
                    ${update.changes.map(changeGroup => `
                        <div class="change-category">
                            <h5>${getCategoryIcon(changeGroup.category)} ${getCategoryDisplayName(changeGroup.category)}</h5>
                            <ul>
                                ${changeGroup.items.slice(0, 3).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                                ${changeGroup.items.length > 3 ? `<li class="more-items">...and ${changeGroup.items.length - 3} more</li>` : ''}
                            </ul>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return `
            <div class="update-popup-overlay">
                <div class="update-popup">
                    <div class="update-popup-header">
                        <div class="update-icon">🚀</div>
                        <div class="update-title">
                            <h3>System Update Available</h3>
                            <span class="update-version">Version ${escapeHtml(update.version)}</span>
                        </div>
                        <button class="update-close-btn" onclick="closeUpdatePopup()">&times;</button>
                    </div>
                    
                    <div class="update-popup-body">
                        <div class="update-header-info">
                            <h4>${escapeHtml(update.title)}</h4>
                            <div class="update-badges">
                                <span class="badge release-${update.release_type}">${update.release_type}</span>
                                <span class="badge priority-${update.priority}">${update.priority}</span>
                            </div>
                        </div>

                        ${changesHtml}

                        ${update.description ? `
                            <div class="update-description">
                                <div>${parseMarkdown(update.description)}</div>
                            </div>
                        ` : ''}
                        
                        ${update.requires_acknowledgment ? `
                            <div class="acknowledgment-notice">
                                <span class="material-symbols-outlined">info</span>
                                <span>This update requires your acknowledgment to continue using the system.</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="update-popup-footer">
                        <button class="btn btn-secondary" onclick="closeUpdatePopup()">
                            ${update.requires_acknowledgment ? 'Later' : 'Got it'}
                        </button>
                        ${update.requires_acknowledgment ? `
                            <button class="btn btn-primary" onclick="acknowledgeUpdate(${update.id})">
                                Acknowledge
                            </button>
                        ` : `
                            <button class="btn btn-primary" onclick="acknowledgeUpdate(${update.id})">
                                <span class="material-symbols-outlined">check</span>
                                Mark as Read
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    function getCategoryDisplayName(category) {
        const categoryMap = {
            'new': 'New Features',
            'improved': 'Improvements',
            'fixed': 'Bug Fixes',
            'removed': 'Removed Features',
            'security': 'Security Updates',
            'performance': 'Performance Improvements',
            'ui': 'UI/UX Changes',
            'api': 'API Changes',
            'other': 'Other Changes'
        };
        return categoryMap[category] || 'Changes';
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function parseMarkdown(text) {
        if (!text) return '';
        
        // Basic markdown parsing
        return text
            // Headers
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            // Code
            .replace(/`(.+?)`/g, '<code>$1</code>')
            // Links
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>');
    }

    async function markPopupShown(updateId) {
        try {
            await fetch(`/api/system-updates/${updateId}/popup-shown`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Error marking popup as shown:', error);
        }
    }

    // Global functions for popup interaction
    window.closeUpdatePopup = function() {
        const popup = document.getElementById('updateNotificationPopup');
        if (popup) {
            popup.classList.remove('show');
            setTimeout(() => {
                popup.remove();
            }, 300);
        }
    };

    window.acknowledgeUpdate = async function(updateId) {
        try {
            const response = await fetch(`/api/system-updates/${updateId}/acknowledge`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                closeUpdatePopup();
                // Show success message if showToast is available
                if (typeof showToast === 'function') {
                    showToast('Update acknowledged successfully', 'success');
                }
            } else {
                console.error('Failed to acknowledge update');
            }
        } catch (error) {
            console.error('Error acknowledging update:', error);
        }
    };

    // Add CSS styles
    const style = document.createElement('style');
    style.textContent = `
        #updateNotificationPopup {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 10000;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }

        #updateNotificationPopup.show {
            opacity: 1;
            visibility: visible;
        }

        .update-popup-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        }

        .update-popup {
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            transform: translateY(-20px);
            transition: transform 0.3s ease;
        }

        #updateNotificationPopup.show .update-popup {
            transform: translateY(0);
        }

        .update-popup-header {
            display: flex;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #e6e6e6;
            background: linear-gradient(135deg, #e63946 0%, #c1121f 100%);
            color: white;
            border-radius: 12px 12px 0 0;
        }

        .update-icon {
            font-size: 2rem;
            margin-right: 1rem;
        }

        .update-title {
            flex: 1;
        }

        .update-title h3 {
            margin: 0 0 0.25rem 0;
            font-size: 1.25rem;
        }

        .update-version {
            font-size: 0.875rem;
            opacity: 0.9;
        }

        .update-close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.5rem;
            border-radius: 4px;
            transition: background-color 0.2s;
        }

        .update-close-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .update-popup-body {
            padding: 1.5rem;
        }

        .update-header-info {
            margin-bottom: 1.5rem;
        }

        .update-header-info h4 {
            margin: 0 0 0.75rem 0;
            font-size: 1.125rem;
            color: #333;
        }

        .update-badges {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .badge {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge.release-patch {
            background: #e3f2fd;
            color: #1976d2;
        }

        .badge.release-minor {
            background: #e8f5e8;
            color: #2e7d32;
        }

        .badge.release-major {
            background: #ffebee;
            color: #d32f2f;
        }

        .badge.release-hotfix {
            background: #fff3e0;
            color: #f57c00;
        }

        .badge.priority-low {
            background: #e3f2fd;
            color: #1976d2;
        }

        .badge.priority-medium {
            background: #fff3e0;
            color: #f57c00;
        }

        .badge.priority-high {
            background: #ffebee;
            color: #d32f2f;
        }

        .badge.priority-critical {
            background: #f3e5f5;
            color: #7b1fa2;
        }

        .update-description {
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 6px;
            color: #555;
        }

        .update-description p {
            margin: 0;
            line-height: 1.5;
        }

        .update-changes {
            margin-bottom: 1.5rem;
        }

        .update-changes h4 {
            margin: 0 0 1rem 0;
            font-size: 1rem;
            color: #333;
        }

        .change-category {
            margin-bottom: 1rem;
        }

        .change-category h5 {
            margin: 0 0 0.5rem 0;
            font-size: 0.875rem;
            color: #e63946;
            font-weight: 600;
        }

        .change-category ul {
            margin: 0;
            padding-left: 1.25rem;
            list-style: none;
        }

        .change-category li {
            margin-bottom: 0.25rem;
            font-size: 0.875rem;
            color: #555;
            position: relative;
        }

        .change-category li::before {
            content: "•";
            color: #e63946;
            position: absolute;
            left: -1rem;
        }

        .change-category .more-items {
            font-style: italic;
            color: #888;
        }

        .acknowledgment-notice {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            background: rgba(230, 57, 70, 0.1);
            border: 1px solid #e63946;
            border-radius: 6px;
            margin-bottom: 1.5rem;
            color: #d32f2f;
            font-size: 0.875rem;
        }

        .acknowledgment-notice .material-symbols-outlined {
            font-size: 1.25rem;
            flex-shrink: 0;
        }

        .update-popup-footer {
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
            padding: 1.5rem;
            border-top: 1px solid #e6e6e6;
            background: #f8f9fa;
            border-radius: 0 0 12px 12px;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
        }

        .btn-primary {
            background: #e63946;
            color: white;
        }

        .btn-primary:hover {
            background: #c1121f;
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .btn-secondary:hover {
            background: #5a6268;
        }

        .material-symbols-outlined {
            font-size: 1rem;
        }

        @media (max-width: 600px) {
            .update-popup {
                margin: 0.5rem;
                max-width: none;
            }

            .update-popup-header {
                padding: 1rem;
            }

            .update-popup-body {
                padding: 1rem;
            }

            .update-popup-footer {
                padding: 1rem;
                flex-direction: column;
            }

            .btn {
                justify-content: center;
            }
        }
    `;
    document.head.appendChild(style);
})();