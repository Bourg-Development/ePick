// utils/timingSafeAuth.js

/**
 * Timing-safe authentication utilities to prevent timing attacks
 * Ensures constant-time responses regardless of authentication outcome
 */

const crypto = require('crypto');
const argon2Util = require('./argon2');

/**
 * Dummy user object for timing-safe operations when user doesn't exist
 * Uses realistic but invalid data to ensure similar processing time
 */
const DUMMY_USER = {
    id: 0,
    username: 'dummy_user_for_timing_safety',
    // Pre-generated dummy hash to ensure consistent timing
    // This is the hash of 'dummy_password_never_matches' with a known salt
    password_hash: '$argon2id$v=19$m=65536,t=3,p=4$c29tZV9zYWx0X3ZhbHVl$RdescudvJCsgt3ub+b8QWDWfJHDDmHhBBnn7nxZzVko',
    salt: 'some_salt_value',
    account_locked: false,
    account_locked_until: null,
    failed_login_attempts: 0,
    totp_enabled: false,
    totp_secret: null,
    webauthn_enabled: false,
    webauthn_credentials: null,
    last_login_attempt: new Date(),
    role: {
        name: 'dummy_role',
        permissions: []
    }
};

/**
 * Minimum time for authentication operations (in milliseconds)
 * This should be longer than the typical successful authentication time
 */
const MIN_AUTH_TIME = 350; // 350ms minimum

/**
 * Performs timing-safe password verification
 * Always performs the same operations regardless of user existence
 * 
 * @param {string} password - The password to verify
 * @param {Object|null} user - User object or null if user doesn't exist
 * @returns {Promise<Object>} Result with user and verification status
 */
async function timingSafePasswordVerification(password, user) {
    const startTime = Date.now();
    
    // Use actual user or dummy user for consistent operations
    const targetUser = user || DUMMY_USER;
    const targetPasswordHash = targetUser.password_hash || DUMMY_USER.password_hash;
    const targetSalt = targetUser.salt || DUMMY_USER.salt;
    
    let isValid = false;
    let verificationError = null;
    
    try {
        // Always perform password verification to ensure consistent timing
        isValid = await argon2Util.verifyPassword(password, targetPasswordHash, targetSalt);
        
        // If we're using dummy user, always return false
        if (!user) {
            isValid = false;
        }
    } catch (error) {
        // Log the error but don't expose it
        console.error('Password verification error:', error);
        verificationError = error;
        isValid = false;
    }
    
    // Calculate elapsed time
    const elapsedTime = Date.now() - startTime;
    
    // Add delay to ensure minimum time
    if (elapsedTime < MIN_AUTH_TIME) {
        await constantTimeDelay(MIN_AUTH_TIME - elapsedTime);
    }
    
    return {
        user: user || null,
        isValid,
        isDummy: !user,
        error: verificationError
    };
}

/**
 * Performs timing-safe user lookup
 * Returns a consistent response time whether user exists or not
 * 
 * @param {Function} findUserFunc - Function to find user in database
 * @param {string} username - Username to look up
 * @returns {Promise<Object>} User object or null
 */
async function timingSafeUserLookup(findUserFunc, username) {
    const startTime = Date.now();
    
    let user = null;
    let lookupError = null;
    
    try {
        user = await findUserFunc(username);
    } catch (error) {
        console.error('User lookup error:', error);
        lookupError = error;
    }
    
    // Add small random delay to prevent timing analysis of database queries
    const randomDelay = crypto.randomInt(5, 15); // 5-15ms random delay
    await constantTimeDelay(randomDelay);
    
    return {
        user,
        error: lookupError
    };
}

/**
 * Constant-time delay function
 * Uses crypto operations to ensure the delay isn't optimized away
 * 
 * @param {number} milliseconds - Delay duration in milliseconds
 */
async function constantTimeDelay(milliseconds) {
    if (milliseconds <= 0) return;
    
    const endTime = Date.now() + milliseconds;
    
    // Perform dummy crypto operations to ensure CPU usage
    while (Date.now() < endTime) {
        // Generate random bytes to prevent optimization
        crypto.randomBytes(16);
        
        // Small async break to prevent blocking
        if (Date.now() + 10 < endTime) {
            await new Promise(resolve => setImmediate(resolve));
        }
    }
}

/**
 * Timing-safe string comparison
 * Uses crypto.timingSafeEqual for constant-time comparison
 * 
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
function timingSafeStringCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }
    
    // Convert to buffers with same length
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    
    // If lengths differ, pad the shorter one (but still return false)
    if (bufferA.length !== bufferB.length) {
        const maxLength = Math.max(bufferA.length, bufferB.length);
        const paddedA = Buffer.alloc(maxLength);
        const paddedB = Buffer.alloc(maxLength);
        bufferA.copy(paddedA);
        bufferB.copy(paddedB);
        
        try {
            crypto.timingSafeEqual(paddedA, paddedB);
        } catch {
            // Will throw because they're different
        }
        return false;
    }
    
    try {
        return crypto.timingSafeEqual(bufferA, bufferB);
    } catch {
        return false;
    }
}

/**
 * Generates consistent fake processing for non-existent users
 * Simulates database operations and other processing
 */
async function simulateUserProcessing() {
    // Simulate database query time
    await constantTimeDelay(crypto.randomInt(10, 30));
    
    // Simulate permission loading
    await constantTimeDelay(crypto.randomInt(5, 15));
    
    // Generate some dummy data to simulate processing
    const dummyData = {
        permissions: Array(10).fill(null).map(() => crypto.randomBytes(8).toString('hex')),
        metadata: crypto.randomBytes(32).toString('hex')
    };
    
    return dummyData;
}

/**
 * Wraps an authentication function to make it timing-safe
 * 
 * @param {Function} authFunction - Original authentication function
 * @returns {Function} Timing-safe version of the function
 */
function makeAuthTimingSafe(authFunction) {
    return async function timingSafeWrapper(...args) {
        const startTime = Date.now();
        
        try {
            const result = await authFunction.apply(this, args);
            
            // Ensure minimum execution time
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < MIN_AUTH_TIME) {
                await constantTimeDelay(MIN_AUTH_TIME - elapsedTime);
            }
            
            return result;
        } catch (error) {
            // Even errors should take consistent time
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < MIN_AUTH_TIME) {
                await constantTimeDelay(MIN_AUTH_TIME - elapsedTime);
            }
            
            throw error;
        }
    };
}

module.exports = {
    timingSafePasswordVerification,
    timingSafeUserLookup,
    constantTimeDelay,
    timingSafeStringCompare,
    simulateUserProcessing,
    makeAuthTimingSafe,
    DUMMY_USER,
    MIN_AUTH_TIME
};