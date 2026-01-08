/**
 * Service for managing version information
 */
export class VersionInfo {
  private versions: {
    platform: string;
    node: string;
    chrome: string;
    electron: string;
  } | null = null;

  /**
   * Get version information
   */
  getVersions(): { platform: string; node: string; chrome: string; electron: string } {
    if (this.versions) {
      return this.versions;
    }

    if (window.electronAPI) {
      this.versions = {
        platform: window.electronAPI.platform,
        node: window.electronAPI.versions?.node || 'Unknown',
        chrome: window.electronAPI.versions?.chrome || 'Unknown',
        electron: window.electronAPI.versions?.electron || 'Unknown'
      };
    } else {
      this.versions = {
        platform: 'Unknown',
        node: 'Unknown',
        chrome: 'Unknown',
        electron: 'Unknown'
      };
    }

    return this.versions;
  }
}

