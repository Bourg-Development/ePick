const express = require('express');
const router = express.Router();

// Import CSRF protection middleware
const { verifyCSRFToken, setCSRFToken } = require('../middleware/csrf');

const authRoutes = require('./api/authRoutes');
const csrfRoutes = require('./api/csrfRoutes');
const adminRoutes = require("./api/adminRoutes");
const patientRoutes = require('./api/patientRoutes');
const analysisRoutes = require('./api/analysisRoutes');
const archiveRoutes = require('./api/archiveRoutes')
const doctorRoutes = require('./api/doctorRoutes')
const roomRoutes = require('./api/roomRoutes');
const orgRoutes = require('./api/orgRoutes');
const userRoutes = require('./api/userRoutes');
const docRoutes = require('./api/docRoutes');
const mailingListRoutes = require('./api/mailingListRoutes');
const dashboardRoutes = require('./api/dashboardRoutes');
const maintenanceRoutes = require('./api/maintenanceRoutes');
const systemUpdateRoutes = require('./api/systemUpdateRoutes');
const recurringAnalysisRoutes = require('./api/recurringAnalysisRoutes');
const notificationRoutes = require('./api/notificationRoutes');
const prescriptionRoutes = require('./api/prescriptionRoutes');
const statusRoutes = require('./api/statusRoutes');
const systemRoutes = require('./api/systemRoutes');
const announcementRoutes = require('./api/announcementRoutes');
const forensicsRoutes = require('./api/forensicsRoutes');
const dataImportExportRoutes = require('./api/dataImportExportRoutes');
const icsRoutes = require('./api/icsRoutes');

// CSRF token endpoints (no CSRF protection needed for token generation)
router.use('/csrf', csrfRoutes);

// Authentication routes (no CSRF protection for login/register)
router.use('/auth', authRoutes);

// Protected routes with CSRF verification for state-changing operations
router.use('/admin', verifyCSRFToken, adminRoutes);
router.use('/analyses', verifyCSRFToken, analysisRoutes);
router.use('/archive', verifyCSRFToken, archiveRoutes);
router.use('/patients', verifyCSRFToken, patientRoutes);
router.use('/doctors', verifyCSRFToken, doctorRoutes);
router.use('/rooms', verifyCSRFToken, roomRoutes);
router.use('/org-settings', verifyCSRFToken, orgRoutes);
router.use('/user', verifyCSRFToken, userRoutes);
router.use('/documents', verifyCSRFToken, docRoutes);
router.use('/mailing', verifyCSRFToken, mailingListRoutes);
router.use('/maintenance', verifyCSRFToken, maintenanceRoutes);
router.use('/system-updates', verifyCSRFToken, systemUpdateRoutes);
router.use('/recurring-analyses', verifyCSRFToken, recurringAnalysisRoutes);
router.use('/notifications', verifyCSRFToken, notificationRoutes);
router.use('/prescriptions', verifyCSRFToken, prescriptionRoutes);
router.use('/system', verifyCSRFToken, systemRoutes);
router.use('/announcements', verifyCSRFToken, announcementRoutes);
router.use('/forensics', verifyCSRFToken, forensicsRoutes);
router.use('/data', verifyCSRFToken, dataImportExportRoutes);
router.use('/ics', verifyCSRFToken, icsRoutes);

// Read-only routes (no CSRF protection needed)
router.use('/dashboard', dashboardRoutes);
router.use('/status', statusRoutes);

module.exports = router;