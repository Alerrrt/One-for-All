const winston = require('winston');

const logger = winston.createLogger({
    level: 'error',
    format: winston.format.json(),
    transports: [new winston.transports.Console()]
});

/**
 * Environment Variable Validation
 * Ensures all required configuration is present before startup
 */

const REQUIRED_VARS = [
    'REDIS_URL',
    'API_KEY',
    'DB_PASSWORD'
];

const OPTIONAL_WITH_DEFAULTS = {
    'NODE_ENV': 'development',
    'API_PORT': '3000',
    'UPLOAD_DIR': '/data/inputs',
    'OUTPUT_DIR': '/data/outputs',
    'MAX_FILE_SIZE_MB': '5000',
    'MAX_CONCURRENT_JOBS': '10',
    'JOB_TIMEOUT_SECONDS': '3600',
    'WORKER_CONCURRENCY': '2',
    'LOG_LEVEL': 'info'
};

/**
 * Validates required environment variables
 * @throws {Error} If required variables are missing
 */
function validateEnvironment() {
    const missing = [];
    const warnings = [];

    // Check required variables
    for (const varName of REQUIRED_VARS) {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    // Special validation for API_KEY
    if (process.env.API_KEY === 'your_api_key_here' ||
        process.env.API_KEY === 'your_secure_api_key' ||
        process.env.API_KEY === 'changeme') {
        warnings.push('API_KEY is set to a default/insecure value. Please use a strong random key.');
    }

    // Special validation for DB_PASSWORD
    if (process.env.DB_PASSWORD === 'postgres' ||
        process.env.DB_PASSWORD === 'password' ||
        process.env.DB_PASSWORD === 'your_secure_password_here') {
        warnings.push('DB_PASSWORD is set to a default/insecure value.');
    }

    // Check NODE_ENV
    if (process.env.NODE_ENV === 'production') {
        // In production, enforce stricter requirements
        if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
            warnings.push('CORS_ORIGIN should be set to specific domain(s) in production, not "*"');
        }
    }

    // Set defaults for optional variables
    for (const [varName, defaultValue] of Object.entries(OPTIONAL_WITH_DEFAULTS)) {
        if (!process.env[varName]) {
            process.env[varName] = defaultValue;
            logger.info(`Using default value for ${varName}: ${defaultValue}`);
        }
    }

    // Report errors and warnings
    if (missing.length > 0) {
        logger.error('Missing required environment variables', { missing });
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (warnings.length > 0) {
        warnings.forEach(warning => {
            logger.warn('Environment configuration warning', { warning });
        });
    }

    logger.info('Environment validation passed', {
        nodeEnv: process.env.NODE_ENV,
        apiPort: process.env.API_PORT
    });

    return true;
}

/**
 * Gets a validated environment variable as integer
 * @param {string} varName - Variable name
 * @param {number} defaultValue - Default if not set or invalid
 * @returns {number}
 */
function getEnvInt(varName, defaultValue) {
    const value = parseInt(process.env[varName]);
    return isNaN(value) ? defaultValue : value;
}

/**
 * Gets a validated environment variable as boolean
 * @param {string} varName - Variable name
 * @param {boolean} defaultValue - Default if not set
 * @returns {boolean}
 */
function getEnvBool(varName, defaultValue) {
    const value = process.env[varName];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1' || value === 'yes';
}

module.exports = {
    validateEnvironment,
    getEnvInt,
    getEnvBool
};
