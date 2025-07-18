(function() {
    const vscode = acquireVsCodeApi();
    
    let currentGitStatus = null;
    let modifiedFiles = [];
    let selectedFilePath = null;

    // DOM elements
    const commitMessageInput = document.getElementById('commitMessage');
    const backdateInput = document.getElementById('backdateInput');
    const scopeFileRadio = document.getElementById('scopeFile');
    const scopeMultipleRadio = document.getElementById('scopeMultiple');
    const scopeAllRadio = document.getElementById('scopeAll');
    const fileSelectionDiv = document.getElementById('fileSelection');
    const multipleFileSelectionDiv = document.getElementById('multipleFileSelection');
    const fileSelect = document.getElementById('fileSelect');
    const fileCheckboxList = document.getElementById('fileCheckboxList');
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
    const warningSection = document.getElementById('warningSection');
    const warningMessage = document.getElementById('warningMessage');

    // Initialize
    function init() {
        setupEventListeners();
        setDefaultDateTime();
        requestGitStatus();
        requestModifiedFiles();
    }

    function setupEventListeners() {
        // Scope radio buttons
        scopeFileRadio.addEventListener('change', handleScopeChange);
        scopeMultipleRadio.addEventListener('change', handleScopeChange);
        scopeAllRadio.addEventListener('change', handleScopeChange);

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

        // Form validation
        commitMessageInput.addEventListener('input', validateForm);
        backdateInput.addEventListener('input', validateForm);
        fileSelect.addEventListener('change', validateForm);
    }

    function setDefaultDateTime() {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        backdateInput.value = now.toISOString().slice(0, 16);
    }

    function handleScopeChange() {
        const isFileScope = scopeFileRadio.checked;
        const isMultipleScope = scopeMultipleRadio.checked;
        const isAllScope = scopeAllRadio.checked;
        
        // Show/hide appropriate sections
        fileSelectionDiv.style.display = isFileScope ? 'block' : 'none';
        multipleFileSelectionDiv.style.display = isMultipleScope ? 'block' : 'none';
        
        // Check file history when file scope is selected
        if (isFileScope && (selectedFilePath || fileSelect.value)) {
            const filePath = fileSelect.value || selectedFilePath;
            if (filePath) {
                vscode.postMessage({ type: 'checkFileHistory', filePath });
            }
        } else {
            // Hide warning when not in single file scope
            if (warningSection) {
                warningSection.style.display = 'none';
            }
        }
        
        validateForm();
    }

    function handleBackdateClick() {
        if (!validateForm()) {
            return;
        }

        const commitMessage = commitMessageInput.value.trim();
        const backdateString = backdateInput.value;
        const isFileScope = scopeFileRadio.checked;
        const isMultipleScope = scopeMultipleRadio.checked;
        const isAllScope = scopeAllRadio.checked;
        const pushToRemote = pushToRemoteCheckbox.checked;

        if (!commitMessage) {
            showMessage('Please enter a commit message.', 'error');
            return;
        }

        if (!backdateString) {
            showMessage('Please select a backdate.', 'error');
            return;
        }

        let selectedFiles = [];
        let includeAllFiles = false;

        if (isFileScope) {
            const selectedFile = fileSelect.value || selectedFilePath;
            if (!selectedFile) {
                showMessage('Please select a file to commit.', 'error');
                return;
            }
            selectedFiles = [selectedFile];
        } else if (isMultipleScope) {
            selectedFiles = getSelectedFiles();
            if (selectedFiles.length === 0) {
                showMessage('Please select at least one file to commit.', 'error');
                return;
            }
        } else {
            includeAllFiles = true;
        }

        setLoading(true);
        
        vscode.postMessage({
            type: 'backdate',
            data: {
                commitMessage,
                backdateString,
                includeAllFiles,
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
        const isFileScope = scopeFileRadio.checked;
        const isMultipleScope = scopeMultipleRadio.checked;
        const selectedFile = fileSelect.value;
        const selectedFiles = isMultipleScope ? getSelectedFiles() : [];

        let isValid = commitMessage && backdateString;
        
        if (isFileScope) {
            isValid = isValid && (selectedFile || selectedFilePath);
        } else if (isMultipleScope) {
            isValid = isValid && selectedFiles.length > 0;
        }

        backdateBtn.disabled = !isValid || !currentGitStatus?.isGitRepo;
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

    function requestGitStatus() {
        vscode.postMessage({ type: 'checkGitStatus' });
    }

    function requestModifiedFiles() {
        vscode.postMessage({ type: 'getModifiedFiles' });
    }

    function updateGitStatus(status) {
        currentGitStatus = status;
        
        let statusHtml = '';
        
        if (status.isGitRepo) {
            statusHtml = `
                <div class="git-info">
                    <div>
                        <span class="status-indicator connected"></span>
                        <strong>Git Repository</strong>
                    </div>
                    <div class="git-branch">Branch: ${status.currentBranch || 'unknown'}</div>
                </div>
            `;
            
            // Show remote status
            if (status.hasRemote) {
                statusHtml += `
                    <div class="remote-status">
                        <span class="status-indicator connected"></span>
                        Remote configured: ${status.hasUpstream ? 'Branch published' : 'Branch not published'}
                    </div>
                `;
            } else {
                statusHtml += `
                    <div class="remote-status">
                        <span class="status-indicator disconnected"></span>
                        No remote repository configured
                    </div>
                `;
            }
            
            if (status.selectedFile) {
                selectedFilePath = status.selectedFile;
                const fileName = status.selectedFile.split('/').pop();
                const workspaceFolder = status.selectedFile.split('/').slice(-3, -1).join('/'); // Show some context
                statusHtml += `
                    <div class="selected-file">
                        📄 Selected file: <strong>${fileName}</strong>
                        <div class="file-path">Path: ${workspaceFolder}/${fileName}</div>
                    </div>
                `;
                scopeFileRadio.checked = true;
                handleScopeChange();
            }

            // Show/hide push section based on remote status
            if (status.hasRemote && pushSection) {
                pushSection.style.display = 'block';
                if (pushBtn) {
                    pushBtn.style.display = status.hasUpstream ? 'inline-block' : 'none';
                }
                if (publishBtn) {
                    publishBtn.style.display = !status.hasUpstream ? 'inline-block' : 'none';
                }
            } else if (pushSection) {
                pushSection.style.display = 'none';
            }
        } else {
            statusHtml = `
                <div class="git-info">
                    <div>
                        <span class="status-indicator disconnected"></span>
                        <strong>Not a Git Repository</strong>
                    </div>
                </div>
                <p>The current workspace is not a Git repository. Please initialize Git or open a Git repository.</p>
            `;
            
            if (pushSection) {
                pushSection.style.display = 'none';
            }
        }
        
        gitStatusDiv.innerHTML = statusHtml;
        validateForm();
    }

    function updateModifiedFiles(files) {
        modifiedFiles = files;
        
        // Update single file select dropdown
        fileSelect.innerHTML = '<option value="">Choose a file...</option>';
        
        if (files.length === 0) {
            fileSelect.innerHTML += '<option value="" disabled>No modified files</option>';
        } else {
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                fileSelect.appendChild(option);
            });
        }
        
        // Update multiple file checkboxes
        if (fileCheckboxList) {
            fileCheckboxList.innerHTML = '';
            
            if (files.length === 0) {
                fileCheckboxList.innerHTML = '<p class="no-files">No modified files available</p>';
            } else {
                files.forEach((file, index) => {
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.className = 'file-checkbox-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `file-${index}`;
                    checkbox.value = file;
                    checkbox.addEventListener('change', validateForm);
                    
                    const label = document.createElement('label');
                    label.htmlFor = `file-${index}`;
                    label.textContent = file;
                    
                    checkboxDiv.appendChild(checkbox);
                    checkboxDiv.appendChild(label);
                    fileCheckboxList.appendChild(checkboxDiv);
                });
            }
        }
        
        // Update file count display
        const fileCountText = files.length === 0 ? 'No modified files' : `${files.length} modified file${files.length === 1 ? '' : 's'}`;
        
        let existingFileCount = document.querySelector('.file-count');
        if (existingFileCount) {
            existingFileCount.textContent = fileCountText;
        } else {
            const fileCountDiv = document.createElement('div');
            fileCountDiv.className = 'file-count';
            fileCountDiv.textContent = fileCountText;
            gitStatusDiv.appendChild(fileCountDiv);
        }
        
        validateForm();
    }

    function showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        outputDiv.appendChild(messageDiv);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
        
        // Scroll to bottom
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    }

    function updateFileHistoryWarning(fileInfo) {
        if (!fileInfo || !warningSection || !warningMessage) {
            return;
        }

        if (fileInfo.isPushed) {
            warningSection.style.display = 'block';
            warningMessage.innerHTML = `
                <p><strong>This file has already been pushed to the remote repository!</strong></p>
                <p>Last commit: <code>${fileInfo.commitHash.substring(0, 8)}</code> on ${new Date(fileInfo.date).toLocaleDateString()}</p>
                <p><strong>Backdating this file will:</strong></p>
                <ul>
                    <li>📝 Create a new commit with a backdated timestamp</li>
                    <li>🔄 Rewrite Git history (change commit SHA)</li>
                    <li>⚠️ Require force push to update remote repository</li>
                    <li>🚫 Potentially cause conflicts for other collaborators</li>
                </ul>
                <p><strong>Recommendation:</strong> Only proceed if you're working alone or have coordinated with your team.</p>
            `;
        } else {
            warningSection.style.display = 'none';
        }
    }

    function selectAllFiles() {
        const checkboxes = fileCheckboxList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        validateForm();
    }

    function selectNoneFiles() {
        const checkboxes = fileCheckboxList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        validateForm();
    }

    function getSelectedFiles() {
        const selectedFiles = [];
        const checkboxes = fileCheckboxList.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            selectedFiles.push(checkbox.value);
        });
        return selectedFiles;
    }

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'gitStatus':
                updateGitStatus(message);
                setLoading(false);
                break;
                
            case 'modifiedFiles':
                updateModifiedFiles(message.files);
                break;
                
            case 'success':
                showMessage(message.message, 'success');
                setLoading(false);
                // Refresh status after successful commit
                setTimeout(() => {
                    requestGitStatus();
                    requestModifiedFiles();
                }, 1000);
                break;
                
            case 'error':
                showMessage(message.message, 'error');
                setLoading(false);
                break;
                
            case 'fileHistory':
                updateFileHistoryWarning(message.fileInfo);
                break;
        }
    });

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
