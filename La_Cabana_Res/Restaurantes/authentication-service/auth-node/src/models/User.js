import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        minlength: 3,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    verificationToken: {
        type: String,
        default: null,
        index: true
    },
    verificationTokenExpires: {
        type: Date,
        default: null
    },
    adminActivationToken: {
        type: String,
        default: null,
        index: true
    },
    adminActivationTokenExpires: {
        type: Date,
        default: null
    },
    adminActivationRequestedAt: {
        type: Date,
        default: null
    },
    adminActivationRequestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    }
}, { timestamps: true });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(password) {
    return bcrypt.compare(password, this.password);
};

userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incrementLoginAttempts = async function() {
    const LOCK_TIME = 30 * 60 * 1000; // 30 minutes

    if (this.lockUntil && this.lockUntil < Date.now()) {
        this.loginAttempts = 1;
        this.lockUntil = null;
    } else {
        this.loginAttempts += 1;
        if (this.loginAttempts >= 5) {
            this.lockUntil = Date.now() + LOCK_TIME;
        }
    }

    await this.save();
};

userSchema.methods.resetLoginAttempts = async function() {
    this.loginAttempts = 0;
    this.lockUntil = null;
    await this.save();
};

export default mongoose.model('User', userSchema);
