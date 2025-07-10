const axios = require('axios');

class VersionService {
    constructor() {
        this.cachedVersion = null;
        this.lastFetched = null;
        this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
        this.fallbackVersion = '1.0.0';
    }

    /**
     * Get the latest GitHub release version
     */
    async getLatestVersion() {
        // Return cached version if still valid
        if (this.cachedVersion && this.lastFetched && 
            (Date.now() - this.lastFetched) < this.cacheTimeout) {
            return this.cachedVersion;
        }

        try {
            // Try to get from package.json first
            const packageVersion = this.getPackageVersion();
            if (packageVersion) {
                this.cachedVersion = packageVersion;
                this.lastFetched = Date.now();
                return packageVersion;
            }

            // Fallback to GitHub API (if configured)
            const githubVersion = await this.getGithubVersion();
            if (githubVersion) {
                this.cachedVersion = githubVersion;
                this.lastFetched = Date.now();
                return githubVersion;
            }

            return this.fallbackVersion;
        } catch (error) {
            console.error('Error fetching version:', error.message);
            return this.cachedVersion || this.fallbackVersion;
        }
    }

    /**
     * Get version from package.json
     */
    getPackageVersion() {
        try {
            const packageJson = require('../../package.json');
            return packageJson.version;
        } catch (error) {
            console.error('Error reading package.json:', error.message);
            return null;
        }
    }

    /**
     * Get latest release from GitHub API
     */
    async getGithubVersion() {
        try {
            // Only try GitHub API if environment variables are set
            const githubRepo = process.env.GITHUB_REPO; // format: "owner/repo"
            if (!githubRepo) {
                return null;
            }

            const response = await axios.get(
                `https://api.github.com/repos/${githubRepo}/releases/latest`,
                {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'ePick-App',
                        ...(process.env.GITHUB_TOKEN && {
                            'Authorization': `token ${process.env.GITHUB_TOKEN}`
                        })
                    }
                }
            );

            if (response.data && response.data.tag_name) {
                // Remove 'v' prefix if present
                return response.data.tag_name.replace(/^v/, '');
            }

            return null;
        } catch (error) {
            console.error('Error fetching GitHub release:', error.message);
            return null;
        }
    }

    /**
     * Get detailed version info including commit hash if available
     */
    async getVersionInfo() {
        const version = await this.getLatestVersion();
        const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
        
        return {
            version,
            environment,
            lastUpdated: this.lastFetched ? new Date(this.lastFetched).toISOString() : null
        };
    }
}

module.exports = new VersionService();