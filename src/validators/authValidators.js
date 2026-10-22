const Joi = require('joi');

const requestOTPSchema = Joi.object({
  email: Joi.string().email().optional(),
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).optional(),
  role: Joi.string().valid('CUSTOMER', 'DRIVER', 'OWNER').optional(),
}).or('email', 'mobile');

const verifyOTPSchema = Joi.object({
  email: Joi.string().email().optional(),
  mobile: Joi.string().pattern(/^[6-9]\d{9}$/).optional(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  role: Joi.string().valid('CUSTOMER', 'DRIVER', 'OWNER').optional(),
}).or('email', 'mobile');

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message });
    }
    req.body = value;
    next();
  };
};

module.exports = {
  validateRequestOTP: validate(requestOTPSchema),
  validateVerifyOTP: validate(verifyOTPSchema),
  validateRefreshToken: validate(refreshTokenSchema),
};
