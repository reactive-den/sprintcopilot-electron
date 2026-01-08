import { Logger } from '../utils/logger.js';
import type { DirectorySelectedCallback, DirectorySelectResult, GitVerificationResult } from '../../../types/index.js';

export class DirectorySelector {
  private container: HTMLElement | null;
  private logger: Logger;
  private selectedPath: string | null = null;
  public onDirectorySelectedCallback: DirectorySelectedCallback | null = null;

  constructor(container: HTMLElement | null) {
    this.container = container;
    this.logger = new Logger();
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing DirectorySelector...');
    await this.render();
  }

  async render(): Promise<void> {
    if (!this.container) {
      this.logger.error('Container element not found');
      return;
    }

    this.container.innerHTML = `
      <div class="directory-selector">
        <div class="directory-selector__content">
          <div class="directory-selector__icon">📂</div>
          <h2 class="directory-selector__title">Select Project Directory</h2>
          <p class="directory-selector__description">
            Please select the root directory of your project. This should be the directory containing your <code>.git</code> folder.
          </p>

          <div class="directory-selector__path-display" id="selected-path-display" style="display: none;">
            <div class="directory-selector__path-label">Selected Directory:</div>
            <div class="directory-selector__path-value" id="selected-path-value"></div>
          </div>

          <div class="directory-selector__status" id="verification-status" style="display: none;"></div>

          <div class="directory-selector__actions">
            <button class="directory-selector__button" id="select-directory-btn">
              📁 Select Directory
            </button>
            <button class="directory-selector__button directory-selector__button--primary" id="continue-btn" style="display: none;">
              ✓ Continue
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const selectBtn = document.getElementById('select-directory-btn');
    const continueBtn = document.getElementById('continue-btn');

    if (selectBtn) {
      selectBtn.addEventListener('click', () => {
        this.selectDirectory();
      });
    }

    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        this.onDirectorySelected();
      });
    }
  }

  async selectDirectory(): Promise<void> {
    try {
      if (!window.electronAPI || !window.electronAPI.ipc) {
        throw new Error('Electron API not available');
      }

      const selectBtn = document.getElementById('select-directory-btn') as HTMLButtonElement | null;
      const continueBtn = document.getElementById('continue-btn') as HTMLButtonElement | null;
      const pathDisplay = document.getElementById('selected-path-display');
      const pathValue = document.getElementById('selected-path-value');
      const statusDiv = document.getElementById('verification-status');

      if (selectBtn) selectBtn.disabled = true;

      // Open directory dialog
      const result = await window.electronAPI.ipc.invoke('directory:select') as DirectorySelectResult;

      if (!result.success) {
        if (result.error !== 'No directory selected') {
          this.showError(result.error || 'Failed to select directory');
        }
        // Re-enable button and clear any previous state
        if (selectBtn) selectBtn.disabled = false;
        this.selectedPath = null;
        if (pathDisplay) pathDisplay.style.display = 'none';
        if (statusDiv) {
          statusDiv.style.display = 'none';
        }
        return;
      }

      this.selectedPath = result.path || null;

      // Show selected path
      if (pathValue && result.path) {
        pathValue.textContent = result.path;
      }
      if (pathDisplay) {
        pathDisplay.style.display = 'block';
      }

      // Verify git repository
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.className = 'directory-selector__status directory-selector__status--verifying';
        statusDiv.innerHTML = '<div class="directory-selector__spinner"></div> Verifying git repository...';
      }

      const verification = await window.electronAPI.ipc.invoke('directory:verify-git', {
        directoryPath: result.path
      }) as GitVerificationResult;

      // Always re-enable the button after verification completes
      if (selectBtn) {
        selectBtn.disabled = false;
      }

      if (verification.success && verification.isValid) {
        // Valid git repository
        if (statusDiv) {
          statusDiv.className = 'directory-selector__status directory-selector__status--success';
          statusDiv.innerHTML = '✓ Valid git repository';
        }
        if (continueBtn) {
          continueBtn.style.display = 'block';
        }
      } else {
        // Invalid or not a git repository
        if (statusDiv) {
          statusDiv.className = 'directory-selector__status directory-selector__status--error';
          statusDiv.innerHTML = `⚠️ ${this.escapeHtml(verification.error || 'Not a valid git repository')}`;
        }
        if (continueBtn) {
          continueBtn.style.display = 'none';
        }
        // Keep path display visible so user can see what they selected, but clear the selected path
        this.selectedPath = null;
      }
    } catch (error: any) {
      this.logger.error('Error selecting directory:', error);
      this.showError(error.message || 'Failed to select directory');

      const selectBtn = document.getElementById('select-directory-btn') as HTMLButtonElement | null;
      if (selectBtn) selectBtn.disabled = false;
    }
  }

  private onDirectorySelected(): void {
    if (this.selectedPath && this.onDirectorySelectedCallback) {
      this.onDirectorySelectedCallback(this.selectedPath);
    }
  }

  private showError(message: string): void {
    const statusDiv = document.getElementById('verification-status');
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.className = 'directory-selector__status directory-selector__status--error';
      statusDiv.innerHTML = `⚠️ ${this.escapeHtml(message)}`;
    }
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

