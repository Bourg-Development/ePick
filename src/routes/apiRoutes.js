const express = require('express');
const router = express.Router();

const authRoutes = require('./api/authRoutes');
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

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/analyses', analysisRoutes);
router.use('/archive', archiveRoutes);
router.use('/patients', patientRoutes);
router.use('/doctors', doctorRoutes);
router.use('/rooms', roomRoutes);
router.use('/org-settings', orgRoutes);
router.use('/user', userRoutes)
router.use('/documents', docRoutes);
router.use('/mailing', mailingListRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/system-updates', systemUpdateRoutes);
router.use('/recurring-analyses', recurringAnalysisRoutes);
router.use('/notifications', notificationRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/status', statusRoutes);
router.use('/system', systemRoutes);
router.use('/announcements', announcementRoutes);
router.use('/forensics', forensicsRoutes);
router.use('/data', dataImportExportRoutes);
router.use('/ics', icsRoutes);

module.exports = router;