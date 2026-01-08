import { VersionInfo } from '../services/VersionInfo.js';

export class InfoCard {
  private versionInfo: VersionInfo;

  constructor(_element: HTMLElement) {
    this.versionInfo = new VersionInfo();
  }

  /**
   * Render the component
   */
  render(): void {
    this.updateVersionInfo();
  }

  /**
   * Update version information display
   */
  async updateVersionInfo(): Promise<void> {
    const versions = this.versionInfo.getVersions();

    // Update platform
    const platformElement = document.getElementById('platform');
    if (platformElement) {
      platformElement.textContent = versions.platform || 'Unknown';
    }

    // Update versions
    const nodeVersionElement = document.getElementById('node-version');
    if (nodeVersionElement) {
      nodeVersionElement.textContent = versions.node || 'Unknown';
    }

    const chromeVersionElement = document.getElementById('chrome-version');
    if (chromeVersionElement) {
      chromeVersionElement.textContent = versions.chrome || 'Unknown';
    }

    const electronVersionElement = document.getElementById('electron-version');
    if (electronVersionElement) {
      electronVersionElement.textContent = versions.electron || 'Unknown';
    }
  }
}

