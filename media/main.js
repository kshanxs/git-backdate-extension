(function() {
    const vscode = acquireVsCodeApi();
    
    let currentGitStatus = null;
    let modifiedFiles = [];
    let selectedFilePath = null;

    // DOM elements
    const commitMessageInput = document.getElementById('commitMessage');
    const backdateInput = document.getElementById('backdateInput');
    const scopeFileRadio = document.getElementById('scopeFile');
    const scopeAllRadio = document.getElementById('scopeAll');
    const fileSelectionDiv = document.getElementById('fileSelection');
    const fileSelect = document.getElementById('fileSelect');
    const pushToRemoteCheckbox = document.getElementById('pushToRemote');
    const backdateBtn = document.getElementById('backdateBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const outputDiv = document.getElementById('output');
    const gitStatusDiv = document.getElementById('gitStatus');

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
        scopeAllRadio.addEventListener('change', handleScopeChange);

        // Buttons
        backdateBtn.addEventListener('click', handleBackdateClick);
        refreshBtn.addEventListener('click', handleRefreshClick);

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
        fileSelectionDiv.style.display = isFileScope ? 'block' : 'none';
        validateForm();
    }

    function handleBackdateClick() {
        if (!validateForm()) {
            return;
        }

        const commitMessage = commitMessageInput.value.trim();
        const backdateString = backdateInput.value;
        const includeAllFiles = scopeAllRadio.checked;
        const selectedFile = scopeFileRadio.checked ? fileSelect.value : null;
        const pushToRemote = pushToRemoteCheckbox.checked;

        if (!commitMessage) {
            showMessage('Please enter a commit message.', 'error');
            return;
        }

        if (!backdateString) {
            showMessage('Please select a backdate.', 'error');
            return;
        }

        if (scopeFileRadio.checked && !selectedFile && !selectedFilePath) {
            showMessage('Please select a file to commit.', 'error');
            return;
        }

        setLoading(true);
        
        vscode.postMessage({
            type: 'backdate',
            data: {
                commitMessage,
                backdateString,
                includeAllFiles,
                selectedFile: selectedFile || selectedFilePath,
                pushToRemote
            }
        });
    }

    function handleRefreshClick() {
        setLoading(true);
        requestGitStatus();
        requestModifiedFiles();
    }

    function validateForm() {
        const commitMessage = commitMessageInput.value.trim();
        const backdateString = backdateInput.value;
        const isFileScope = scopeFileRadio.checked;
        const selectedFile = fileSelect.value;

        let isValid = commitMessage && backdateString;
        
        if (isFileScope) {
            isValid = isValid && (selectedFile || selectedFilePath);
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
            
            if (status.selectedFile) {
                selectedFilePath = status.selectedFile;
                const fileName = status.selectedFile.split('/').pop();
                statusHtml += `
                    <div class="selected-file">
                        📄 Selected file: <strong>${fileName}</strong>
                    </div>
                `;
                scopeFileRadio.checked = true;
                handleScopeChange();
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
        }
        
        gitStatusDiv.innerHTML = statusHtml;
        validateForm();
    }

    function updateModifiedFiles(files) {
        modifiedFiles = files;
        
        // Clear existing options
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
        }
    });

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
