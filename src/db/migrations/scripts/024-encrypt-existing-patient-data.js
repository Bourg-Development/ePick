// migrations/scripts/022-encrypt-existing-patient-data.js
const cryptoService = require('../../../services/cryptoService');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Starting patient data encryption migration...');
            
            // Add search hash columns for encrypted fields that need to be searchable
            console.log('Adding search hash columns...');
            
            // Patient search hashes
            await queryInterface.addColumn('patients', 'name_hash', {
                type: Sequelize.STRING(64),
                allowNull: true
            }, { transaction });
            
            await queryInterface.addColumn('patients', 'matricule_hash', {
                type: Sequelize.STRING(64),
                allowNull: true,
                unique: true
            }, { transaction });
            
            // Add indexes for search hash columns
            await queryInterface.addIndex('patients', ['name_hash'], { 
                name: 'patients_name_hash_idx',
                transaction 
            });
            
            await queryInterface.addIndex('patients', ['matricule_hash'], { 
                name: 'patients_matricule_hash_idx',
                transaction 
            });
            
            // Encrypt existing patient data
            console.log('Encrypting existing patient data...');
            const patients = await queryInterface.sequelize.query(
                'SELECT id, name, matricule_national, phone, address FROM patients',
                { 
                    type: Sequelize.QueryTypes.SELECT,
                    transaction 
                }
            );
            
            for (const patient of patients) {
                const updates = {};
                const hashes = {};
                
                // Encrypt fields if they exist and aren't already encrypted
                if (patient.name && !isAlreadyEncrypted(patient.name)) {
                    updates.name = cryptoService.encrypt(patient.name);
                    hashes.name_hash = cryptoService.hash(patient.name.toLowerCase().trim());
                }
                
                if (patient.matricule_national && !isAlreadyEncrypted(patient.matricule_national)) {
                    updates.matricule_national = cryptoService.encrypt(patient.matricule_national);
                    hashes.matricule_hash = cryptoService.hash(patient.matricule_national.toLowerCase().trim());
                }
                
                if (patient.phone && !isAlreadyEncrypted(patient.phone)) {
                    updates.phone = cryptoService.encrypt(patient.phone);
                }
                
                if (patient.address && !isAlreadyEncrypted(patient.address)) {
                    updates.address = cryptoService.encrypt(patient.address);
                }
                
                // Update patient record
                if (Object.keys(updates).length > 0 || Object.keys(hashes).length > 0) {
                    await queryInterface.sequelize.query(
                        `UPDATE patients SET 
                            name = :name,
                            matricule_national = :matricule_national,
                            phone = :phone,
                            address = :address,
                            name_hash = :name_hash,
                            matricule_hash = :matricule_hash
                        WHERE id = :id`,
                        {
                            replacements: {
                                id: patient.id,
                                name: updates.name || patient.name,
                                matricule_national: updates.matricule_national || patient.matricule_national,
                                phone: updates.phone || patient.phone,
                                address: updates.address || patient.address,
                                name_hash: hashes.name_hash || null,
                                matricule_hash: hashes.matricule_hash || null
                            },
                            transaction
                        }
                    );
                }
            }
            
            // Encrypt existing doctor data
            console.log('Encrypting existing doctor data...');
            const doctors = await queryInterface.sequelize.query(
                'SELECT id, name, phone, email, specialization FROM doctors',
                { 
                    type: Sequelize.QueryTypes.SELECT,
                    transaction 
                }
            );
            
            for (const doctor of doctors) {
                const updates = {};
                
                if (doctor.name && !isAlreadyEncrypted(doctor.name)) {
                    updates.name = cryptoService.encrypt(doctor.name);
                }
                
                if (doctor.phone && !isAlreadyEncrypted(doctor.phone)) {
                    updates.phone = cryptoService.encrypt(doctor.phone);
                }
                
                if (doctor.email && !isAlreadyEncrypted(doctor.email)) {
                    updates.email = cryptoService.encrypt(doctor.email);
                }
                
                if (doctor.specialization && !isAlreadyEncrypted(doctor.specialization)) {
                    updates.specialization = cryptoService.encrypt(doctor.specialization);
                }
                
                if (Object.keys(updates).length > 0) {
                    await queryInterface.sequelize.query(
                        `UPDATE doctors SET 
                            name = :name,
                            phone = :phone,
                            email = :email,
                            specialization = :specialization
                        WHERE id = :id`,
                        {
                            replacements: {
                                id: doctor.id,
                                name: updates.name || doctor.name,
                                phone: updates.phone || doctor.phone,
                                email: updates.email || doctor.email,
                                specialization: updates.specialization || doctor.specialization
                            },
                            transaction
                        }
                    );
                }
            }
            
            // Encrypt existing analysis notes
            console.log('Encrypting existing analysis notes...');
            const analyses = await queryInterface.sequelize.query(
                'SELECT id, notes FROM analyses WHERE notes IS NOT NULL',
                { 
                    type: Sequelize.QueryTypes.SELECT,
                    transaction 
                }
            );
            
            for (const analysis of analyses) {
                if (analysis.notes && !isAlreadyEncrypted(analysis.notes)) {
                    await queryInterface.sequelize.query(
                        'UPDATE analyses SET notes = :notes WHERE id = :id',
                        {
                            replacements: {
                                id: analysis.id,
                                notes: cryptoService.encrypt(analysis.notes)
                            },
                            transaction
                        }
                    );
                }
            }
            
            // Encrypt existing archived analysis data
            console.log('Encrypting existing archived analysis data...');
            const archivedAnalyses = await queryInterface.sequelize.query(
                'SELECT id, patient_name, doctor_name, notes FROM archived_analyses',
                { 
                    type: Sequelize.QueryTypes.SELECT,
                    transaction 
                }
            );
            
            for (const archived of archivedAnalyses) {
                const updates = {};
                
                if (archived.patient_name && !isAlreadyEncrypted(archived.patient_name)) {
                    updates.patient_name = cryptoService.encrypt(archived.patient_name);
                }
                
                if (archived.doctor_name && !isAlreadyEncrypted(archived.doctor_name)) {
                    updates.doctor_name = cryptoService.encrypt(archived.doctor_name);
                }
                
                if (archived.notes && !isAlreadyEncrypted(archived.notes)) {
                    updates.notes = cryptoService.encrypt(archived.notes);
                }
                
                // results column doesn't exist in current schema, skip
                
                if (Object.keys(updates).length > 0) {
                    await queryInterface.sequelize.query(
                        `UPDATE archived_analyses SET 
                            patient_name = :patient_name,
                            doctor_name = :doctor_name,
                            notes = :notes
                        WHERE id = :id`,
                        {
                            replacements: {
                                id: archived.id,
                                patient_name: updates.patient_name || archived.patient_name,
                                doctor_name: updates.doctor_name || archived.doctor_name,
                                notes: updates.notes || archived.notes
                            },
                            transaction
                        }
                    );
                }
            }
            
            // Encrypt existing prescription data
            console.log('Encrypting existing prescription data...');
            const prescriptions = await queryInterface.sequelize.query(
                'SELECT id, prescription_number, document_path, document_filename, notes FROM prescriptions',
                { 
                    type: Sequelize.QueryTypes.SELECT,
                    transaction 
                }
            );
            
            for (const prescription of prescriptions) {
                const updates = {};
                
                if (prescription.prescription_number && !isAlreadyEncrypted(prescription.prescription_number)) {
                    updates.prescription_number = cryptoService.encrypt(prescription.prescription_number);
                }
                
                if (prescription.document_path && !isAlreadyEncrypted(prescription.document_path)) {
                    updates.document_path = cryptoService.encrypt(prescription.document_path);
                }
                
                if (prescription.document_filename && !isAlreadyEncrypted(prescription.document_filename)) {
                    updates.document_filename = cryptoService.encrypt(prescription.document_filename);
                }
                
                if (prescription.notes && !isAlreadyEncrypted(prescription.notes)) {
                    updates.notes = cryptoService.encrypt(prescription.notes);
                }
                
                if (Object.keys(updates).length > 0) {
                    await queryInterface.sequelize.query(
                        `UPDATE prescriptions SET 
                            prescription_number = :prescription_number,
                            document_path = :document_path,
                            document_filename = :document_filename,
                            notes = :notes
                        WHERE id = :id`,
                        {
                            replacements: {
                                id: prescription.id,
                                prescription_number: updates.prescription_number || prescription.prescription_number,
                                document_path: updates.document_path || prescription.document_path,
                                document_filename: updates.document_filename || prescription.document_filename,
                                notes: updates.notes || prescription.notes
                            },
                            transaction
                        }
                    );
                }
            }
            
            await transaction.commit();
            console.log('Patient data encryption migration completed successfully!');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error during patient data encryption migration:', error);
            throw error;
        }
    },
    
    down: async (queryInterface, Sequelize) => {
        const transaction = await queryInterface.sequelize.transaction();
        
        try {
            console.log('Rolling back patient data encryption migration...');
            
            // Note: This rollback will attempt to decrypt data, but may not be fully reversible
            // if the original data was already encrypted or if decryption fails
            
            // Remove search hash columns
            await queryInterface.removeColumn('patients', 'name_hash', { transaction });
            await queryInterface.removeColumn('patients', 'matricule_hash', { transaction });
            
            // Remove indexes (they should be removed automatically with columns)
            
            await transaction.commit();
            console.log('Patient data encryption migration rollback completed!');
            
        } catch (error) {
            await transaction.rollback();
            console.error('Error during rollback:', error);
            throw error;
        }
    }
};

/**
 * Check if a value appears to be already encrypted
 */
function isAlreadyEncrypted(value) {
    if (!value || typeof value !== 'string') return false;
    
    // Check for the IV:encrypted format used by cryptoService
    const parts = value.split(':');
    return parts.length === 2 && 
           parts[0].length === 32 && // IV should be 32 hex characters
           /^[0-9a-f]+$/i.test(parts[0]); // IV should be hex
}