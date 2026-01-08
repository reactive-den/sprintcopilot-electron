import { Logger } from '../utils/logger.js';
import type { ClickUpTask, TrackerStatus } from '../../../types/index.js';

export class TaskCard {
  private task: ClickUpTask;
  private logger: Logger;
  private isExpanded: boolean = false;
  private isTracking: boolean = false;
  private trackerStatus: TrackerStatus | null = null;
  private statusInterval: NodeJS.Timeout | null = null;

  constructor(task: ClickUpTask) {
    this.task = task;
    this.logger = new Logger();
  }

  /**
   * Render the task card
   */
  async render(): Promise<HTMLElement> {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('data-task-card-id', this.task.id);
    card.innerHTML = this.getCardHTML();

    // Check tracker status before rendering
    await this.checkTrackerStatus();

    // Attach event listeners
    this.attachEventListeners(card);

    return card;
  }

  /**
   * Get card HTML
   */
  private getCardHTML(): string {
    const status = this.task.status || { status: 'TO DO' };
    const priority = this.task.priority || { priority: 'NORMAL' };
    const assignees = this.task.assignees || [];
    const tags = this.task.tags || [];

    // Extract project, sprint, estimate, t-shirt size from custom fields or defaults
    const project = this.getCustomField('Project') || this.task.list?.name || 'N/A';
    const sprint = this.getCustomField('Sprint') || this.getCustomField('sprint') || 'N/A';
    const estimate = this.getCustomField('Estimate') || this.getCustomField('estimate') || (this.task.time_estimate ? `${this.task.time_estimate / 3600000}h` : 'N/A');
    const tshirtSize = this.getCustomField('T-Shirt Size') || this.getCustomField('T-shirt Size') || this.getCustomField('tshirt') || 'N/A';
    const priorityValue = priority.priority || this.getCustomField('Priority') || 'NORMAL';

    // Parse user story and acceptance criteria from description
    const description = this.task.description || '';
    const userStoryMatch = description.match(/As a .+? so that .+?(?:\n|$)/i);
    const userStory = userStoryMatch ? userStoryMatch[0].trim() : description;
    const acceptanceCriteria = this.parseAcceptanceCriteria(description);
    const dependencies = this.parseDependencies(description);

    return `
      <div class="task-card__header">
        <div class="task-card__status-badge">${(status.status || 'TO DO').toUpperCase()}</div>
        <button class="task-card__toggle" aria-label="Toggle details">
          <span class="task-card__toggle-icon">▼</span>
        </button>
      </div>

      <div class="task-card__body">
        <h3 class="task-card__title">${this.escapeHtml(this.task.name || 'Untitled Task')}</h3>

        ${userStory ? `
          <div class="task-card__story-preview">
            <span class="task-card__story-text">${this.escapeHtml(userStory.substring(0, 100))}${userStory.length > 100 ? '...' : ''}</span>
          </div>
        ` : ''}

        <div class="task-card__meta-row">
          <span class="task-card__priority-badge priority-${this.getPriorityClass(priorityValue)}">
            ${priorityValue.toUpperCase()}
          </span>
          ${tags.length > 0 ? `
            <div class="task-card__tags-preview">
              ${tags.slice(0, 3).map(tag => `
                <span class="task-card__tag-preview">${this.escapeHtml(tag.name || '')}</span>
              `).join('')}
              ${tags.length > 3 ? `<span class="task-card__tag-more">+${tags.length - 3}</span>` : ''}
            </div>
          ` : ''}
          ${assignees.length > 0 ? `
            <div class="task-card__assignee-avatar-large">
              ${this.getInitials(assignees[0].username || assignees[0].email || 'U')}
            </div>
          ` : ''}
        </div>

        <div class="task-card__actions">
          <button class="task-card__track-btn" data-task-id="${this.task.id}" data-action="toggle-tracker">
            ${this.isTracking ? `
              <span class="task-card__track-icon">⏸</span>
              <span class="task-card__track-text">Stop Working</span>
              ${this.trackerStatus ? `<span class="task-card__track-time">(${this.trackerStatus.elapsedMinutes || 0}m)</span>` : ''}
            ` : `
              <span class="task-card__track-icon">▶</span>
              <span class="task-card__track-text">Start Working</span>
            `}
          </button>
          ${this.isTracking && this.trackerStatus ? `
            <div class="task-card__track-info">
              <span class="task-card__track-stats">📸 ${this.trackerStatus.screenshots || 0} | ⌨️ ${this.trackerStatus.keyboardEvents || 0} | 🖱️ ${this.trackerStatus.mouseEvents || 0}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="task-card__details">
        <div class="task-card__details-content">
          <div class="task-card__detail-section">
            <h4 class="task-card__section-title">DESCRIPTION</h4>
            <div class="task-card__detail-info">
              <div class="task-card__detail-item">
                <strong>Project:</strong> <span>${this.escapeHtml(project)}</span>
              </div>
              <div class="task-card__detail-item">
                <strong>Sprint:</strong> <span>${this.escapeHtml(String(sprint))}</span>
              </div>
              <div class="task-card__detail-item">
                <strong>Estimate:</strong> <span>${this.escapeHtml(String(estimate))}</span>
              </div>
              <div class="task-card__detail-item">
                <strong>T-Shirt Size:</strong> <span>${this.escapeHtml(String(tshirtSize))}</span>
              </div>
              <div class="task-card__detail-item">
                <strong>Priority:</strong> <span>${this.escapeHtml(String(priorityValue))}</span>
              </div>
              ${tags.length > 0 ? `
                <div class="task-card__detail-item">
                  <strong>Tags:</strong> <span>${tags.map(tag => this.escapeHtml(tag.name || '')).join(', ')}</span>
                </div>
              ` : ''}
              ${userStory ? `
                <div class="task-card__detail-item task-card__detail-item--full">
                  <strong>Full User Story:</strong> <span>${this.escapeHtml(userStory)}</span>
                </div>
              ` : ''}
            </div>
          </div>

          ${acceptanceCriteria.length > 0 ? `
            <div class="task-card__detail-section">
              <h4 class="task-card__section-title">Acceptance Criteria</h4>
              <ol class="task-card__criteria-list">
                ${acceptanceCriteria.map(criteria => `
                  <li>${this.escapeHtml(criteria)}</li>
                `).join('')}
              </ol>
            </div>
          ` : ''}

          ${dependencies.length > 0 ? `
            <div class="task-card__detail-section">
              <h4 class="task-card__section-title">Dependencies</h4>
              <ul class="task-card__dependencies-list">
                ${dependencies.map(dep => `
                  <li>${this.escapeHtml(dep)}</li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          ${this.task.url ? `
            <div class="task-card__detail-section">
              <h4 class="task-card__section-title">Links</h4>
              <div class="task-card__detail-item">
                <a href="${this.task.url}" target="_blank" rel="noopener noreferrer" class="task-card__link">
                  View in ClickUp →
                </a>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Get custom field value
   */
  private getCustomField(name: string): string | null {
    if (!this.task.custom_fields) return null;
    const field = this.task.custom_fields.find((f: any) =>
      f.name && f.name.toLowerCase() === name.toLowerCase()
    );
    return field ? this.getFieldValue(field) : null;
  }

  /**
   * Parse acceptance criteria from description
   */
  private parseAcceptanceCriteria(description: string): string[] {
    if (!description) return [];
    const criteria: string[] = [];

    // Look for numbered list patterns
    const numberedPattern = /(?:^|\n)\s*(\d+)\.\s*(.+?)(?=\n\s*\d+\.|$)/g;
    let match;
    while ((match = numberedPattern.exec(description)) !== null) {
      criteria.push(match[2].trim());
    }

    // Look for bullet points with "Acceptance Criteria" header
    const criteriaSection = description.match(/Acceptance Criteria:?\s*\n([\s\S]*?)(?=\n\s*(?:Dependencies|$))/i);
    if (criteriaSection) {
      const items = criteriaSection[1].split(/\n/).filter(line => line.trim());
      items.forEach(item => {
        const cleaned = item.replace(/^[-•*]\s*/, '').trim();
        if (cleaned) criteria.push(cleaned);
      });
    }

    return criteria.length > 0 ? criteria : [];
  }

  /**
   * Parse dependencies from description
   */
  private parseDependencies(description: string): string[] {
    if (!description) return [];
    const dependencies: string[] = [];

    // Look for Dependencies section
    const depsSection = description.match(/Dependencies:?\s*\n([\s\S]*?)(?=\n\s*(?:$|Acceptance|Description))/i);
    if (depsSection) {
      const items = depsSection[1].split(/\n/).filter(line => line.trim());
      items.forEach(item => {
        const cleaned = item.replace(/^[-•*]\s*/, '').trim();
        if (cleaned && !cleaned.match(/^Dependencies/i)) {
          dependencies.push(cleaned);
        }
      });
    }

    return dependencies;
  }

  /**
   * Get priority class name
   */
  private getPriorityClass(priority: string): string {
    const p = String(priority).toLowerCase();
    if (p.includes('urgent') || p.includes('1') || p.includes('high')) return 'high';
    if (p.includes('normal') || p.includes('3') || p.includes('medium')) return 'normal';
    if (p.includes('low') || p.includes('4') || p.includes('5')) return 'low';
    return 'normal';
  }

  /**
   * Attach event listeners to the card
   */
  private attachEventListeners(card: HTMLElement): void {
    const toggleButton = card.querySelector('.task-card__toggle');
    const detailsSection = card.querySelector('.task-card__details');

    if (toggleButton && detailsSection) {
      toggleButton.addEventListener('click', () => {
        this.isExpanded = !this.isExpanded;
        detailsSection.classList.toggle('task-card__details--expanded', this.isExpanded);
        const icon = toggleButton.querySelector('.task-card__toggle-icon');
        if (icon) {
          icon.textContent = this.isExpanded ? '▲' : '▼';
          (icon as HTMLElement).style.transform = this.isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      });

      // Start collapsed by default
      this.isExpanded = false;
    }

    // Attach tracker button listener
    const trackButton = card.querySelector('.task-card__track-btn');
    if (trackButton) {
      trackButton.addEventListener('click', () => {
        this.toggleTracker();
      });
    }

    // Check initial tracker status
    this.checkTrackerStatus();
  }

  /**
   * Toggle tracker (start/stop)
   */
  private async toggleTracker(): Promise<void> {
    try {
      if (!window.electronAPI || !window.electronAPI.ipc) {
        this.logger.error('Electron API not available');
        return;
      }

      if (this.isTracking) {
        // Stop tracking
        const result = await window.electronAPI.ipc.invoke('tracker:stop', {
          taskId: this.task.id
        });

        if (result.success) {
          this.isTracking = false;
          this.trackerStatus = null;
          if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
          }
          this.logger.info('Tracker stopped:', result.summary);
          this.updateTrackerUI();
        } else {
          this.logger.error('Failed to stop tracker:', result.error);
        }
      } else {
        // Start tracking
        const result = await window.electronAPI.ipc.invoke('tracker:start', {
          taskId: this.task.id,
          taskInfo: {
            name: this.task.name,
            id: this.task.id
          }
        });

        if (result.success) {
          this.isTracking = true;
          this.trackerStatus = { active: true, elapsedMinutes: 0, screenshots: 0, keyboardEvents: 0, mouseEvents: 0 };
          this.logger.info('Tracker started:', result);
          this.updateTrackerUI();
          this.startStatusUpdates();
        } else {
          this.logger.error('Failed to start tracker:', result.error);
        }
      }
    } catch (error: any) {
      this.logger.error('Error toggling tracker:', error);
    }
  }

  /**
   * Check tracker status
   */
  private async checkTrackerStatus(): Promise<void> {
    try {
      if (!window.electronAPI || !window.electronAPI.ipc) {
        return;
      }

      const result = await window.electronAPI.ipc.invoke('tracker:status', {
        taskId: this.task.id
      });

      if (result.success && result.status && result.status.active) {
        this.isTracking = true;
        this.trackerStatus = result.status;
        this.updateTrackerUI();
        this.startStatusUpdates();
      }
    } catch (error: any) {
      this.logger.debug('Error checking tracker status:', error);
    }
  }

  /**
   * Start status update interval
   */
  private startStatusUpdates(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }

    this.statusInterval = setInterval(async () => {
      if (!this.isTracking) {
        if (this.statusInterval) {
          clearInterval(this.statusInterval);
        }
        return;
      }

      await this.checkTrackerStatus();
      this.updateTrackerUI();
    }, 5000); // Update every 5 seconds
  }

  /**
   * Update tracker UI
   */
  private updateTrackerUI(): void {
    const card = document.querySelector(`[data-task-card-id="${this.task.id}"]`);
    if (!card) return;

    const trackButton = card.querySelector('.task-card__track-btn') as HTMLButtonElement | null;
    const trackText = card.querySelector('.task-card__track-text');
    const trackTime = card.querySelector('.task-card__track-time');
    const trackInfo = card.querySelector('.task-card__track-info');
    const trackStats = card.querySelector('.task-card__track-stats');

    if (trackButton) {
      if (this.isTracking) {
        trackButton.classList.add('tracking');
        if (trackText) trackText.textContent = 'Stop Working';
        const icon = trackButton.querySelector('.task-card__track-icon');
        if (icon) icon.textContent = '⏸';

        if (this.trackerStatus) {
          // Update or create time element
          if (!trackTime && this.trackerStatus.elapsedMinutes) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'task-card__track-time';
            timeSpan.textContent = `(${this.trackerStatus.elapsedMinutes || 0}m)`;
            trackButton.appendChild(timeSpan);
          } else if (trackTime) {
            trackTime.textContent = `(${this.trackerStatus.elapsedMinutes || 0}m)`;
          }

          // Update or create stats element
          if (trackInfo && trackStats) {
            trackStats.textContent = `📸 ${this.trackerStatus.screenshots || 0} | ⌨️ ${this.trackerStatus.keyboardEvents || 0} | 🖱️ ${this.trackerStatus.mouseEvents || 0}`;
            (trackInfo as HTMLElement).style.display = 'block';
          }
        }
      } else {
        trackButton.classList.remove('tracking');
        if (trackText) trackText.textContent = 'Start Working';
        const icon = trackButton.querySelector('.task-card__track-icon');
        if (icon) icon.textContent = '▶';

        if (trackTime && trackTime.parentElement === trackButton) {
          trackButton.removeChild(trackTime);
        }
        if (trackInfo) (trackInfo as HTMLElement).style.display = 'none';
      }
    }
  }

  /**
   * Get field value based on type
   */
  private getFieldValue(field: any): string {
    if (field.value) {
      if (typeof field.value === 'string') {
        return field.value;
      } else if (typeof field.value === 'object' && field.value.label) {
        return field.value.label;
      } else if (Array.isArray(field.value)) {
        return field.value.map((v: any) => v.label || v).join(', ');
      }
    }
    return 'N/A';
  }


  /**
   * Get user initials
   */
  private getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

