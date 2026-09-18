import mongoose, { Schema, Document } from 'mongoose';

interface IGps {
    lat: number;
    lng: number;
}

export interface IAttendanceBreak {
    type: 'Lunch' | 'Tea' | 'Other';
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
}

export interface IShiftSnapshot {
    name?: string;
    startTime?: string;
    endTime?: string;
    requiredHours?: number;
}

export interface IAttendance extends Document {
    employeeId: mongoose.Types.ObjectId;
    date: Date;
    checkInTime?: Date;
    checkOutTime?: Date;
    checkInGps?: IGps;
    checkOutGps?: IGps;
    totalHours?: number;       // Gross hours between check-in and check-out
    actualHours?: number;      // Net working hours (totalHours - totalBreakMinutes/60)
    overtimeHours?: number;    // MAX(actualHours - 8, 0)
    totalBreakMinutes?: number;// Total break duration in minutes
    breaks?: IAttendanceBreak[];
    shiftDetails?: IShiftSnapshot;
    workType: 'Office' | 'Remote' | 'Field Visit';
    status: 'Present' | 'Absent' | 'Leave' | 'Break' | 'Half-Day' | 'Late';
    deviceInfo?: string;
    createdBy?: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    deletedAt?: Date | null;
}

const gpsSchema = new Schema<IGps>(
    {
        lat: { type: Number },
        lng: { type: Number },
    },
    { _id: false }
);

const breakSchema = new Schema<IAttendanceBreak>(
    {
        type: { type: String, enum: ['Lunch', 'Tea', 'Other'], default: 'Lunch' },
        startTime: { type: Date, required: true },
        endTime: { type: Date, required: true },
        durationMinutes: { type: Number, required: true, default: 0 },
    },
    { _id: false }
);

const shiftSnapshotSchema = new Schema<IShiftSnapshot>(
    {
        name: { type: String },
        startTime: { type: String },
        endTime: { type: String },
        requiredHours: { type: Number, default: 8 },
    },
    { _id: false }
);

const attendanceSchema = new Schema<IAttendance>(
    {
        employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
        date: { type: Date, required: true },
        checkInTime: { type: Date },
        checkOutTime: { type: Date },
        checkInGps: { type: gpsSchema },
        checkOutGps: { type: gpsSchema },
        totalHours: { type: Number },
        actualHours: { type: Number },
        overtimeHours: { type: Number, default: 0 },
        totalBreakMinutes: { type: Number, default: 0 },
        breaks: { type: [breakSchema], default: [] },
        shiftDetails: { type: shiftSnapshotSchema },
        workType: {
            type: String,
            enum: ['Office', 'Remote', 'Field Visit'],
            default: 'Office',
        },
        status: {
            type: String,
            enum: ['Present', 'Absent', 'Leave', 'Break', 'Half-Day', 'Late'],
            default: 'Present',
        },
        deviceInfo: { type: String },
        createdBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'Employee' },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Ye line SABSE IMPORTANT hai — ek employee ka ek din me sirf ek record
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export default mongoose.model<IAttendance>('Attendance', attendanceSchema);