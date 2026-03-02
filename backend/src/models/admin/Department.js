const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true
  },
  value: {
    type: String,
    required: [true, 'Department value is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
departmentSchema.index({ value: 1 });
departmentSchema.index({ isActive: 1 });

// Instance methods
departmentSchema.methods.toJSON = function() {
  const obj = this.toObject();
  return {
    id: obj._id,
    name: obj.name,
    value: obj.value,
    description: obj.description,
    isActive: obj.isActive,
    isDefault: obj.isDefault,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
};

// Static method to get active departments
departmentSchema.statics.getActive = async function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

// Pre-delete hook to check if department is in use
departmentSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  const User = mongoose.model('User');
  const count = await User.countDocuments({ department: this.value });
  
  if (count > 0) {
    throw new Error(`Cannot delete department. ${count} user(s) are assigned to this department.`);
  }
  
  next();
});

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;
