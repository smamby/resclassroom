const ROLES = {
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  VISITOR: 'visitor'
};

class User {
  constructor(data) {
    if (!data.name || data.name.trim() === '') {
      throw new Error('Name is required');
    }
    
    if (!data.surname || data.surname.trim() === '') {
      throw new Error('Surname is required');
    }
    
    if (!data.email || data.email.trim() === '') {
      throw new Error('Email is required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      throw new Error('Invalid email format');
    }
    
    if (data.role && !Object.values(ROLES).includes(data.role)) {
      throw new Error(`Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}`);
    }
    
    this.id = data.id || Math.random().toString(36).substr(2, 9);
    this.name = data.name.trim();
    this.surname = data.surname.trim();
    this.email = data.email.trim().toLowerCase();
    this.role = data.role || ROLES.VISITOR;
    // Password hash (for login) - store if provided, and hide in JSON output
    this.passwordHash = data.passwordHash;
    this.createdAt = data.createdAt || new Date();
  }

  toJSON() {
    const { passwordHash, ...rest } = this;
    // If passwordHash exists on the instance, exclude it from JSON reps
    return rest;
  }
}

User.ROLES = ROLES;

module.exports = User;
