(function() {
    const vscode = acquireVsCodeApi();
    
    let currentGitStatus = null;
    let modifiedFiles = [];
    let selectedFilePath = null;

    // DOM elements
    const commitMessageInput = document.getElementById('commitMessage');
    const backdateInput = document.getElementById('backdateInput');
    const fileCheckboxList = document.getElementById('fileCheckboxList');
    const fileCountIndicator = document.getElementById('fileCountIndicator');
    const selectAllFilesBtn = document.getElementById('selectAllFiles');
    const selectNoneFilesBtn = document.getElementById('selectNoneFiles');
    const pushToRemoteCheckbox = document.getElementById('pushToRemote');
    const backdateBtn = document.getElementById('backdateBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const pushBtn = document.getElementById('pushBtn');
    const publishBtn = document.getElementById('publishBtn');
    const pushSection = document.getElementById('pushSection');
    const outputDiv = document.getElementById('output');
    const gitStatusDiv = document.getElementById('gitStatus');

    // Initialize
    function init() {
        console.log('Initializing extension...');
        setupEventListeners();
        setDefaultDateTime();
        requestGitStatus();
        requestModifiedFiles();
        updateFileCount(); // Ensure file count is initialized
        console.log('Extension initialized');
    }

    function setupEventListeners() {
        // File selection buttons
        if (selectAllFilesBtn) {
            selectAllFilesBtn.addEventListener('click', selectAllFiles);
        }
        if (selectNoneFilesBtn) {
            selectNoneFilesBtn.addEventListener('click', selectNoneFiles);
        }

        // Buttons
        backdateBtn.addEventListener('click', handleBackdateClick);
        refreshBtn.addEventListener('click', handleRefreshClick);
        
        if (pushBtn) {
            pushBtn.addEventListener('click', handlePushClick);
        }
        if (publishBtn) {
            publishBtn.addEventListener('click', handlePublishClick);
        }

        // Push option styling and functionality
        pushToRemoteCheckbox.addEventListener('change', function() {
            const pushOption = document.querySelector('.push-option');
            if (this.checked) {
                pushOption.classList.add('checked');
            } else {
                pushOption.classList.remove('checked');
            }
            
            // Legacy support for push section (if it exists)
            if (pushSection) {
                pushSection.style.display = this.checked ? 'block' : 'none';
            }
        });

        // Form validation
        commitMessageInput.addEventListener('input', validateForm);
        backdateInput.addEventListener('input', () => {
            validateForm();
            updateButtonText();
        });
    }

    function setDefaultDateTime() {
        const now = new Date();
        
        // Set max attribute to current time to prevent future dates
        const maxDateTime = new Date();
        maxDateTime.setMinutes(maxDateTime.getMinutes() - maxDateTime.getTimezoneOffset());
        backdateInput.max = maxDateTime.toISOString().slice(0, 16);
        
        // Set default to current time (so it shows "Create Commit" by default)
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        backdateInput.value = now.toISOString().slice(0, 16);
        console.log('Default date set to:', backdateInput.value);
        console.log('Max date set to:', backdateInput.max);
        updateButtonText();
    }

    function updateButtonText() {
        if (!backdateInput || !backdateBtn) {
            console.log('Missing elements for button text update');
            return;
        }
        
        const selectedDate = new Date(backdateInput.value);
        const now = new Date();
        
        // Check if the selected date is in the past (more than 10 minutes ago to be clearly a backdate)
        const diffMinutes = (now.getTime() - selectedDate.getTime()) / (1000 * 60);
        const isBackdate = diffMinutes > 10;
        
        const newText = isBackdate ? '⏰ Create Backdated Commit' : '✨ Create Commit';
        console.log('Time difference (minutes):', diffMinutes, 'Is backdate:', isBackdate);
        console.log('Updating button text to:', newText);
        backdateBtn.textContent = newText;
    }

    function handleBackdateClick() {
        if (!validateForm()) {
            return;
        }

        const commitMessage = commitMessageInput.value.trim();
        const backdateString = backdateInput.value;
        const pushToRemote = pushToRemoteCheckbox.checked;
        const selectedFiles = getSelectedFiles();

        if (!commitMessage) {
            showMessage('Please enter a commit message.', 'error');
            return;
        }

        if (!backdateString) {
            showMessage('Please select a backdate.', 'error');
            return;
        }

        if (selectedFiles.length === 0) {
            showMessage('Please select at least one file to commit.', 'error');
            return;
        }

        setLoading(true);
        
        vscode.postMessage({
            type: 'backdate',
            data: {
                commitMessage,
                backdateString,
                selectedFiles,
                pushToRemote
            }
        });
    }

    function handleRefreshClick() {
        setLoading(true);
        requestGitStatus();
        requestModifiedFiles();
    }

    function handlePushClick() {
        setLoading(true);
        vscode.postMessage({ type: 'pushToRemote' });
    }

    function handlePublishClick() {
        setLoading(true);
        vscode.postMessage({ type: 'publishBranch' });
    }

    function validateForm() {
        const commitMessage = commitMessageInput.value.trim();
        const backdateString = backdateInput.value;
        const selectedFiles = getSelectedFiles();

        const isValid = commitMessage && backdateString && selectedFiles.length > 0;
        const isGitRepo = currentGitStatus?.isGitRepo !== false; // Allow if status not loaded yet

        backdateBtn.disabled = !isValid || !isGitRepo;
        updateButtonText();
        return isValid;
    }

    function setLoading(isLoading) {
        const container = document.querySelector('.container');
        if (isLoading) {
            container.classList.add('loading');
            backdateBtn.disabled = true;
            refreshBtn.disabled = true;
        } else {
            container.classList.remove('loading');
            refreshBtn.disabled = false;
            validateForm();
        }
    }

    function getSelectedFiles() {
        const checkboxes = fileCheckboxList.querySelectorAll('input[type="checkbox"]:checked');
        const selectedFiles = Array.from(checkboxes).map(cb => cb.value);
        console.log('Selected files:', selectedFiles);
        return selectedFiles;
    }

    function selectAllFiles() {
        const checkboxes = fileCheckboxList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
        updateFileCount();
        validateForm();
    }

    function selectNoneFiles() {
        const checkboxes = fileCheckboxList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
        updateFileCount();
        validateForm();
    }

    function updateFileCount() {
        const selectedFiles = getSelectedFiles();
        const totalFiles = fileCheckboxList.querySelectorAll('input[type="checkbox"]').length;
        
        if (fileCountIndicator) {
            const emoji = selectedFiles.length === 0 ? '📭' : selectedFiles.length === totalFiles ? '📦' : '📊';
            fileCountIndicator.textContent = `${emoji} ${selectedFiles.length} of ${totalFiles} files selected`;
        }
        
        // Debug logging
        console.log('File count updated:', selectedFiles.length, 'of', totalFiles);
    }

    function populateModifiedFiles(files) {
        fileCheckboxList.innerHTML = '';
        
        if (!files || files.length === 0) {
            fileCheckboxList.innerHTML = '<p class="no-files">📂 No modified files found</p>';
            updateFileCount();
            validateForm();
            return;
        }

        files.forEach(file => {
            const div = document.createElement('div');
            div.className = 'file-checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `file-${file.replace(/[^a-zA-Z0-9]/g, '_')}`;
            checkbox.value = file;
            checkbox.addEventListener('change', () => {
                updateFileCount();
                validateForm();
            });
            
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = file;
            
            div.appendChild(checkbox);
            div.appendChild(label);
            fileCheckboxList.appendChild(div);
        });

        // Auto-select the file if it was passed from context menu
        if (selectedFilePath) {
            const targetCheckbox = fileCheckboxList.querySelector(`input[value="${selectedFilePath}"]`);
            if (targetCheckbox) {
                targetCheckbox.checked = true;
            }
        }

        updateFileCount();
        validateForm();
    }

    function requestGitStatus() {
        vscode.postMessage({ type: 'getGitStatus' });
    }

    function requestModifiedFiles() {
        vscode.postMessage({ type: 'getModifiedFiles' });
    }

    function showMessage(message, type = 'info') {
        const outputDiv = document.getElementById('output');
        if (!outputDiv) return;

        outputDiv.innerHTML = `<div class="message ${type}">${escapeHtml(message)}</div>`;
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                outputDiv.innerHTML = '';
            }, 5000);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function updateGitStatus(status) {
        currentGitStatus = status;
        
        if (!gitStatusDiv) return;

        if (status.isGitRepo) {
            const branchIcon = '🌿';
            const remoteIcon = status.hasRemote ? (status.hasUpstream ? '🔗' : '🔌') : '📡';
            const branchInfo = status.currentBranch ? `${branchIcon} ${status.currentBranch}` : '🌿 No branch';
            const remoteInfo = status.hasRemote ? 
                (status.hasUpstream ? `${remoteIcon} Connected` : `${remoteIcon} No upstream`) : 
                `${remoteIcon} No remote`;
            
            gitStatusDiv.innerHTML = `
                <div class="git-info">
                    <span class="git-branch">${branchInfo}</span>
                    <span class="git-remote">${remoteInfo}</span>
                </div>
            `;
            gitStatusDiv.classList.add('populated');
        } else {
            gitStatusDiv.innerHTML = '<div class="git-error">❌ Not a Git repository</div>';
            gitStatusDiv.classList.add('populated');
        }
        
        validateForm();
    }

    // Message handling
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'gitStatus':
                updateGitStatus(message.data);
                setLoading(false);
                break;
                
            case 'modifiedFiles':
                modifiedFiles = message.files || [];
                populateModifiedFiles(modifiedFiles);
                setLoading(false);
                break;
                
            case 'backdateResult':
                setLoading(false);
                if (message.success) {
                    showMessage('✅ Backdated commit created successfully!', 'success');
                    requestGitStatus();
                    requestModifiedFiles();
                } else {
                    showMessage(`❌ Failed to create backdated commit: ${message.error}`, 'error');
                }
                break;
                
            case 'pushResult':
                setLoading(false);
                if (message.success) {
                    showMessage('🚀 Successfully pushed to remote!', 'success');
                } else {
                    showMessage(`❌ Failed to push: ${message.error}`, 'error');
                }
                break;
                
            case 'publishResult':
                setLoading(false);
                if (message.success) {
                    showMessage('🌟 Successfully published branch!', 'success');
                } else {
                    showMessage(`❌ Failed to publish: ${message.error}`, 'error');
                }
                break;
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
