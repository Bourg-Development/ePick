// services/detectionService.js
const geoip = require('geoip-lite');
const db = require('../db');
const logService = require('./logService');
const emailService = require('./emailService');
const deviceFingerprintUtil = require('../utils/deviceFingerprint');

/**
 * Service for AI-based suspicious behavior detection
 */
class DetectionService {
    /**
     * Analyze login behavior for suspicious activity
     * @param {Object} user - User object
     * @param {Object} context - Request context with IP, device info
     * @returns {Promise<boolean>} Whether suspicious activity was detected
     */
    async analyzeLoginBehavior(user, context) {
        try {
            // Extract context info
            const { ip, deviceFingerprint, userAgent } = context;

            // Get user's login history
            const loginHistory = await db.AuditLog.findAll({
                where: {
                    user_id: user.id,
                    event_type: {
                        [db.Sequelize.Op.in]: ['user.login', 'user.login_2fa', 'user.login_webauthn']
                    }
                },
                order: [['created_at', 'DESC']],
                limit: 5
            });

            // Check for impossible travel
            const suspiciousTravel = await this._checkForImpossibleTravel(user.id, ip, loginHistory);

            // Check for unusual login time
            const unusualTime = this._checkForUnusualLoginTime(user.id, loginHistory);

            // Check for device fingerprint changes
            const deviceChange = this._checkForDeviceChanges(user.id, deviceFingerprint, loginHistory);

            // Combine detections and calculate risk score
            const detections = [];
            let riskScore = 0;

            if (suspiciousTravel.detected) {
                detections.push({
                    type: 'impossible_travel',
                    details: suspiciousTravel.details,
                    score: suspiciousTravel.score
                });
                riskScore += suspiciousTravel.score;
            }

            if (unusualTime.detected) {
                detections.push({
                    type: 'unusual_time',
                    details: unusualTime.details,
                    score: unusualTime.score
                });
                riskScore += unusualTime.score;
            }

            if (deviceChange.detected) {
                detections.push({
                    type: 'device_change',
                    details: deviceChange.details,
                    score: deviceChange.score
                });
                riskScore += deviceChange.score;
            }

            // If detections were made, log and take action
            if (detections.length > 0) {
                await this._handleDetections(user, detections, riskScore, context);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Login behavior analysis error:', error);
            // Log detection service error but allow login to proceed
            await logService.securityLog({
                eventType: 'detection.analysis_error',
                severity: 'medium',
                userId: user.id,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    error: error.message,
                    userAgent: context.userAgent
                }
            });
            return false;
        }
    }

    /**
     * Analyze token usage for suspicious activity
     * @param {Object} user - User object
     * @param {Object} session - Session object
     * @param {Object} context - Request context
     * @returns {Promise<boolean>} Whether suspicious activity was detected
     */
    async analyzeTokenUsage(user, session, context) {
        try {
            // Extract context info
            const { ip, deviceFingerprint, userAgent } = context;

            // Calculate time since last activity
            const lastActivity = new Date(session.last_activity);
            const now = new Date();
            const minutesSinceLastActivity = Math.floor((now - lastActivity) / (1000 * 60));

            // Check for location change in token usage
            const locationChanged = await this._checkForLocationChange(user.id, ip, session.ip_address);

            // Check for fingerprint deviation
            const fingerprintDeviation = this._checkForFingerprintDeviation(deviceFingerprint, session.device_fingerprint);

            // Check for unusual refresh token behavior (frequency)
            const unusualFrequency = this._checkForUnusualRefreshFrequency(minutesSinceLastActivity);

            // Combine detections and calculate risk score
            const detections = [];
            let riskScore = 0;

            if (locationChanged.detected) {
                detections.push({
                    type: 'token_location_change',
                    details: locationChanged.details,
                    score: locationChanged.score
                });
                riskScore += locationChanged.score;
            }

            if (fingerprintDeviation.detected) {
                detections.push({
                    type: 'fingerprint_deviation',
                    details: fingerprintDeviation.details,
                    score: fingerprintDeviation.score
                });
                riskScore += fingerprintDeviation.score;
            }

            if (unusualFrequency.detected) {
                detections.push({
                    type: 'unusual_refresh_frequency',
                    details: unusualFrequency.details,
                    score: unusualFrequency.score
                });
                riskScore += unusualFrequency.score;
            }

            // If detections were made, log and take action
            if (detections.length > 0) {
                await this._handleTokenDetections(user, session, detections, riskScore, context);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Token usage analysis error:', error);
            // Log detection service error but allow token usage to proceed
            await logService.securityLog({
                eventType: 'detection.token_analysis_error',
                severity: 'medium',
                userId: user.id,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    error: error.message,
                    userAgent: context.userAgent,
                    sessionId: session.id
                }
            });
            return false;
        }
    }

    /**
     * Check for impossible travel based on login locations
     * @private
     * @param {number} userId - User ID
     * @param {string} currentIp - Current IP address
     * @param {Array} loginHistory - Login history records
     * @returns {Promise<Object>} Detection result
     */
    async _checkForImpossibleTravel(userId, currentIp, loginHistory) {
        const result = {
            detected: false,
            details: null,
            score: 0
        };

        if (!loginHistory || loginHistory.length === 0) {
            return result;
        }

        try {
            // Get location for current IP
            const currentGeo = geoip.lookup(currentIp);

            if (!currentGeo) {
                return result;
            }

            // Get most recent login location
            const lastLogin = loginHistory[0];
            const lastIp = lastLogin.ip_address;

            if (!lastIp || lastIp === currentIp) {
                return result;
            }

            const lastGeo = geoip.lookup(lastIp);

            if (!lastGeo) {
                return result;
            }

            // Calculate distance between locations (simple approximation)
            const distance = this._calculateDistance(
                lastGeo.ll[0], lastGeo.ll[1],
                currentGeo.ll[0], currentGeo.ll[1]
            );

            // Calculate time between logins
            const lastLoginTime = new Date(lastLogin.created_at);
            const currentTime = new Date();
            const hoursBetween = (currentTime - lastLoginTime) / (1000 * 60 * 60);

            // Calculate travel speed in km/h
            const travelSpeed = distance / hoursBetween;

            // Check if speed exceeds threshold for impossible travel
            // 800 km/h is approximately the speed of a commercial jetliner
            if (hoursBetween < 24 && travelSpeed > 800) {
                result.detected = true;
                result.details = {
                    distance,
                    hoursBetween,
                    travelSpeed,
                    lastLocation: `${lastGeo.city || 'Unknown'}, ${lastGeo.country}`,
                    currentLocation: `${currentGeo.city || 'Unknown'}, ${currentGeo.country}`,
                    lastIp,
                    currentIp
                };

                // Calculate risk score (higher for more extreme speeds)
                if (travelSpeed > 2000) {
                    result.score = 75; // Very high risk
                } else if (travelSpeed > 1200) {
                    result.score = 60; // High risk
                } else {
                    result.score = 45; // Medium risk
                }
            }

            return result;
        } catch (error) {
            console.error('Impossible travel check error:', error);
            return result;
        }
    }

    /**
     * Check for unusual login time
     * @private
     * @param {number} userId - User ID
     * @param {Array} loginHistory - Login history records
     * @returns {Object} Detection result
     */
    _checkForUnusualLoginTime(userId, loginHistory) {
        const result = {
            detected: false,
            details: null,
            score: 0
        };

        if (!loginHistory || loginHistory.length < 3) {
            return result;
        }

        try {
            // Get current hour (0-23)
            const currentHour = new Date().getHours();

            // Check if user typically logs in at this hour
            const loginHours = loginHistory.map(login => new Date(login.created_at).getHours());
            const typicalHours = this._getTypicalLoginHours(loginHours);

            // If current hour is 3+ hours outside typical range, flag as unusual
            if (!typicalHours.includes(currentHour)) {
                let nearestTypicalHour = typicalHours[0];
                let minDifference = 24;

                for (const hour of typicalHours) {
                    const diff = Math.min(
                        Math.abs(hour - currentHour),
                        Math.abs(hour - currentHour + 24),
                        Math.abs(hour - currentHour - 24)
                    );

                    if (diff < minDifference) {
                        minDifference = diff;
                        nearestTypicalHour = hour;
                    }
                }

                if (minDifference >= 2) {
                    result.detected = true;
                    result.details = {
                        currentHour,
                        typicalHours,
                        hourDifference: minDifference
                    };

                    // Calculate risk score based on how unusual the time is
                    if (minDifference >= 10) {
                        result.score = 35; // Higher risk for very unusual hours
                    } else if (minDifference >= 8) {
                        result.score = 25;
                    } else {
                        result.score = 15; // Lower risk but still unusual
                    }
                }
            }

            return result;
        } catch (error) {
            console.error('Unusual login time check error:', error);
            return result;
        }
    }

    /**
     * Check for device changes
     * @private
     * @param {number} userId - User ID
     * @param {string} currentFingerprint - Current device fingerprint
     * @param {Array} loginHistory - Login history records
     * @returns {Object} Detection result
     */
    _checkForDeviceChanges(userId, currentFingerprint, loginHistory) {
        const result = {
            detected: false,
            details: null,
            score: 0
        };

        if (!loginHistory || loginHistory.length === 0 || !currentFingerprint) {
            return result;
        }

        try {
            // Get previous device fingerprints
            const deviceFingerprints = loginHistory
                .filter(login => login.device_fingerprint)
                .map(login => login.device_fingerprint);

            if (deviceFingerprints.length === 0) {
                return result;
            }

            // Check if current fingerprint matches any previous ones
            let matchFound = false;
            let bestSimilarity = 0;

            for (const fingerprint of deviceFingerprints) {
                const similarity = deviceFingerprintUtil.calculateSimilarity(
                    currentFingerprint,
                    fingerprint
                );

                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                }

                if (similarity >= 90) {
                    matchFound = true;
                    break;
                }
            }

            // If no match found, flag as a device change
            if (!matchFound) {
                result.detected = true;
                result.details = {
                    bestSimilarity,
                    knownDevices: deviceFingerprints.length
                };

                // Calculate risk score based on similarity
                if (bestSimilarity < 50) {
                    result.score = 40; // Completely different device = higher risk
                } else if (bestSimilarity < 70) {
                    result.score = 30;
                } else {
                    result.score = 20; // Somewhat similar device = lower risk
                }
            }

            return result;
        } catch (error) {
            console.error('Device change check error:', error);
            return result;
        }
    }

    /**
     * Check for location change in token usage
     * @private
     * @param {number} userId - User ID
     * @param {string} currentIp - Current IP address
     * @param {string} sessionIp - IP address from session
     * @returns {Promise<Object>} Detection result
     */
    async _checkForLocationChange(userId, currentIp, sessionIp) {
        const result = {
            detected: false,
            details: null,
            score: 0
        };

        if (!currentIp || !sessionIp || currentIp === sessionIp) {
            return result;
        }

        try {
            // Get locations
            const currentGeo = geoip.lookup(currentIp);
            const sessionGeo = geoip.lookup(sessionIp);

            if (!currentGeo || !sessionGeo) {
                return result;
            }

            // Check for country change
            if (currentGeo.country !== sessionGeo.country) {
                result.detected = true;
                result.details = {
                    sessionCountry: sessionGeo.country,
                    sessionCity: sessionGeo.city || 'Unknown',
                    currentCountry: currentGeo.country,
                    currentCity: currentGeo.city || 'Unknown',
                    sessionIp,
                    currentIp
                };
                result.score = 55; // High risk for cross-country token usage
                return result;
            }

            // Check for city change or significant distance
            if (currentGeo.city !== sessionGeo.city && currentGeo.city && sessionGeo.city) {
                // Calculate distance
                const distance = this._calculateDistance(
                    sessionGeo.ll[0], sessionGeo.ll[1],
                    currentGeo.ll[0], currentGeo.ll[1]
                );

                if (distance > 100) { // 100km threshold
                    result.detected = true;
                    result.details = {
                        sessionCity: sessionGeo.city,
                        currentCity: currentGeo.city,
                        distance,
                        sessionIp,
                        currentIp
                    };
                    result.score = 35; // Medium risk for significant distance change
                }
            }

            return result;
        } catch (error) {
            console.error('Location change check error:', error);
            return result;
        }
    }

    /**
     * Check for device fingerprint deviation
     * @private
     * @param {string} currentFingerprint - Current device fingerprint
     * @param {string} sessionFingerprint - Session device fingerprint
     * @returns {Object} Detection result
     */
    _checkForFingerprintDeviation(currentFingerprint, sessionFingerprint) {
        const result = {
            detected: false,
            details: null,
            score: 0
        };

        if (!currentFingerprint || !sessionFingerprint) {
            return result;
        }

        try {
            // Calculate similarity
            const similarity = deviceFingerprintUtil.calculateSimilarity(
                currentFingerprint,
                sessionFingerprint
            );

            // Flag if similarity is below threshold
            if (similarity < 90) {
                result.detected = true;
                result.details = {
                    similarity,
                    currentFingerprint: currentFingerprint.substring(0, 8) + '...',
                    sessionFingerprint: sessionFingerprint.substring(0, 8) + '...'
                };

                // Calculate risk score based on similarity
                if (similarity < 50) {
                    result.score = 50; // High risk for very different fingerprint
                } else if (similarity < 70) {
                    result.score = 35;
                } else {
                    result.score = 20; // Low risk for minor deviation
                }
            }

            return result;
        } catch (error) {
            console.error('Fingerprint deviation check error:', error);
            return result;
        }
    }

    /**
     * Check for unusual refresh token usage frequency
     * @private
     * @param {number} minutesSinceLastActivity - Minutes since last activity
     * @returns {Object} Detection result
     */
    _checkForUnusualRefreshFrequency(minutesSinceLastActivity) {
        const result = {
            detected: false,
            details: null,
            score: 0
        };

        try {
            // Flag high-frequency token refreshes
            // Normal client refreshes tokens when they're about to expire or after significant time
            if (minutesSinceLastActivity < 2) {
                result.detected = true;
                result.details = {
                    minutesSinceLastActivity,
                    threshold: 2
                };
                result.score = 25; // Medium-low risk
            }

            return result;
        } catch (error) {
            console.error('Unusual refresh frequency check error:', error);
            return result;
        }
    }

    /**
     * Get typical login hours from history
     * @private
     * @param {Array} hours - Array of login hours
     * @returns {Array} Typical login hours
     */
    _getTypicalLoginHours(hours) {
        // Count frequency of each hour
        const hourCounts = {};
        for (const hour of hours) {
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        }

        // Get hours that appear more than once
        const typicalHours = Object.keys(hourCounts)
            .filter(hour => hourCounts[hour] > 1)
            .map(hour => parseInt(hour));

        // If no hours appear more than once, return all unique hours
        if (typicalHours.length === 0) {
            return [...new Set(hours)];
        }

        return typicalHours;
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     * @private
     * @param {number} lat1 - Latitude 1
     * @param {number} lon1 - Longitude 1
     * @param {number} lat2 - Latitude 2
     * @param {number} lon2 - Longitude 2
     * @returns {number} Distance in kilometers
     */
    _calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in kilometers
        const dLat = this._toRadians(lat2 - lat1);
        const dLon = this._toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this._toRadians(lat1)) * Math.cos(this._toRadians(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        return distance;
    }

    /**
     * Convert degrees to radians
     * @private
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    _toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Handle detections from login analysis
     * @private
     * @param {Object} user - User object
     * @param {Array} detections - Detection results
     * @param {number} riskScore - Overall risk score
     * @param {Object} context - Request context
     */
    async _handleDetections(user, detections, riskScore, context) {
        try {
            // Create anomaly detection record
            const anomaly = await db.AnomalyDetection.create({
                user_id: user.id,
                anomaly_type: 'login_behavior',
                confidence: riskScore,
                description: `Suspicious login behavior detected (score: ${riskScore})`,
                metadata: {
                    detections,
                    ip: context.ip,
                    userAgent: context.userAgent,
                    deviceFingerprint: context.deviceFingerprint
                },
                resolved: false
            });

            // Log the detection
            await logService.securityLog({
                eventType: 'detection.suspicious_login',
                severity: riskScore > 50 ? 'high' : 'medium',
                userId: user.id,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    anomalyId: anomaly.id,
                    riskScore,
                    detections: detections.map(d => d.type),
                    userAgent: context.userAgent
                }
            });

            // Take action based on risk score
            if (riskScore > 70) {
                // High risk - send alert to user and security team
                if (user.email) {
                    await emailService.sendSecurityAlert({
                        email: user.email,
                        alertType: 'suspicious_login',
                        eventDetails: {
                            timestamp: new Date(),
                            ipAddress: context.ip,
                            device: context.userAgent,
                            location: this._getLocationFromIp(context.ip)
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Handle detections error:', error);
        }
    }

    /**
     * Handle detections from token usage analysis
     * @private
     * @param {Object} user - User object
     * @param {Object} session - Session object
     * @param {Array} detections - Detection results
     * @param {number} riskScore - Overall risk score
     * @param {Object} context - Request context
     */
    async _handleTokenDetections(user, session, detections, riskScore, context) {
        try {
            // Create anomaly detection record
            const anomaly = await db.AnomalyDetection.create({
                user_id: user.id,
                anomaly_type: 'token_usage',
                confidence: riskScore,
                description: `Suspicious token usage detected (score: ${riskScore})`,
                metadata: {
                    detections,
                    sessionId: session.id,
                    ip: context.ip,
                    userAgent: context.userAgent,
                    deviceFingerprint: context.deviceFingerprint
                },
                resolved: false
            });

            // Log the detection
            await logService.securityLog({
                eventType: 'detection.suspicious_token_usage',
                severity: riskScore > 50 ? 'high' : 'medium',
                userId: user.id,
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    anomalyId: anomaly.id,
                    sessionId: session.id,
                    riskScore,
                    detections: detections.map(d => d.type),
                    userAgent: context.userAgent
                }
            });

            // Take action based on risk score
            if (riskScore > 60) {
                // Invalidate this session for high-risk scenarios
                session.is_valid = false;
                await session.save();

                // Blacklist the tokens
                await db.BlacklistedToken.create({
                    token_id: session.token_id,
                    user_id: user.id,
                    reason: 'security_violation'
                });

                if (session.refresh_token_id) {
                    await db.BlacklistedToken.create({
                        token_id: session.refresh_token_id,
                        user_id: user.id,
                        reason: 'security_violation'
                    });
                }
            }
        } catch (error) {
            console.error('Handle token detections error:', error);
        }
    }

    /**
     * Get location string from IP address
     * @private
     * @param {string} ip - IP address
     * @returns {string} Location string
     */
    _getLocationFromIp(ip) {
        try {
            const geo = geoip.lookup(ip);

            if (!geo) {
                return 'Unknown location';
            }

            return `${geo.city || 'Unknown city'}, ${geo.country}`;
        } catch (error) {
            console.error('Get location from IP error:', error);
            return 'Unknown location';
        }
    }
}

module.exports = new DetectionService();