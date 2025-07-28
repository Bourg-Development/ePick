// db/models/CSRFToken.js
module.exports = (sequelize, DataTypes) => {
    const CSRFToken = sequelize.define('CSRFToken', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        token_key: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Unique identifier for the token (session, user, or anonymous hash)'
        },
        token_value: {
            type: DataTypes.STRING(64),
            allowNull: false,
            comment: 'The actual CSRF token value'
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: 'When this token expires'
        },
        used: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            comment: 'Whether this token has been used (for one-time tokens)'
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            comment: 'When this token was created'
        }
    }, {
        tableName: 'csrf_tokens',
        timestamps: false, // We handle timestamps manually
        indexes: [
            {
                fields: ['token_key'],
                name: 'idx_csrf_tokens_key'
            },
            {
                fields: ['token_value'],
                name: 'idx_csrf_tokens_value'
            },
            {
                fields: ['expires_at'],
                name: 'idx_csrf_tokens_expires'
            },
            {
                unique: true,
                fields: ['token_key', 'token_value'],
                name: 'uk_csrf_tokens_key_value'
            }
        ],
        comment: 'CSRF tokens for request forgery protection'
    });

    return CSRFToken;
};