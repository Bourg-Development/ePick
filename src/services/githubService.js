const semver = require('semver');
const logger = require('../utils/logger');

class GitHubService {
    constructor() {
        this.baseURL = 'https://api.github.com';
        this.token = process.env.GITHUB_TOKEN;
        this.owner = process.env.GITHUB_OWNER;
        this.repo = process.env.GITHUB_REPO;
        this.enabled = process.env.GITHUB_SYNC_ENABLED === 'true';
    }

    isEnabled() {
        return this.enabled && this.owner && this.repo;
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'ePick-System',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
        }

        try {
            // Use dynamic import for node-fetch
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`GitHub API error: ${response.status} - ${error}`);
            }

            return await response.json();
        } catch (error) {
            logger.error(`GitHub API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    async getLatestReleases(limit = 10) {
        if (!this.isEnabled()) {
            throw new Error('GitHub integration is not enabled or configured');
        }

        try {
            const endpoint = `/repos/${this.owner}/${this.repo}/releases?per_page=${limit}`;
            return await this.makeRequest(endpoint);
        } catch (error) {
            logger.error('Failed to fetch GitHub releases:', error);
            throw new Error(`Failed to fetch releases: ${error.message}`);
        }
    }

    async getReleaseByTag(tag) {
        if (!this.isEnabled()) {
            throw new Error('GitHub integration is not enabled or configured');
        }

        try {
            const endpoint = `/repos/${this.owner}/${this.repo}/releases/tags/${tag}`;
            return await this.makeRequest(endpoint);
        } catch (error) {
            logger.error(`Failed to fetch GitHub release ${tag}:`, error);
            throw new Error(`Failed to fetch release ${tag}: ${error.message}`);
        }
    }

    async getLatestRelease() {
        if (!this.isEnabled()) {
            throw new Error('GitHub integration is not enabled or configured');
        }

        try {
            const endpoint = `/repos/${this.owner}/${this.repo}/releases/latest`;
            return await this.makeRequest(endpoint);
        } catch (error) {
            logger.error('Failed to fetch latest GitHub release:', error);
            throw new Error(`Failed to fetch latest release: ${error.message}`);
        }
    }

    determineReleaseType(version, previousVersion = null) {
        if (!previousVersion) {
            return 'minor'; // Default for first release
        }

        try {
            const cleanVersion = semver.clean(version);
            const cleanPreviousVersion = semver.clean(previousVersion);

            if (!cleanVersion || !cleanPreviousVersion) {
                return 'minor';
            }

            const diff = semver.diff(cleanPreviousVersion, cleanVersion);
            
            switch (diff) {
                case 'major':
                    return 'major';
                case 'minor':
                    return 'minor';
                case 'patch':
                    return 'patch';
                case 'prerelease':
                    return 'hotfix';
                default:
                    return 'minor';
            }
        } catch (error) {
            logger.warn(`Failed to determine release type for ${version}:`, error);
            return 'minor';
        }
    }

    parseReleaseNotes(body) {
        if (!body) return [];

        const changes = [];
        const lines = body.split('\n');
        let currentCategory = null;
        let currentItems = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines
            if (!trimmedLine) continue;

            // Check for category headers
            if (this.isCategoryHeader(trimmedLine)) {
                // Save previous category if exists
                if (currentCategory && currentItems.length > 0) {
                    changes.push({
                        category: currentCategory,
                        items: [...currentItems]
                    });
                }

                currentCategory = this.extractCategory(trimmedLine);
                currentItems = [];
                continue;
            }

            // Check for list items
            if (this.isListItem(trimmedLine)) {
                const item = this.extractListItem(trimmedLine);
                if (item) {
                    currentItems.push(item);
                }
                continue;
            }

            // If no category is set and we have a non-empty line, treat as general improvement
            if (!currentCategory && trimmedLine) {
                currentCategory = 'improved';
                currentItems = [trimmedLine];
            }
        }

        // Add final category if exists
        if (currentCategory && currentItems.length > 0) {
            changes.push({
                category: currentCategory,
                items: currentItems
            });
        }

        // If no structured changes found, don't add fallback since description will show the content

        return changes;
    }

    isCategoryHeader(line) {
        const categoryKeywords = [
            'new features', 'features', 'added', 'new',
            'improvements', 'improved', 'enhanced', 'enhancement',
            'bug fixes', 'fixes', 'fixed', 'bugfixes',
            'security', 'security updates', 'security fixes',
            'breaking', 'breaking changes', 'removed', 'deprecated'
        ];

        const lowerLine = line.toLowerCase();
        
        // Check for markdown headers
        if (line.startsWith('#')) return true;
        
        // Check for category keywords
        return categoryKeywords.some(keyword => 
            lowerLine.includes(keyword) && 
            (lowerLine.includes(':') || line.startsWith('##'))
        );
    }

    extractCategory(line) {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('new') || lowerLine.includes('feature') || lowerLine.includes('added')) {
            return 'new';
        }
        if (lowerLine.includes('improve') || lowerLine.includes('enhance')) {
            return 'improved';
        }
        if (lowerLine.includes('fix') || lowerLine.includes('bug')) {
            return 'fixed';
        }
        if (lowerLine.includes('security')) {
            return 'security';
        }
        
        return 'improved'; // Default category
    }

    isListItem(line) {
        return line.startsWith('- ') || 
               line.startsWith('* ') || 
               line.startsWith('+ ') ||
               /^\d+\.\s/.test(line);
    }

    extractListItem(line) {
        // Remove list markers and clean up
        return line.replace(/^[-*+]\s+/, '')
                  .replace(/^\d+\.\s+/, '')
                  .trim();
    }

    determinePriority(release, previousVersion = null) {
        const version = release.tag_name;
        const body = (release.body || '').toLowerCase();
        const name = (release.name || '').toLowerCase();

        // Critical priority indicators
        if (release.prerelease || 
            body.includes('critical') || 
            body.includes('security') ||
            body.includes('hotfix') ||
            name.includes('hotfix') ||
            name.includes('critical')) {
            return 'critical';
        }

        // High priority for major releases
        if (previousVersion) {
            try {
                const cleanVersion = semver.clean(version);
                const cleanPrevious = semver.clean(previousVersion);
                if (cleanVersion && cleanPrevious) {
                    const diff = semver.diff(cleanPrevious, cleanVersion);
                    if (diff === 'major') {
                        return 'high';
                    }
                }
            } catch (error) {
                // Ignore semver parsing errors
            }
        }

        // Medium priority for minor releases or if many changes
        if (body.length > 500 || (release.body || '').split('\n').length > 10) {
            return 'medium';
        }

        return 'low';
    }

    async getRepositoryInfo() {
        if (!this.isEnabled()) {
            return {
                enabled: false,
                error: 'GitHub integration not configured'
            };
        }

        try {
            const endpoint = `/repos/${this.owner}/${this.repo}`;
            const repository = await this.makeRequest(endpoint);

            return {
                enabled: true,
                repository: repository,
                owner: this.owner,
                repo: this.repo
            };
        } catch (error) {
            logger.error('Failed to fetch repository info:', error);
            return {
                enabled: false,
                error: error.message
            };
        }
    }
}

module.exports = GitHubService;