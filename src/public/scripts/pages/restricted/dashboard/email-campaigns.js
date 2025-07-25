// Email Campaigns Management
document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // State management
    let currentPage = 1;
    let totalPages = 1;
    let campaigns = [];
    let mailingLists = [];
    let selectedCampaignId = null;
    let filters = {
        search: '',
        status: 'all',
        list_id: 'all',
        campaign_type: 'all'
    };

    // Configure API utility
    api.setConfig({
        baseURL: '/api',
        timeout: 15000
    });

    // Initialize
    init();

    async function init() {
        await loadMailingLists();
        await loadCampaigns();
        initializeEventListeners();
    }

    // Event Listeners
    function initializeEventListeners() {
        // Search and filters
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        statusFilter.addEventListener('change', handleFilterChange);
        listFilter.addEventListener('change', handleFilterChange);
        typeFilter.addEventListener('change', handleFilterChange);

        // Create campaign button
        createCampaignBtn.addEventListener('click', showCreateModal);

        // Form submission
        campaignForm.addEventListener('submit', handleFormSubmit);
        saveDraftBtn.addEventListener('click', () => handleFormSubmit(null, true));

        // Pagination
        document.getElementById('prevPageBtn').addEventListener('click', () => changePage(currentPage - 1));
        document.getElementById('nextPageBtn').addEventListener('click', () => changePage(currentPage + 1));

        // Modal close handlers
        window.addEventListener('click', (e) => {
            if (e.target === campaignModal) closeModal();
            if (e.target === document.getElementById('campaignDetailsModal')) closeCampaignDetails();
            if (e.target === document.getElementById('deleteModal')) closeDeleteModal();
        });

        // Editor initialization
        initializeEditor();
    }

    // Initialize HTML editor
    function initializeEditor() {
        const htmlEditor = document.getElementById('htmlEditor');
        const contentHtml = document.getElementById('contentHtml');
        const tabButtons = document.querySelectorAll('.tab-button');
        const toolbarButtons = document.querySelectorAll('.toolbar-btn');

        // Tab switching
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                const targetTab = this.dataset.tab;
                
                // Update active states
                tabButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Show/hide tabs
                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                });
                document.getElementById(targetTab + 'Tab').classList.add('active');
            });
        });

        // Editor toolbar
        toolbarButtons.forEach(button => {
            button.addEventListener('click', function() {
                const command = this.dataset.command;
                handleEditorCommand(command);
            });
        });

        // Format dropdown
        const formatSelect = document.getElementById('formatSelect');
        formatSelect.addEventListener('change', function() {
            const format = this.value;
            if (format) {
                handleFormatChange(format);
                this.value = ''; // Reset to default
            }
        });

        // Sync HTML editor with textarea
        htmlEditor.addEventListener('input', function() {
            contentHtml.value = this.innerHTML;
        });

        // Handle empty editor state
        htmlEditor.addEventListener('focus', function() {
            if (this.innerHTML.trim() === '' || this.innerHTML === '<br>') {
                this.innerHTML = '<p><br></p>';
                // Place cursor in the paragraph
                const range = document.createRange();
                const selection = window.getSelection();
                range.setStart(this.firstChild, 0);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });

        // Prevent editor from becoming completely empty
        htmlEditor.addEventListener('keydown', function(e) {
            // If user presses backspace/delete and editor would become empty
            if ((e.key === 'Backspace' || e.key === 'Delete')) {
                if (this.textContent.trim().length <= 1) {
                    setTimeout(() => {
                        if (this.innerHTML.trim() === '' || this.innerHTML === '<br>') {
                            this.innerHTML = '<p><br></p>';
                            const range = document.createRange();
                            const selection = window.getSelection();
                            range.setStart(this.firstChild, 0);
                            range.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    }, 10);
                }
            }
        });

        // Components dropdown
        initializeComponentsDropdown();

        // Button editing functionality
        initializeButtonEditing();

        // Initialize paste handling for images
        initializePasteHandling();

        // Initialize image resizing
        initializeImageResizing();
    }

    // Handle editor commands
    function handleEditorCommand(command) {
        const htmlEditor = document.getElementById('htmlEditor');
        
        switch(command) {
            case 'bold':
                document.execCommand('bold', false, null);
                break;
            case 'italic':
                document.execCommand('italic', false, null);
                break;
            case 'underline':
                document.execCommand('underline', false, null);
                break;
            case 'link':
                const url = prompt('Enter URL:');
                if (url) {
                    document.execCommand('createLink', false, url);
                }
                break;
            case 'image':
                handleImageInsert();
                break;
            case 'insertVariable':
                showVariableMenu();
                break;
        }
        
        htmlEditor.focus();
    }

    // Handle format changes from dropdown
    function handleFormatChange(format) {
        const htmlEditor = document.getElementById('htmlEditor');
        
        // Focus the editor first
        htmlEditor.focus();
        
        try {
            // Apply the format using execCommand
            switch(format) {
                case 'p':
                    document.execCommand('formatBlock', false, '<p>');
                    break;
                case 'h1':
                    document.execCommand('formatBlock', false, '<h1>');
                    break;
                case 'h2':
                    document.execCommand('formatBlock', false, '<h2>');
                    break;
                case 'h3':
                    document.execCommand('formatBlock', false, '<h3>');
                    break;
                case 'h4':
                    document.execCommand('formatBlock', false, '<h4>');
                    break;
                case 'blockquote':
                    document.execCommand('formatBlock', false, '<blockquote>');
                    break;
                case 'pre':
                    document.execCommand('formatBlock', false, '<pre>');
                    break;
                default:
                    console.log('Unknown format:', format);
            }
        } catch (error) {
            console.error('Error applying format:', error);
            
            // Fallback: wrap selection in appropriate tag
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const selectedText = range.toString();
                
                if (selectedText) {
                    const wrapper = document.createElement(format);
                    wrapper.textContent = selectedText;
                    range.deleteContents();
                    range.insertNode(wrapper);
                    
                    // Clear selection and position cursor after element
                    selection.removeAllRanges();
                    const newRange = document.createRange();
                    newRange.setStartAfter(wrapper);
                    newRange.collapse(true);
                    selection.addRange(newRange);
                }
            }
        }
        
        // Update the hidden textarea
        document.getElementById('contentHtml').value = htmlEditor.innerHTML;
    }


    // Show variable insertion menu
    function showVariableMenu() {
        const variables = [
            { name: 'Recipient Name', value: '{{name}}' },
            { name: 'Recipient Name (Alternative)', value: '{{recipient_name}}' },
            { name: 'Unsubscribe Link', value: '{{unsubscribe_url}}' }
        ];
        
        const menu = document.createElement('div');
        menu.className = 'variable-menu';
        menu.innerHTML = variables.map(v => 
            `<div class="variable-item" data-value="${v.value}">${v.name}</div>`
        ).join('');
        
        document.body.appendChild(menu);
        
        menu.addEventListener('click', function(e) {
            if (e.target.classList.contains('variable-item')) {
                document.execCommand('insertText', false, e.target.dataset.value);
                menu.remove();
            }
        });
        
        // Remove menu on outside click
        setTimeout(() => {
            document.addEventListener('click', function removeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', removeMenu);
                }
            });
        }, 100);
    }

    // Handle image insertion
    function handleImageInsert() {
        const imageUpload = document.getElementById('imageUpload');
        imageUpload.click();
    }

    // Handle image file selection
    document.getElementById('imageUpload').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            insertImageFromFile(file);
        }
        // Clear the input so the same file can be selected again
        e.target.value = '';
    });

    // Insert image from file
    function insertImageFromFile(file) {
        // Check file size first
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            showToast('Image too large. Please use an image smaller than 5MB.', 'error');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            // Create canvas for compression
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const tempImg = new Image();
            
            tempImg.onload = function() {
                // Calculate new dimensions (max 1200px width)
                const maxWidth = 1200;
                const maxHeight = 1200;
                let { width, height } = tempImg;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(tempImg, 0, 0, width, height);
                
                // Convert to blob with compression
                canvas.toBlob(function(blob) {
                    const compressedReader = new FileReader();
                    compressedReader.onload = function(compressedEvent) {
                        const img = document.createElement('img');
                        img.src = compressedEvent.target.result;
                        img.style.maxWidth = '100%';
                        img.style.height = 'auto';
                        img.style.cursor = 'pointer';
                        img.alt = file.name || 'Inserted image';
                        img.className = 'resizable-image';
                        
                        // Insert the image at cursor position
                        const htmlEditor = document.getElementById('htmlEditor');
                        htmlEditor.focus();
                        
                        try {
                            document.execCommand('insertHTML', false, img.outerHTML);
                        } catch (error) {
                            // Fallback: insert at the end
                            const selection = window.getSelection();
                            const range = document.createRange();
                            
                            if (htmlEditor.lastChild) {
                                range.setStartAfter(htmlEditor.lastChild);
                            } else {
                                range.setStart(htmlEditor, 0);
                            }
                            range.collapse(true);
                            range.insertNode(img);
                            
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                        
                        // Update the hidden textarea
                        document.getElementById('contentHtml').value = htmlEditor.innerHTML;
                        
                        // Show compression info
                        const originalSize = (file.size / 1024).toFixed(1);
                        const compressedSize = (blob.size / 1024).toFixed(1);
                        showToast(`Image inserted (${originalSize}KB → ${compressedSize}KB)`, 'success');
                    };
                    compressedReader.readAsDataURL(blob);
                }, 'image/jpeg', 0.8); // 80% quality JPEG
            };
            
            tempImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Handle paste events for images
    function initializePasteHandling() {
        const htmlEditor = document.getElementById('htmlEditor');
        
        htmlEditor.addEventListener('paste', function(e) {
            // Check if clipboard contains files
            const items = e.clipboardData.items;
            let hasImage = false;
            
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    hasImage = true;
                    
                    const file = item.getAsFile();
                    if (file) {
                        insertImageFromFile(file);
                    }
                    break;
                }
            }
            
            // If no image was found, let the default paste behavior proceed
            if (!hasImage) {
                // Allow default paste but clean up the content
                setTimeout(() => {
                    document.getElementById('contentHtml').value = htmlEditor.innerHTML;
                }, 10);
            }
        });
    }

    // Initialize image resizing functionality
    function initializeImageResizing() {
        const htmlEditor = document.getElementById('htmlEditor');
        
        // Add click event for images
        htmlEditor.addEventListener('click', function(e) {
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                e.stopPropagation();
                showImageResizeModal(e.target);
            }
        });
    }

    // Show image resize modal
    function showImageResizeModal(imageElement) {
        // Remove any existing modal
        const existingModal = document.querySelector('.image-resize-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Get current image dimensions
        const currentWidth = imageElement.style.width || imageElement.offsetWidth + 'px';
        const currentHeight = imageElement.style.height || 'auto';
        const maxWidth = imageElement.style.maxWidth || '100%';

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'image-resize-modal';
        modal.innerHTML = `
            <div class="image-resize-overlay"></div>
            <div class="image-resize-content">
                <div class="image-resize-header">
                    <h3>Resize Image</h3>
                    <button class="close-btn" onclick="closeImageResizeModal()">&times;</button>
                </div>
                <div class="image-resize-body">
                    <div class="resize-preview">
                        <img src="${imageElement.src}" alt="${imageElement.alt}" class="preview-image">
                    </div>
                    <div class="resize-controls">
                        <div class="size-presets">
                            <h4>Quick Sizes</h4>
                            <div class="preset-buttons">
                                <button class="preset-btn" data-size="small">Small (200px)</button>
                                <button class="preset-btn" data-size="medium">Medium (400px)</button>
                                <button class="preset-btn" data-size="large">Large (600px)</button>
                                <button class="preset-btn" data-size="full">Full Width (100%)</button>
                            </div>
                        </div>
                        <div class="custom-size">
                            <h4>Custom Size</h4>
                            <div class="size-inputs">
                                <div class="input-group">
                                    <label>Width:</label>
                                    <input type="number" id="imageWidth" placeholder="Width" min="10" max="800">
                                    <select id="widthUnit">
                                        <option value="px">px</option>
                                        <option value="%">%</option>
                                    </select>
                                </div>
                                <div class="input-group">
                                    <label>Max Width:</label>
                                    <input type="text" id="imageMaxWidth" value="100%" placeholder="e.g. 100%, 600px">
                                </div>
                            </div>
                        </div>
                        <div class="alignment-controls">
                            <h4>Alignment</h4>
                            <div class="alignment-buttons">
                                <button class="align-btn" data-align="left">
                                    <span class="material-symbols-outlined">format_align_left</span>
                                    Left
                                </button>
                                <button class="align-btn" data-align="center">
                                    <span class="material-symbols-outlined">format_align_center</span>
                                    Center
                                </button>
                                <button class="align-btn" data-align="right">
                                    <span class="material-symbols-outlined">format_align_right</span>
                                    Right
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="image-resize-footer">
                    <button class="btn btn-secondary" onclick="closeImageResizeModal()">Cancel</button>
                    <button class="btn btn-danger" id="deleteImageBtn">Delete Image</button>
                    <button class="btn btn-primary" id="applyResizeBtn">Apply Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        setupImageResizeEvents(modal, imageElement);

        // Show modal
        setTimeout(() => modal.classList.add('show'), 10);
    }

    // Setup image resize modal events
    function setupImageResizeEvents(modal, imageElement) {
        const previewImage = modal.querySelector('.preview-image');
        const widthInput = modal.querySelector('#imageWidth');
        const widthUnit = modal.querySelector('#widthUnit');
        const maxWidthInput = modal.querySelector('#imageMaxWidth');
        const applyBtn = modal.querySelector('#applyResizeBtn');
        const deleteBtn = modal.querySelector('#deleteImageBtn');

        // Parse current width
        const currentWidth = imageElement.style.width;
        if (currentWidth) {
            const match = currentWidth.match(/(\d+)(px|%)/);
            if (match) {
                widthInput.value = match[1];
                widthUnit.value = match[2];
            }
        }

        // Preset buttons
        modal.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const size = this.dataset.size;
                let width, unit, maxWidth;
                
                switch(size) {
                    case 'small':
                        width = 200;
                        unit = 'px';
                        maxWidth = '100%';
                        break;
                    case 'medium':
                        width = 400;
                        unit = 'px';
                        maxWidth = '100%';
                        break;
                    case 'large':
                        width = 600;
                        unit = 'px';
                        maxWidth = '100%';
                        break;
                    case 'full':
                        width = 100;
                        unit = '%';
                        maxWidth = '100%';
                        break;
                }
                
                widthInput.value = width;
                widthUnit.value = unit;
                maxWidthInput.value = maxWidth;
                updatePreview();
            });
        });

        // Alignment buttons
        modal.querySelectorAll('.align-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                modal.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
                
                const align = this.dataset.align;
                const container = previewImage.parentElement;
                container.style.textAlign = align;
            });
        });

        // Input changes
        widthInput.addEventListener('input', updatePreview);
        widthUnit.addEventListener('change', updatePreview);
        maxWidthInput.addEventListener('input', updatePreview);

        function updatePreview() {
            const width = widthInput.value;
            const unit = widthUnit.value;
            const maxWidth = maxWidthInput.value;
            
            if (width) {
                previewImage.style.width = width + unit;
            } else {
                previewImage.style.width = '';
            }
            
            if (maxWidth) {
                previewImage.style.maxWidth = maxWidth;
            }
        }

        // Apply changes
        applyBtn.addEventListener('click', function() {
            const width = widthInput.value;
            const unit = widthUnit.value;
            const maxWidth = maxWidthInput.value;
            const activeAlign = modal.querySelector('.align-btn.active');
            
            // Apply size changes
            if (width) {
                imageElement.style.width = width + unit;
            } else {
                imageElement.style.removeProperty('width');
            }
            
            if (maxWidth) {
                imageElement.style.maxWidth = maxWidth;
            }
            
            // Apply alignment changes
            if (activeAlign) {
                const align = activeAlign.dataset.align;
                let wrapper = imageElement.parentElement;
                
                // Create wrapper if needed
                if (wrapper.tagName !== 'DIV' || !wrapper.style.textAlign) {
                    const newWrapper = document.createElement('div');
                    newWrapper.style.textAlign = align;
                    imageElement.parentNode.insertBefore(newWrapper, imageElement);
                    newWrapper.appendChild(imageElement);
                } else {
                    wrapper.style.textAlign = align;
                }
            }
            
            // Update the hidden textarea
            document.getElementById('contentHtml').value = document.getElementById('htmlEditor').innerHTML;
            
            showToast('Image resized successfully', 'success');
            closeImageResizeModal();
        });

        // Delete image
        deleteBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to delete this image?')) {
                imageElement.remove();
                document.getElementById('contentHtml').value = document.getElementById('htmlEditor').innerHTML;
                showToast('Image deleted', 'success');
                closeImageResizeModal();
            }
        });
    }

    // Close image resize modal
    window.closeImageResizeModal = function() {
        const modal = document.querySelector('.image-resize-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    };

    // Store last cursor position for component insertion
    let lastCursorPosition = null;

    // Initialize components dropdown
    function initializeComponentsDropdown() {
        const componentsBtn = document.getElementById('componentsBtn');
        const componentsMenu = document.getElementById('componentsMenu');
        const componentItems = document.querySelectorAll('.component-item');
        const htmlEditor = document.getElementById('htmlEditor');

        // Store cursor position when editor selection changes
        htmlEditor.addEventListener('selectionchange', storeCursorPosition);
        document.addEventListener('selectionchange', storeCursorPosition);

        // Toggle dropdown
        componentsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Store current cursor position before opening dropdown
            storeCursorPosition();
            
            componentsMenu.classList.toggle('show');
        });

        // Handle component selection
        componentItems.forEach(item => {
            item.addEventListener('click', function() {
                const componentType = this.dataset.component;
                
                // Restore cursor position if we have one stored
                if (lastCursorPosition) {
                    restoreCursorPosition();
                }
                
                insertComponent(componentType);
                componentsMenu.classList.remove('show');
                
                // Clear stored position after use
                lastCursorPosition = null;
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!componentsBtn.contains(e.target) && !componentsMenu.contains(e.target)) {
                componentsMenu.classList.remove('show');
            }
        });
    }

    // Store current cursor position
    function storeCursorPosition() {
        const selection = window.getSelection();
        const htmlEditor = document.getElementById('htmlEditor');
        
        if (selection.rangeCount > 0 && htmlEditor.contains(selection.anchorNode)) {
            lastCursorPosition = {
                startContainer: selection.anchorNode,
                startOffset: selection.anchorOffset,
                endContainer: selection.focusNode,
                endOffset: selection.focusOffset
            };
        }
    }

    // Restore cursor position
    function restoreCursorPosition() {
        if (!lastCursorPosition) return;
        
        try {
            const range = document.createRange();
            const selection = window.getSelection();
            
            range.setStart(lastCursorPosition.startContainer, lastCursorPosition.startOffset);
            range.setEnd(lastCursorPosition.endContainer, lastCursorPosition.endOffset);
            
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Focus the editor
            document.getElementById('htmlEditor').focus();
        } catch (error) {
            console.log('Could not restore cursor position:', error);
            // Fallback: place cursor at end
            const htmlEditor = document.getElementById('htmlEditor');
            htmlEditor.focus();
        }
    }

    // Initialize button editing functionality
    function initializeButtonEditing() {
        const htmlEditor = document.getElementById('htmlEditor');
        
        // Handle clicks on buttons within the editor
        htmlEditor.addEventListener('click', function(e) {
            // Check if clicked element is a button link
            if (e.target.tagName === 'A' && e.target.closest('[style*="text-align: center"]')) {
                e.preventDefault();
                e.stopPropagation();
                editButtonUrl(e.target);
            }
        });
    }

    // Edit button URL and text
    function editButtonUrl(buttonElement) {
        const currentUrl = buttonElement.getAttribute('href') || '#';
        const currentText = buttonElement.textContent || 'Click Here';
        
        // Create modal for editing button
        const modal = createButtonEditModal(currentUrl, currentText, buttonElement);
        document.body.appendChild(modal);
    }

    // Create button edit modal
    function createButtonEditModal(currentUrl, currentText, buttonElement) {
        const modal = document.createElement('div');
        modal.className = 'modal button-edit-modal show';
        modal.innerHTML = `
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3>Edit Button</h3>
                    <button class="close-btn" onclick="closeButtonEditModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="buttonText">Button Text</label>
                        <input type="text" id="buttonText" value="${escapeHtml(currentText)}" placeholder="Enter button text">
                    </div>
                    <div class="form-group">
                        <label for="buttonUrl">Button URL</label>
                        <input type="url" id="buttonUrl" value="${escapeHtml(currentUrl)}" placeholder="https://example.com">
                        <div class="field-help">Enter the full URL including https://</div>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="buttonNewTab" ${currentUrl !== '#' ? 'checked' : ''}>
                            Open in new tab
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeButtonEditModal()">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="saveButtonChanges()">Save Changes</button>
                </div>
            </div>
        `;

        // Store button element reference
        modal.buttonElement = buttonElement;

        // Handle escape key
        modal.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeButtonEditModal();
            }
        });

        // Focus the text input
        setTimeout(() => {
            const textInput = modal.querySelector('#buttonText');
            textInput.focus();
            textInput.select();
        }, 100);

        return modal;
    }

    // Save button changes
    window.saveButtonChanges = function() {
        const modal = document.querySelector('.button-edit-modal');
        if (!modal || !modal.buttonElement) return;

        const buttonElement = modal.buttonElement;
        const newText = document.getElementById('buttonText').value.trim();
        const newUrl = document.getElementById('buttonUrl').value.trim();
        const openInNewTab = document.getElementById('buttonNewTab').checked;

        // Validate inputs
        if (!newText) {
            alert('Button text is required');
            document.getElementById('buttonText').focus();
            return;
        }

        if (!newUrl || newUrl === '#') {
            if (!confirm('No URL specified. The button will not be clickable. Continue?')) {
                document.getElementById('buttonUrl').focus();
                return;
            }
        }

        // Update button
        buttonElement.textContent = newText;
        buttonElement.setAttribute('href', newUrl || '#');
        
        if (openInNewTab && newUrl && newUrl !== '#') {
            buttonElement.setAttribute('target', '_blank');
            buttonElement.setAttribute('rel', 'noopener noreferrer');
        } else {
            buttonElement.removeAttribute('target');
            buttonElement.removeAttribute('rel');
        }

        // Update the hidden textarea
        document.getElementById('contentHtml').value = document.getElementById('htmlEditor').innerHTML;

        // Close modal
        closeButtonEditModal();

        // Show success message
        showToast('Button updated successfully!', 'success');
    };

    // Close button edit modal
    window.closeButtonEditModal = function() {
        const modal = document.querySelector('.button-edit-modal');
        if (modal) {
            modal.remove();
        }
    };

    // Utility function to escape HTML
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
    }

    // Simple toast notification function
    function showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.component-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `component-toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Insert component into editor
    function insertComponent(componentType) {
        const htmlEditor = document.getElementById('htmlEditor');
        const componentHTML = getComponentHTML(componentType);
        
        // Ensure editor has focus
        htmlEditor.focus();
        
        // Store current selection/cursor position
        const selection = window.getSelection();
        let range = null;
        
        // Get or create a valid range
        if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
        } else {
            // No selection, create one at the end of the editor
            range = document.createRange();
            if (htmlEditor.lastChild) {
                range.setStartAfter(htmlEditor.lastChild);
            } else {
                // Editor is empty
                htmlEditor.innerHTML = '<p><br></p>';
                range.setStart(htmlEditor.firstChild, 0);
            }
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        // If we're inside a component, move cursor outside of it
        let containerElement = range.startContainer;
        while (containerElement && containerElement !== htmlEditor) {
            // Check if we're inside a component (div with inline styles)
            if (containerElement.nodeType === Node.ELEMENT_NODE && 
                containerElement.tagName === 'DIV' && 
                containerElement.style.length > 0) {
                // Move cursor after the component
                range = document.createRange();
                range.setStartAfter(containerElement);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                break;
            }
            containerElement = containerElement.parentNode;
        }
        
        // Insert the component using execCommand
        try {
            const success = document.execCommand('insertHTML', false, componentHTML);
            if (!success) {
                throw new Error('execCommand failed');
            }
        } catch (error) {
            // Fallback method
            insertComponentFallback(htmlEditor, componentHTML, range);
        }
        
        // Add some space after the component for easier editing
        try {
            document.execCommand('insertHTML', false, '<p><br></p>');
        } catch (error) {
            // Fallback: add paragraph manually
            const newParagraph = document.createElement('p');
            newParagraph.innerHTML = '<br>';
            const currentSelection = window.getSelection();
            if (currentSelection.rangeCount > 0) {
                const currentRange = currentSelection.getRangeAt(0);
                currentRange.collapse(false);
                currentRange.insertNode(newParagraph);
                currentRange.setStartAfter(newParagraph);
                currentRange.collapse(true);
                currentSelection.removeAllRanges();
                currentSelection.addRange(currentRange);
            }
        }
        
        // Update the hidden textarea
        document.getElementById('contentHtml').value = htmlEditor.innerHTML;
        
        // Ensure editor maintains focus
        htmlEditor.focus();
    }
    
    // Fallback method for inserting components
    function insertComponentFallback(htmlEditor, componentHTML, providedRange = null) {
        const selection = window.getSelection();
        let range = providedRange;
        
        // Use provided range or get current selection
        if (!range && selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
        }
        
        if (range) {
            // Create a container element for the component
            const container = document.createElement('div');
            container.innerHTML = componentHTML;
            
            // Insert the content
            const fragment = document.createDocumentFragment();
            while (container.firstChild) {
                fragment.appendChild(container.firstChild);
            }
            
            // Clear current selection and insert
            range.deleteContents();
            range.insertNode(fragment);
            
            // Add a paragraph after for easier editing
            const newParagraph = document.createElement('p');
            newParagraph.innerHTML = '<br>';
            range.collapse(false);
            range.insertNode(newParagraph);
            
            // Move cursor to the new paragraph
            range.setStart(newParagraph, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // If no selection, insert at the end
            if (htmlEditor.innerHTML.trim() === '' || htmlEditor.innerHTML === '<br>') {
                htmlEditor.innerHTML = componentHTML + '<p><br></p>';
            } else {
                htmlEditor.insertAdjacentHTML('beforeend', componentHTML + '<p><br></p>');
            }
            
            // Create a new cursor position at the end
            const newRange = document.createRange();
            const newSelection = window.getSelection();
            if (htmlEditor.lastChild) {
                newRange.setStart(htmlEditor.lastChild, 0);
                newRange.collapse(true);
                newSelection.removeAllRanges();
                newSelection.addRange(newRange);
            }
        }
    }

    // Get component HTML based on type
    function getComponentHTML(componentType) {
        const components = {
            'primary-button': '<div style="text-align: center; margin: 20px 0;"><a href="#" style="display: inline-block; background: #e63946; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Click Here</a></div>',
            
            'secondary-button': '<div style="text-align: center; margin: 20px 0;"><a href="#" style="display: inline-block; background: #f8f9fa; color: #333; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; border: 2px solid #ddd;">Learn More</a></div>',
            
            'info-card': '<div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;"><div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;"><span style="font-size: 24px;">📋</span><h3 style="margin: 0; color: #333; font-size: 18px;">Information</h3></div><p style="margin: 0; color: #666; line-height: 1.6;">This is an important piece of information that you should know about.</p></div>',
            
            'alert-card': '<div style="background: #fff9e6; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 20px 0;"><div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;"><span style="font-size: 24px;">⚠️</span><h3 style="margin: 0; color: #b8860b; font-size: 18px;">Important Alert</h3></div><p style="margin: 0; color: #996515; line-height: 1.6;">Please pay attention to this important alert message.</p></div>',
            
            'announcement-banner': '<div style="background: #e3f2fd; border-left: 4px solid #1976d2; padding: 16px; margin: 20px 0; border-radius: 4px;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 24px;">📢</span><div><h3 style="margin: 0 0 4px 0; color: #1976d2; font-size: 18px;">Announcement</h3><p style="margin: 0; color: #1565c0; line-height: 1.6;">We have an important announcement to share with you.</p></div></div></div>',
            
            'feature-banner': '<div style="background: #f3e5f5; border-left: 4px solid #7b1fa2; padding: 16px; margin: 20px 0; border-radius: 4px;"><div style="display: flex; align-items: center; gap: 12px;"><span style="font-size: 24px;">✨</span><div><h3 style="margin: 0 0 4px 0; color: #7b1fa2; font-size: 18px;">New Feature</h3><p style="margin: 0; color: #6a1b9a; line-height: 1.6;">Check out this exciting new feature we\'ve added for you.</p></div></div></div>',
            
            'divider': '<div style="margin: 30px 0;"><hr style="border: none; height: 2px; background: #e63946; border-radius: 1px;"></div>',
            
            'spacer': '<div style="margin: 40px 0;"></div>'
        };

        return components[componentType] || '';
    }

    // Load mailing lists
    async function loadMailingLists() {
        try {
            const params = {
                limit: 100,
                is_active: true
            };
            const response = await api.get('/mailing', { params });
            if (response.success && response.data) {
                mailingLists = response.data.lists || [];
                populateListFilters();
            }
        } catch (error) {
            console.error('Error loading mailing lists:', error);
        }
    }

    // Populate list filters
    function populateListFilters() {
        const listFilter = document.getElementById('listFilter');
        const campaignList = document.getElementById('campaignList');
        
        // Filter dropdown
        listFilter.innerHTML = '<option value="all">All Lists</option>';
        mailingLists.forEach(list => {
            listFilter.innerHTML += `<option value="${list.id}">${escapeHtml(list.name)}</option>`;
        });
        
        // Campaign form dropdown
        campaignList.innerHTML = '<option value="">Select a mailing list</option>';
        mailingLists.forEach(list => {
            campaignList.innerHTML += `<option value="${list.id}">${escapeHtml(list.name)} (${list.subscriber_count} subscribers)</option>`;
        });
    }

    // Load campaigns
    async function loadCampaigns() {
        try {
            showLoading(true);
            
            const params = {
                page: currentPage,
                limit: 10
            };
            
            // Add filters, excluding 'all' values
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== 'all' && value !== '') {
                    params[key] = value;
                }
            });
            
            const response = await api.get('/mailing/campaigns-all', { params });
            
            if (response.success && response.data) {
                campaigns = response.data.campaigns || [];
                updatePagination(response.data.pagination);
                renderCampaigns();
            }
        } catch (error) {
            console.error('Error loading campaigns:', error);
            showToast('Failed to load campaigns', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Render campaigns table
    function renderCampaigns() {
        if (campaigns.length === 0) {
            campaignsTable.style.display = 'none';
            emptyState.style.display = 'flex';
            paginationContainer.style.display = 'none';
            return;
        }

        campaignsTable.style.display = 'table';
        emptyState.style.display = 'none';
        paginationContainer.style.display = 'flex';

        campaignsBody.innerHTML = campaigns.map(campaign => `
            <tr>
                <td>${escapeHtml(campaign.name)}</td>
                <td>${escapeHtml(campaign.mailingList?.name || 'N/A')}</td>
                <td>${escapeHtml(campaign.subject)}</td>
                <td><span class="type-badge type-${campaign.campaign_type}">${campaign.campaign_type}</span></td>
                <td><span class="status-badge status-${campaign.status}">${campaign.status}</span></td>
                <td>${campaign.total_recipients || 0}</td>
                <td>${campaign.sent_at ? formatDate(campaign.sent_at) : '-'}</td>
                <td>
                    ${campaign.status === 'sent' ? `
                        <div class="performance-summary">
                            <span title="Open Rate">${campaign.open_rate || 0}% <span class="material-symbols-outlined">mail</span></span>
                            <span title="Click Rate">${campaign.click_rate || 0}% <span class="material-symbols-outlined">ads_click</span></span>
                        </div>
                    ` : '-'}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="viewCampaignDetails(${campaign.id})" title="View Details">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>
                        ${campaign.status === 'draft' ? `
                            <button class="btn-icon" onclick="editCampaign(${campaign.id})" title="Edit">
                                <span class="material-symbols-outlined">edit</span>
                            </button>
                            <button class="btn-icon" onclick="sendCampaign(${campaign.id})" title="Send">
                                <span class="material-symbols-outlined">send</span>
                            </button>
                        ` : ''}
                        ${campaign.status === 'scheduled' ? `
                            <button class="btn-icon" onclick="cancelCampaign(${campaign.id})" title="Cancel">
                                <span class="material-symbols-outlined">cancel</span>
                            </button>
                        ` : ''}
                        ${campaign.status === 'sent' ? `
                            <button class="btn-icon" onclick="viewAnalytics(${campaign.id})" title="Analytics">
                                <span class="material-symbols-outlined">analytics</span>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // View campaign details
    window.viewCampaignDetails = async function(campaignId) {
        try {
            const response = await api.get(`/mailing/campaign/${campaignId}`);
            if (response.success && response.data) {
                showCampaignDetails(response.data);
            }
        } catch (error) {
            console.error('Error loading campaign details:', error);
            showToast('Failed to load campaign details', 'error');
        }
    };

    // Show campaign details modal
    function showCampaignDetails(campaign) {
        const modal = document.getElementById('campaignDetailsModal');
        
        // Populate details
        document.getElementById('detailName').textContent = campaign.name;
        document.getElementById('detailSubject').textContent = campaign.subject;
        document.getElementById('detailStatus').textContent = campaign.status;
        document.getElementById('detailStatus').className = `status-badge status-${campaign.status}`;
        document.getElementById('detailType').textContent = campaign.campaign_type;
        document.getElementById('detailList').textContent = campaign.mailingList?.name || 'N/A';
        document.getElementById('detailCreator').textContent = campaign.creator?.full_name || campaign.creator?.username || 'Unknown';
        document.getElementById('detailSentDate').textContent = campaign.sent_at ? formatDate(campaign.sent_at) : 'Not sent';
        
        // Populate metrics
        document.getElementById('metricRecipients').textContent = campaign.total_recipients || 0;
        document.getElementById('metricDelivered').textContent = campaign.total_delivered || 0;
        document.getElementById('metricOpened').textContent = campaign.total_opened || 0;
        document.getElementById('metricOpenRate').textContent = `${campaign.open_rate || 0}%`;
        document.getElementById('metricClicked').textContent = campaign.total_clicked || 0;
        document.getElementById('metricClickRate').textContent = `${campaign.click_rate || 0}%`;
        document.getElementById('metricBounced').textContent = campaign.total_bounced || 0;
        document.getElementById('metricBounceRate').textContent = `${campaign.bounce_rate || 0}%`;
        
        // Show email content
        const emailPreview = document.getElementById('emailPreview');
        if (campaign.content_html) {
            emailPreview.innerHTML = `<iframe srcdoc="${escapeHtml(campaign.content_html)}" style="width: 100%; height: 400px; border: 1px solid #ddd;"></iframe>`;
        } else if (campaign.content_text) {
            emailPreview.innerHTML = `<pre style="white-space: pre-wrap;">${escapeHtml(campaign.content_text)}</pre>`;
        }
        
        modal.classList.add('show');
    }

    // Close campaign details modal
    window.closeCampaignDetails = function() {
        document.getElementById('campaignDetailsModal').classList.remove('show');
    };

    // Edit campaign
    window.editCampaign = async function(campaignId) {
        try {
            const response = await api.get(`/mailing/campaign/${campaignId}`);
            if (response.success && response.data) {
                showEditModal(response.data);
            }
        } catch (error) {
            console.error('Error loading campaign:', error);
            showToast('Failed to load campaign', 'error');
        }
    };

    // Send campaign
    window.sendCampaign = async function(campaignId) {
        if (!confirm('Are you sure you want to send this campaign now?')) return;
        
        try {
            const response = await api.post(`/mailing/campaign/${campaignId}/send`);
            if (response.success) {
                showToast('Campaign sent successfully!', 'success');
                loadCampaigns();
            } else {
                showToast(response.message || 'Failed to send campaign', 'error');
            }
        } catch (error) {
            console.error('Error sending campaign:', error);
            showToast('Failed to send campaign', 'error');
        }
    };

    // Cancel campaign
    window.cancelCampaign = function(campaignId) {
        selectedCampaignId = campaignId;
        const campaign = campaigns.find(c => c.id === campaignId);
        if (campaign) {
            document.getElementById('deleteCampaignName').textContent = campaign.name;
            document.getElementById('deleteModal').classList.add('show');
        }
    };

    // View analytics
    window.viewAnalytics = async function(campaignId) {
        try {
            const response = await api.get(`/mailing/campaign/${campaignId}/analytics`);
            if (response.success && response.data) {
                // For now, show in details modal
                viewCampaignDetails(campaignId);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
            showToast('Failed to load analytics', 'error');
        }
    };

    // Show create modal
    window.showCreateModal = function() {
        modalTitle.textContent = 'Create Email Campaign';
        campaignForm.reset();
        document.getElementById('campaignId').value = '';
        document.getElementById('htmlEditor').innerHTML = '';
        document.getElementById('contentHtml').value = '';
        sendCampaignBtn.style.display = 'inline-flex';
        saveDraftBtn.style.display = 'inline-flex';
        campaignModal.classList.add('show');
    };

    // Show edit modal
    function showEditModal(campaign) {
        modalTitle.textContent = 'Edit Email Campaign';
        document.getElementById('campaignId').value = campaign.id;
        document.getElementById('campaignList').value = campaign.list_id;
        document.getElementById('campaignType').value = campaign.campaign_type;
        document.getElementById('campaignName').value = campaign.name;
        document.getElementById('campaignSubject').value = campaign.subject;
        document.getElementById('senderEmail').value = campaign.sender_email || '';
        document.getElementById('senderName').value = campaign.sender_name || '';
        document.getElementById('replyTo').value = campaign.reply_to || '';
        
        if (campaign.content_html) {
            document.getElementById('htmlEditor').innerHTML = campaign.content_html;
            document.getElementById('contentHtml').value = campaign.content_html;
        }
        if (campaign.content_text) {
            document.getElementById('contentText').value = campaign.content_text;
        }
        
        if (campaign.scheduled_at) {
            document.getElementById('scheduledAt').value = campaign.scheduled_at.slice(0, 16);
        }
        
        campaignModal.classList.add('show');
    }

    // Close modal
    window.closeModal = function() {
        campaignModal.classList.remove('show');
        campaignForm.reset();
    };

    // Close delete modal
    window.closeDeleteModal = function() {
        document.getElementById('deleteModal').classList.remove('show');
        selectedCampaignId = null;
    };

    // Handle form submission
    async function handleFormSubmit(event, saveDraft = false) {
        if (event) event.preventDefault();
        
        const formData = new FormData(campaignForm);
        const campaignId = formData.get('id');
        const data = {};
        
        // Convert FormData to object
        for (const [key, value] of formData.entries()) {
            if (value) data[key] = value;
        }
        
        // Get HTML content from editor
        data.content_html = document.getElementById('contentHtml').value;
        
        // Validate required fields
        if (!data.list_id || !data.name || !data.subject || (!data.content_html && !data.content_text)) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        // Check content size and warn if large
        const contentSize = new Blob([JSON.stringify(data)]).size;
        const maxSafeSize = 8 * 1024 * 1024; // 8MB
        
        if (contentSize > maxSafeSize) {
            showToast('Campaign content is very large. Consider reducing image sizes.', 'warning');
        }
        
        try {
            let response;
            
            if (campaignId) {
                // Update existing campaign
                response = await api.put(`/mailing/campaign/${campaignId}`, data);
            } else {
                // Create new campaign
                const listId = data.list_id;
                delete data.list_id;
                response = await api.post(`/mailing/${listId}/campaigns`, data);
            }
            
            if (response.success) {
                const campaign = response.data;
                
                if (!saveDraft && campaign.status === 'draft') {
                    // Send the campaign
                    const sendResponse = await api.post(`/mailing/campaign/${campaign.id}/send`);
                    if (sendResponse.success) {
                        showToast('Campaign sent successfully!', 'success');
                    } else {
                        showToast(sendResponse.message || 'Campaign saved but failed to send', 'warning');
                    }
                } else {
                    showToast('Campaign saved as draft', 'success');
                }
                
                closeModal();
                loadCampaigns();
            } else {
                showToast(response.message || 'Failed to save campaign', 'error');
            }
        } catch (error) {
            console.error('Error saving campaign:', error);
            showToast('Failed to save campaign', 'error');
        }
    }

    // Confirm cancel campaign
    document.getElementById('confirmCancelBtn').addEventListener('click', async function() {
        if (!selectedCampaignId) return;
        
        try {
            const response = await api.post(`/mailing/campaign/${selectedCampaignId}/cancel`);
            if (response.success) {
                showToast('Campaign cancelled successfully', 'success');
                closeDeleteModal();
                loadCampaigns();
            } else {
                showToast(response.message || 'Failed to cancel campaign', 'error');
            }
        } catch (error) {
            console.error('Error cancelling campaign:', error);
            showToast('Failed to cancel campaign', 'error');
        }
    });

    // Handle search
    function handleSearch() {
        filters.search = searchInput.value;
        currentPage = 1;
        loadCampaigns();
    }

    // Handle filter change
    function handleFilterChange() {
        filters.status = statusFilter.value;
        filters.list_id = listFilter.value;
        filters.campaign_type = typeFilter.value;
        currentPage = 1;
        loadCampaigns();
    }

    // Change page
    function changePage(page) {
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        loadCampaigns();
    }

    // Update pagination
    function updatePagination(pagination) {
        if (!pagination) return;
        
        currentPage = pagination.page;
        totalPages = pagination.pages;
        
        document.getElementById('paginationInfo').textContent = 
            `Showing ${campaigns.length} of ${pagination.total} campaigns`;
        
        document.getElementById('prevPageBtn').disabled = currentPage === 1;
        document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
        
        // Update page numbers
        const pageNumbers = document.getElementById('pageNumbers');
        pageNumbers.innerHTML = '';
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.onclick = () => changePage(i);
                pageNumbers.appendChild(pageBtn);
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'page-ellipsis';
                ellipsis.textContent = '...';
                pageNumbers.appendChild(ellipsis);
            }
        }
    }

    // Show/hide loading
    function showLoading(show) {
        loadingSpinner.style.display = show ? 'flex' : 'none';
        campaignsTable.style.display = show ? 'none' : (campaigns.length > 0 ? 'table' : 'none');
        emptyState.style.display = show ? 'none' : (campaigns.length === 0 ? 'flex' : 'none');
    }

    // Note: Using global showToast function from main.js

    // Utility functions
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});