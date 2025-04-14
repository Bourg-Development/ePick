const { query } = require('../db/pool');
const Doctor = require('./Doctor');
const Room = require('./Room');
const Service = require('./Service');

class Patient {
    constructor(data) {
        this.id = data.id;
        this.firstName = data.first_name;
        this.lastName = data.last_name;
        this.dateOfBirth = data.date_of_birth;
        this.roomId = data.room_id;
        this.doctorId = data.doctor_id;
        this.serviceId = data.service_id;
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    static async getById(id, includeRelations = false) {
        const { rows } = await query(
            'SELECT * FROM patients WHERE id = $1 LIMIT 1',
            [id]
        );

        if (!rows.length) return null;

        const patient = new Patient(rows[0]);

        if(includeRelations){
            patient.doctor = await Doctor.getById(patient.doctorId);
            patient.room = await Room.getById(patient.roomId);
            patient.service = await Service.getById(patient.serviceId);
        }

        return patient;
    }
    static async create(data) {
        const { rows } = await query(
            'INSERT INTO patients (first_name, last_name, date_of_birth, room_id, doctor_id, service_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [data.firstName, data.lastName, data.dateOfBirth, data.roomId, data.doctorId, data.serviceId]
        );
        return new Patient(rows[0]);
    }

    async update(data){
        const { rows } = await query(
            `UPDATE patients SET 
                    first_name = COALESCE($1, first_name),
                    last_name = COALESCE($2, last_name),
                    date_of_birth = COALESCE($3, date_of_birth),
                    room_id = COALESCE($4, room_id),
                    doctor_id = COALESCE($5, doctor_id),
                    service_id = COALESCE($6, service_id)
                    updatedAt = NOW()
                WHERE id = $7
                RETURNING *`,
            [
                data.firstName,
                data.lastName,
                data.dateOfBirth,
                data.roomId,
                data.doctorId,
                data.serviceId,
                this.id
            ]
        );
        return new Patient(rows[0]);
    }

}

module.exports = Patient;