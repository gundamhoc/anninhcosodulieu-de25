const { z } = require('zod');

const emailSchema = z
  .string()
  .trim()
  .email('Invalid email address')
  .max(255)
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const roleSchema = z.enum(['admin', 'doctor', 'patient']);

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
  .refine((value) => {
    const time = Date.parse(value);
    return Number.isFinite(time) && time < Date.now();
  }, 'Date must be valid and in the past');

const dateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), 'Invalid datetime');

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s().]{8,20}$/, 'Invalid phone number')
  .optional();

const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
  .strict();

const idParamSchema = z
  .object({
    id: z.coerce.number().int().positive()
  })
  .strict();

const appointmentIdParamSchema = z
  .object({
    appointmentId: z.coerce.number().int().positive()
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128)
  })
  .strict();

const changePasswordSchema = z
  .object({
    current_password: z.string().min(1).max(128),
    new_password: passwordSchema
  })
  .strict();

const createUserSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema,
    full_name: z.string().trim().min(1).max(150).optional(),
    date_of_birth: dateOnlySchema.optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    phone: phoneSchema,
    address: z.string().trim().max(500).optional(),
    specialty: z.string().trim().max(100).optional(),
    license_number: z.string().trim().max(50).optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    if ((data.role === 'doctor' || data.role === 'patient') && !data.full_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['full_name'],
        message: 'full_name is required for doctor and patient accounts'
      });
    }

    if (data.role === 'admin') {
      const profileFields = [
        'full_name',
        'date_of_birth',
        'gender',
        'phone',
        'address',
        'specialty',
        'license_number'
      ];
      if (profileFields.some((field) => data[field] !== undefined)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['role'],
          message: 'Admin accounts do not accept profile fields'
        });
      }
    }

    if (data.role === 'patient' && (data.specialty || data.license_number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['role'],
        message: 'Patient accounts do not accept doctor fields'
      });
    }

    if (data.role === 'doctor' && (data.date_of_birth || data.gender || data.address)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['role'],
        message: 'Doctor accounts do not accept patient-only fields'
      });
    }
  });

const updateUserSchema = z
  .object({
    email: emailSchema.optional(),
    is_active: z.boolean().optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required'
  });

const updatePatientProfileSchema = z
  .object({
    full_name: z.string().trim().min(1).max(150).optional(),
    date_of_birth: dateOnlySchema.optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    phone: phoneSchema,
    address: z.string().trim().max(500).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required'
  });

const updateDoctorProfileSchema = z
  .object({
    full_name: z.string().trim().min(1).max(150).optional(),
    specialty: z.string().trim().max(100).optional(),
    phone: phoneSchema
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required'
  });

const adminUpdateDoctorProfileSchema = z
  .object({
    full_name: z.string().trim().min(1).max(150).optional(),
    specialty: z.string().trim().max(100).optional(),
    phone: phoneSchema,
    license_number: z.string().trim().max(50).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required'
  });

const usersListQuerySchema = paginationSchema
  .extend({
    role: roleSchema.optional(),
    is_active: z.enum(['true', 'false']).optional()
  })
  .strict();

const createAppointmentSchema = z
  .object({
    doctor_id: z.coerce.number().int().positive(),
    scheduled_at: dateTimeSchema,
    reason: z.string().trim().max(500).optional()
  })
  .strict();

const appointmentStatusSchema = z
  .object({
    status: z.enum(['confirmed', 'completed', 'cancelled'])
  })
  .strict();

const appointmentsListQuerySchema = paginationSchema
  .extend({
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional()
  })
  .strict();

const createRecordSchema = z
  .object({
    appointment_id: z.coerce.number().int().positive(),
    diagnosis: z.string().trim().min(1).max(2000),
    treatment: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional()
  })
  .strict();

const updateRecordSchema = z
  .object({
    diagnosis: z.string().trim().min(1).max(2000).optional(),
    treatment: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required'
  });

const recordsListQuerySchema = paginationSchema.strict();

const medicineCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(30)
  .regex(/^[A-Za-z0-9-]+$/, 'Medicine code can only contain letters, numbers and hyphens')
  .transform((value) => value.toUpperCase());

const createMedicineSchema = z
  .object({
    medicine_code: medicineCodeSchema,
    name: z.string().trim().min(1).max(150),
    active_ingredient: z.string().trim().max(200).optional(),
    unit: z.string().trim().min(1).max(30),
    stock_quantity: z.coerce.number().int().min(0).max(1000000),
    is_prescription_only: z.boolean().optional(),
    is_active: z.boolean().optional()
  })
  .strict();

const updateMedicineSchema = z
  .object({
    medicine_code: medicineCodeSchema.optional(),
    name: z.string().trim().min(1).max(150).optional(),
    active_ingredient: z.string().trim().max(200).optional(),
    unit: z.string().trim().min(1).max(30).optional(),
    stock_quantity: z.coerce.number().int().min(0).max(1000000).optional(),
    is_prescription_only: z.boolean().optional(),
    is_active: z.boolean().optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required'
  });

const medicinesListQuerySchema = paginationSchema.strict();

const createPrescriptionSchema = z
  .object({
    note: z.string().trim().max(1000).optional(),
    items: z
      .array(
        z
          .object({
            medicine_id: z.coerce.number().int().positive(),
            dosage: z.string().trim().min(1).max(100),
            frequency: z.string().trim().min(1).max(100),
            duration_days: z.coerce.number().int().min(1).max(365),
            quantity: z.coerce.number().int().min(1).max(10000),
            instruction: z.string().trim().max(255).optional()
          })
          .strict()
      )
      .min(1)
      .max(20)
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = data.items.map((item) => item.medicine_id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Each medicine can appear only once in a prescription'
      });
    }
  });

const auditListQuerySchema = paginationSchema
  .extend({
    user_id: z.coerce.number().int().positive().optional(),
    action: z.string().trim().max(50).optional(),
    result: z.string().trim().max(20).optional()
  })
  .strict();

module.exports = {
  loginSchema,
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  updatePatientProfileSchema,
  updateDoctorProfileSchema,
  adminUpdateDoctorProfileSchema,
  usersListQuerySchema,
  createAppointmentSchema,
  appointmentStatusSchema,
  appointmentsListQuerySchema,
  createRecordSchema,
  updateRecordSchema,
  recordsListQuerySchema,
  createMedicineSchema,
  updateMedicineSchema,
  medicinesListQuerySchema,
  createPrescriptionSchema,
  auditListQuerySchema,
  idParamSchema,
  appointmentIdParamSchema
};
