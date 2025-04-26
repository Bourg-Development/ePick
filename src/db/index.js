// db/index.js
const { sequelize, Sequelize } = require('../config/database');

// Import models
const User = require('./models/User')(sequelize, Sequelize);
const Role = require('./models/Role')(sequelize, Sequelize);
const Permission = require('./models/Permission')(sequelize, Sequelize);
const RolePermission = require('./models/RolePermission')(sequelize, Sequelize);
const Service = require('./models/Service')(sequelize, Sequelize);
const Session = require('./models/Session')(sequelize, Sequelize);
const RefCode = require('./models/RefCode')(sequelize, Sequelize);
const PasswordHistory = require('./models/PasswordHistory')(sequelize, Sequelize);
const AuditLog = require('./models/AuditLog')(sequelize, Sequelize);
const SecurityLog = require('./models/SecurityLog')(sequelize, Sequelize);
const BlacklistedToken = require('./models/BlacklistedToken')(sequelize, Sequelize);
const AnomalyDetection = require('./models/AnomalyDetection')(sequelize, Sequelize);
const RateLimit = require('./models/RateLimit')(sequelize, Sequelize);
const UserPreference = require('./models/UserPreference')(sequelize, Sequelize);

// Define associations

// Role-Permission associations
Role.belongsToMany(Permission, { through: RolePermission });
Permission.belongsToMany(Role, { through: RolePermission });

// User associations
User.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(User, { foreignKey: 'role_id' });

User.belongsTo(Service, { foreignKey: 'service_id' });
Service.hasMany(User, { foreignKey: 'service_id' });

User.belongsTo(User, { as: 'Creator', foreignKey: 'created_by' });

// Session associations
Session.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Session, { foreignKey: 'user_id' });

// Reference code associations
RefCode.belongsTo(User, { as: 'TargetUser', foreignKey: 'user_id' });
RefCode.belongsTo(User, { as: 'Creator', foreignKey: 'created_by' });
User.hasMany(RefCode, { foreignKey: 'user_id' });

// Password history associations
PasswordHistory.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(PasswordHistory, { foreignKey: 'user_id' });

// Log associations
AuditLog.belongsTo(User, { as: 'User', foreignKey: 'user_id' });
User.hasMany(AuditLog, { foreignKey: 'user_id' });

SecurityLog.belongsTo(User, { as: 'User', foreignKey: 'user_id' });
User.hasMany(SecurityLog, { foreignKey: 'user_id' });

// Blacklisted token associations
BlacklistedToken.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(BlacklistedToken, { foreignKey: 'user_id' });

// Anomaly detection associations
AnomalyDetection.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(AnomalyDetection, { foreignKey: 'user_id' });

AnomalyDetection.belongsTo(User, { as: 'Resolver', foreignKey: 'resolved_by' });

// User preferences associations
UserPreference.belongsTo(User, { foreignKey: 'user_id' });
User.hasOne(UserPreference, { foreignKey: 'user_id' });

// Export models and sequelize instance
module.exports = {
    sequelize,
    Sequelize,
    User,
    Role,
    Permission,
    RolePermission,
    Service,
    Session,
    RefCode,
    PasswordHistory,
    AuditLog,
    SecurityLog,
    BlacklistedToken,
    AnomalyDetection,
    RateLimit,
    UserPreference
};