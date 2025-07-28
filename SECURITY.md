# Security Configuration Guide

## Critical Security Secrets

This application requires several critical security secrets to be properly configured. **The application will refuse to start in production if these secrets are not properly set.**

### Required Secrets

| Secret | Description | Requirements |
|--------|-------------|--------------|
| `ACCESS_TOKEN_SECRET` | JWT access token signing secret | Minimum 32 characters, high entropy |
| `REFRESH_TOKEN_SECRET` | JWT refresh token signing secret | Minimum 32 characters, high entropy |
| `PEPPER` | Password hashing pepper value | Minimum 16 characters, high entropy |
| `CRYPTO_SECRET` | Data encryption secret | Exactly 32 characters, high entropy |

### Generating Secure Secrets

Use the following command to generate cryptographically secure secrets:

```bash
# Generate a 32-character hex secret (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate a 16-character hex secret (32 characters) 
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Generate and set your secrets:
   ```bash
   # Example - replace with your own generated values
   export ACCESS_TOKEN_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
   export REFRESH_TOKEN_SECRET="z6y5x4w3v2u1t0s9r8q7p6o5n4m3l2k1j0i9h8g7f6e5d4c3b2a1"
   export PEPPER="1a2b3c4d5e6f7g8h"
   export CRYPTO_SECRET="12345678901234567890123456789012"
   ```

3. Or add them to your `.env` file:
   ```env
   ACCESS_TOKEN_SECRET=your-secure-access-token-secret-here
   REFRESH_TOKEN_SECRET=your-secure-refresh-token-secret-here
   PEPPER=your-secure-pepper-here
   CRYPTO_SECRET=your-32-character-encryption-secret
   ```

### Security Validation

The application performs comprehensive security validation on startup:

- **Length Requirements**: Ensures secrets meet minimum length requirements
- **Entropy Checks**: Warns about low-entropy secrets (repeated characters)
- **Insecure Defaults**: Prevents use of common default values
- **Pattern Detection**: Blocks common insecure patterns (abc123, password, etc.)

### Production Deployment

In production environments:

1. **Never use default values** - The application will refuse to start
2. **Use a secrets management system** (HashiCorp Vault, AWS Secrets Manager, etc.)
3. **Rotate secrets regularly** according to your security policy
4. **Monitor for security warnings** in application logs

### Development Mode

In development mode:
- The application provides secure random fallbacks if secrets are not set
- Warning messages are shown for missing secrets
- All secrets are still validated for security best practices

### Troubleshooting

If you see this error on startup:
```
🚨 APPLICATION CANNOT START WITH INSECURE SECRETS
```

1. Check that all required environment variables are set
2. Ensure secrets meet length and complexity requirements  
3. Verify secrets are not using default/common values
4. Check the detailed error messages for specific issues

## Open Redirect Protection

The application includes comprehensive protection against open redirect attacks:

### URL Validation
- **Trusted Domains**: Only predefined trusted domains are allowed for redirects
- **Trusted Paths**: Internal redirects are limited to a whitelist of safe paths
- **Path Traversal Protection**: Blocks `..`, `//`, and null byte sequences
- **Protocol Restrictions**: Only HTTP and HTTPS protocols are allowed
- **Credential Filtering**: URLs with embedded credentials are rejected

### Automatic Security Logging
Failed redirect attempts are automatically logged with details including:
- Requested malicious URL
- User IP address and fingerprint
- Reason for rejection
- Safe fallback URL used

### Safe Fallbacks
When invalid redirect URLs are detected, the system automatically:
1. Blocks the malicious redirect
2. Logs the security attempt
3. Redirects to a safe default location (dashboard for authenticated users)

## Timing Attack Protection

The application implements constant-time authentication to prevent timing attacks:

### Constant-Time Operations
- **Password Verification**: Always executes full Argon2 verification, even for non-existent users
- **Minimum Execution Time**: Enforces 350ms minimum for all authentication attempts
- **Dummy User Processing**: Uses realistic dummy data when users don't exist
- **Consistent Database Operations**: Simulates query and permission loading times

### Security Features
- **Username Enumeration Prevention**: Identical response times for valid/invalid usernames
- **Crypto-Based Delays**: Uses cryptographic operations for timing consistency
- **Random Jitter**: Adds small random delays to prevent statistical analysis
- **Timing-Safe Comparisons**: Uses `crypto.timingSafeEqual` for string comparisons

### Performance Impact
- Authentication takes ~350ms regardless of outcome
- Maximum timing variance: <5% between different scenarios
- No performance degradation for legitimate users
- Prevents automated username enumeration attacks

## Device Fingerprint Anti-Spoofing

The application implements comprehensive protection against device fingerprint spoofing:

### Server-Side Validation
- **HMAC-Based Fingerprints**: Uses application secret to generate unforgeable fingerprints
- **Client Validation**: All client-provided fingerprints are validated against server calculations
- **Replay Protection**: Recent fingerprints are cached to prevent replay attacks
- **Component Analysis**: Validates individual fingerprint components for consistency

### Security Features
- **IP Change Detection**: Monitors for IP address changes that may indicate session hijacking
- **Suspicious Pattern Detection**: Identifies bots, scrapers, and headless browsers
- **Similarity Scoring**: Calculates weighted similarity for minor variations
- **Session Invalidation**: Automatically terminates sessions on security violations

### Fingerprint Components
- IP Address (30% weight)
- User Agent (30% weight, normalized)
- Accept-Language (10% weight)
- Platform & Browser Features (30% combined)

### Attack Prevention
- **Spoofing**: Client cannot forge server-calculated fingerprints
- **Replay**: Recently used fingerprints are blocked
- **Session Hijacking**: IP + fingerprint changes trigger security alerts
- **Bot Detection**: Common automation tools are identified and logged

## Cryptographically Secure Random Number Generation

The application uses cryptographically secure random number generation throughout to prevent predictability attacks:

### Secure Random Utility
- **Crypto-based Generation**: All randomness uses `crypto.randomBytes()` instead of weak `Math.random()`
- **Reference Code Generation**: Registration codes use cryptographically secure 9-digit generation
- **Password Shuffling**: Password character shuffling uses Fisher-Yates algorithm with secure randomness
- **Timing Delays**: Even delay mechanisms use secure random generation to prevent timing analysis

### Security Features
- **Reference Codes**: Generated with cryptographically secure random digits (format: XXX-XXX-XXX)
- **Password Generation**: Uses secure character selection and shuffling algorithms
- **Timing Protection**: Random delays use crypto-based generation to prevent analysis
- **Token Generation**: All session and authentication tokens use secure randomness

### Previously Vulnerable Areas (Now Fixed)
- ✅ Reference code generation (was using `Math.random()`)
- ✅ Password shuffling in utilities (was using `Math.random()`)
- ✅ Admin password generation (was using `Math.random()` for shuffling)
- ✅ Email campaign timing delays (was using `Math.random()`)

### Implementation Details
- **Unbiased Random**: Uses rejection sampling to ensure uniform distribution
- **Fisher-Yates Shuffling**: Proper cryptographically secure array/string shuffling
- **Range Generation**: Secure random integers without modulo bias
- **Memory Safety**: Proper handling of random byte buffers

## CSRF Token Security Enhancements

The application implements robust CSRF protection with multiple layers of security to prevent token predictability attacks:

### Enhanced Token Generation
- **Multi-Source Entropy**: Combines `crypto.randomBytes()`, timestamps, and additional random salts
- **Hash-Based Tokens**: Final tokens are SHA-256 hashes preventing length-based analysis
- **Expiration Jitter**: Random ±5 minute variation in token expiry prevents timing prediction
- **Unique Token Keys**: Each token uses entropy-enhanced keys with timestamp variations

### Timing Attack Protection
- **Timing-Safe Comparison**: Uses `crypto.timingSafeEqual()` for all token comparisons
- **Minimum Validation Time**: Enforces 50ms minimum validation time with random delays
- **Random Response Delays**: 10-50ms random delays on validation failures
- **Consistent Processing**: Equal processing time regardless of token validity

### Anti-Predictability Measures
- **One-Time Use**: Tokens are marked as used after successful validation
- **Multiple Key Windows**: Validates against time-window variations to handle race conditions
- **Enhanced Key Generation**: Token keys include IP, User-Agent, language, and random entropy
- **Session Binding**: Tokens are bound to specific sessions with additional entropy

### Security Improvements Made
- ✅ **Token Predictability**: Enhanced entropy sources with hash-based generation
- ✅ **Timing Attacks**: Implemented timing-safe comparisons with minimum validation times
- ✅ **Token Reuse**: Enabled one-time token usage by default
- ✅ **Key Predictability**: Added entropy and timestamp variations to token keys
- ✅ **Response Timing**: Random delays prevent timing-based analysis

### Implementation Details
- **Double-Submit Pattern**: Maintains secure cookie and header/body token validation
- **Database Persistence**: Tokens stored with encryption in database for session recovery
- **Memory Optimization**: In-memory cache with automatic cleanup of expired tokens
- **Security Logging**: Comprehensive logging of all CSRF violations and attempts

### Attack Resistance
- **Entropy Analysis**: Multiple random sources prevent statistical prediction
- **Timing Analysis**: Consistent response times prevent information leakage  
- **Token Replay**: One-time use prevents token reuse attacks
- **Key Enumeration**: Cryptographically secure key generation prevents prediction

### Security Contact

For security-related questions or to report vulnerabilities, please contact the development team.