// db/index.js
const { sequelize, Sequelize } = require('../config/database');

// Import authentication models
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
const CSRFToken = require('./models/CSRFToken')(sequelize, Sequelize);

// Import blood analysis models
const OrganizationSettings = require('./models/OrganizationSettings')(sequelize, Sequelize);
const Doctor = require('./models/Doctor')(sequelize, Sequelize);
const Room = require('./models/Room')(sequelize, Sequelize);
const Patient = require('./models/Patient')(sequelize, Sequelize);
const Analysis = require('./models/Analysis')(sequelize, Sequelize);
const ArchivedAnalysis = require('./models/ArchivedAnalysis')(sequelize, Sequelize);
const RecurringAnalysis = require('./models/RecurringAnalysis')(sequelize, Sequelize);
const Prescription = require('./models/Prescription')(sequelize, Sequelize);
const Notification = require('./models/Notification')(sequelize, Sequelize);
const SystemAnnouncement = require('./models/SystemAnnouncement')(sequelize, Sequelize);
const AnnouncementView = require('./models/AnnouncementView')(sequelize, Sequelize);

// Import mailing list models
const MailingList = require('./models/MailingList')(sequelize, Sequelize);
const MailingListSubscriber = require('./models/MailingListSubscriber')(sequelize, Sequelize);
const EmailCampaign = require('./models/EmailCampaign')(sequelize, Sequelize);
const CampaignTracking = require('./models/CampaignTracking')(sequelize, Sequelize);

// Import maintenance models
const ScheduledMaintenance = require('./models/ScheduledMaintenance')(sequelize, Sequelize);

// Import system update models
const SystemUpdate = require('./models/SystemUpdate')(sequelize, Sequelize);
const UserUpdateAcknowledgment = require('./models/UserUpdateAcknowledgment')(sequelize, Sequelize);

// Import status page models
const SystemStatus = require('./models/SystemStatus')(sequelize, Sequelize);
const StatusIncident = require('./models/StatusIncident')(sequelize, Sequelize);
const StatusIncidentUpdate = require('./models/StatusIncidentUpdate')(sequelize, Sequelize);

// ========== DEFINE ASSOCIATIONS ==========

// ========== AUTHENTICATION ASSOCIATIONS ==========

// Role-Permission associations
Role.belongsToMany(Permission, { through: RolePermission, as: 'permissions' });
Permission.belongsToMany(Role, { through: RolePermission, as: 'roles' });

// User associations
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });

User.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
Service.hasMany(User, { foreignKey: 'service_id', as: 'users' });

User.belongsTo(User, { as: 'Creator', foreignKey: 'created_by' });
User.hasMany(User, { as: 'CreatedUsers', foreignKey: 'created_by' });

// Session associations
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });

// Reference code associations
RefCode.belongsTo(User, { as: 'TargetUser', foreignKey: 'user_id' });
RefCode.belongsTo(User, { as: 'Creator', foreignKey: 'created_by' });
User.hasMany(RefCode, { foreignKey: 'user_id', as: 'refCodes' });
User.hasMany(RefCode, { foreignKey: 'created_by', as: 'createdRefCodes' });

// Password history associations
PasswordHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(PasswordHistory, { foreignKey: 'user_id', as: 'passwordHistory' });

// Log associations
AuditLog.belongsTo(User, { as: 'User', foreignKey: 'user_id' });
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });

SecurityLog.belongsTo(User, { as: 'User', foreignKey: 'user_id' });
User.hasMany(SecurityLog, { foreignKey: 'user_id', as: 'securityLogs' });

// Blacklisted token associations
BlacklistedToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(BlacklistedToken, { foreignKey: 'user_id', as: 'blacklistedTokens' });

// Anomaly detection associations
AnomalyDetection.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(AnomalyDetection, { foreignKey: 'user_id', as: 'anomalies' });

AnomalyDetection.belongsTo(User, { as: 'Resolver', foreignKey: 'resolved_by' });
User.hasMany(AnomalyDetection, { foreignKey: 'resolved_by', as: 'resolvedAnomalies' });

// User preferences associations
UserPreference.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(UserPreference, { foreignKey: 'user_id', as: 'preferences' });

// ========== BLOOD ANALYSIS ASSOCIATIONS ==========

// Organization Settings associations
OrganizationSettings.belongsTo(User, { foreignKey: 'updated_by', as: 'updatedBy' });
User.hasMany(OrganizationSettings, { foreignKey: 'updated_by', as: 'updatedSettings' });

// Doctor associations
Doctor.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Doctor, { foreignKey: 'created_by', as: 'createdDoctors' });

// Room associations
Room.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Room, { foreignKey: 'created_by', as: 'createdRooms' });

// Patient associations
Patient.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });
Patient.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
Patient.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

Doctor.hasMany(Patient, { foreignKey: 'doctor_id', as: 'patients' });
Room.hasMany(Patient, { foreignKey: 'room_id', as: 'patients' });
User.hasMany(Patient, { foreignKey: 'created_by', as: 'createdPatients' });

Service.hasMany(Room, { foreignKey: 'service_id', as: 'rooms' });
Room.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });

// Analysis associations
Analysis.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });
Analysis.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });
Analysis.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
Analysis.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Analysis.belongsTo(User, { foreignKey: 'completed_by', as: 'completedBy' });

Patient.hasMany(Analysis, { foreignKey: 'patient_id', as: 'analyses' });
Doctor.hasMany(Analysis, { foreignKey: 'doctor_id', as: 'analyses' });
Room.hasMany(Analysis, { foreignKey: 'room_id', as: 'analyses' });
User.hasMany(Analysis, { foreignKey: 'created_by', as: 'createdAnalyses' });
User.hasMany(Analysis, { foreignKey: 'completed_by', as: 'completedAnalyses' });

// Recurring Analysis associations
RecurringAnalysis.belongsTo(Patient, { foreignKey: 'patient_id', as: 'Patient' });
RecurringAnalysis.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'Doctor' });
RecurringAnalysis.belongsTo(Room, { foreignKey: 'room_id', as: 'Room' });
RecurringAnalysis.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });

Patient.hasMany(RecurringAnalysis, { foreignKey: 'patient_id', as: 'recurringAnalyses' });
Doctor.hasMany(RecurringAnalysis, { foreignKey: 'doctor_id', as: 'recurringAnalyses' });
Room.hasMany(RecurringAnalysis, { foreignKey: 'room_id', as: 'recurringAnalyses' });
User.hasMany(RecurringAnalysis, { foreignKey: 'created_by', as: 'createdRecurringAnalyses' });

// Analysis to RecurringAnalysis relationship
Analysis.belongsTo(RecurringAnalysis, { foreignKey: 'recurring_analysis_id', as: 'recurringPattern' });
RecurringAnalysis.hasMany(Analysis, { foreignKey: 'recurring_analysis_id', as: 'analyses' });

// Prescription associations
Prescription.belongsTo(RecurringAnalysis, { foreignKey: 'recurring_analysis_id', as: 'recurringAnalysis' });
Prescription.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });
Prescription.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });
Prescription.belongsTo(User, { foreignKey: 'prescribed_by', as: 'prescriber' });

RecurringAnalysis.hasMany(Prescription, { foreignKey: 'recurring_analysis_id', as: 'prescriptions' });
Patient.hasMany(Prescription, { foreignKey: 'patient_id', as: 'prescriptions' });
Doctor.hasMany(Prescription, { foreignKey: 'doctor_id', as: 'prescriptions' });
User.hasMany(Prescription, { foreignKey: 'prescribed_by', as: 'prescribedPrescriptions' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });

// Archived Analysis associations
ArchivedAnalysis.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' });
ArchivedAnalysis.belongsTo(Doctor, { foreignKey: 'doctor_id', as: 'doctor' });
ArchivedAnalysis.belongsTo(Room, { foreignKey: 'room_id', as: 'room' });
ArchivedAnalysis.belongsTo(User, { foreignKey: 'archived_by', as: 'archivedBy' });
ArchivedAnalysis.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
ArchivedAnalysis.belongsTo(User, { foreignKey: 'completed_by', as: 'completedBy' });

Patient.hasMany(ArchivedAnalysis, { foreignKey: 'patient_id', as: 'archivedAnalyses' });
Doctor.hasMany(ArchivedAnalysis, { foreignKey: 'doctor_id', as: 'archivedAnalyses' });
Room.hasMany(ArchivedAnalysis, { foreignKey: 'room_id', as: 'archivedAnalyses' });
User.hasMany(ArchivedAnalysis, { foreignKey: 'archived_by', as: 'archivedAnalyses' });
User.hasMany(ArchivedAnalysis, { foreignKey: 'created_by', as: 'createdArchivedAnalyses' });
User.hasMany(ArchivedAnalysis, { foreignKey: 'completed_by', as: 'completedArchivedAnalyses' });

// ========== MAILING LIST ASSOCIATIONS ==========

// Mailing List associations
MailingList.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(MailingList, { foreignKey: 'created_by', as: 'createdMailingLists' });

MailingList.hasMany(MailingListSubscriber, { foreignKey: 'list_id', as: 'subscribers' });
MailingListSubscriber.belongsTo(MailingList, { foreignKey: 'list_id', as: 'mailingList' });

MailingList.hasMany(EmailCampaign, { foreignKey: 'list_id', as: 'campaigns' });
EmailCampaign.belongsTo(MailingList, { foreignKey: 'list_id', as: 'mailingList' });

// Subscriber associations
MailingListSubscriber.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(MailingListSubscriber, { foreignKey: 'user_id', as: 'mailingSubscriptions' });

MailingListSubscriber.belongsTo(Service, { foreignKey: 'service_id', as: 'service' });
Service.hasMany(MailingListSubscriber, { foreignKey: 'service_id', as: 'mailingSubscriptions' });

// Campaign associations
EmailCampaign.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(EmailCampaign, { foreignKey: 'created_by', as: 'createdCampaigns' });

EmailCampaign.hasMany(CampaignTracking, { foreignKey: 'campaign_id', as: 'tracking' });
CampaignTracking.belongsTo(EmailCampaign, { foreignKey: 'campaign_id', as: 'campaign' });

MailingListSubscriber.hasMany(CampaignTracking, { foreignKey: 'subscriber_id', as: 'campaignTracking' });
CampaignTracking.belongsTo(MailingListSubscriber, { foreignKey: 'subscriber_id', as: 'subscriber' });

// ========== MAINTENANCE ASSOCIATIONS ==========

// Scheduled Maintenance associations
ScheduledMaintenance.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(ScheduledMaintenance, { foreignKey: 'created_by', as: 'createdMaintenances' });

// ========== SYSTEM UPDATE ASSOCIATIONS ==========

// System Update associations
SystemUpdate.belongsTo(User, { foreignKey: 'published_by', as: 'publisher' });
User.hasMany(SystemUpdate, { foreignKey: 'published_by', as: 'publishedUpdates' });

SystemUpdate.hasMany(UserUpdateAcknowledgment, { foreignKey: 'update_id', as: 'acknowledgments' });
UserUpdateAcknowledgment.belongsTo(SystemUpdate, { foreignKey: 'update_id', as: 'update' });

UserUpdateAcknowledgment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(UserUpdateAcknowledgment, { foreignKey: 'user_id', as: 'updateAcknowledgments' });

// ========== STATUS PAGE ASSOCIATIONS ==========

// Status Incident associations
StatusIncident.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(StatusIncident, { foreignKey: 'created_by', as: 'createdIncidents' });

StatusIncident.hasMany(StatusIncidentUpdate, { foreignKey: 'incident_id', as: 'updates' });
StatusIncidentUpdate.belongsTo(StatusIncident, { foreignKey: 'incident_id', as: 'incident' });

StatusIncidentUpdate.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(StatusIncidentUpdate, { foreignKey: 'created_by', as: 'createdIncidentUpdates' });

// ========== ANNOUNCEMENT ASSOCIATIONS ==========

// SystemAnnouncement associations
SystemAnnouncement.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(SystemAnnouncement, { foreignKey: 'created_by', as: 'createdAnnouncements' });

SystemAnnouncement.hasMany(AnnouncementView, { foreignKey: 'announcement_id', as: 'views' });
AnnouncementView.belongsTo(SystemAnnouncement, { foreignKey: 'announcement_id', as: 'announcement' });

// AnnouncementView associations
AnnouncementView.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(AnnouncementView, { foreignKey: 'user_id', as: 'announcementViews' });

// Export models and sequelize instance
module.exports = {
    sequelize,
    Sequelize,
    // Authentication models
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
    UserPreference,
    CSRFToken,
    // Blood analysis models
    OrganizationSettings,
    Doctor,
    Room,
    Patient,
    Analysis,
    ArchivedAnalysis,
    RecurringAnalysis,
    Prescription,
    Notification,
    SystemAnnouncement,
    AnnouncementView,
    // Mailing list models
    MailingList,
    MailingListSubscriber,
    EmailCampaign,
    CampaignTracking,
    // Maintenance models
    ScheduledMaintenance,
    // System update models
    SystemUpdate,
    UserUpdateAcknowledgment,
    // Status page models
    SystemStatus,
    StatusIncident,
    StatusIncidentUpdate
};