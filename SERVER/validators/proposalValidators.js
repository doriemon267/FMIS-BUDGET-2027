const { Joi } = require('../middleware/validateJoi');

const createProposalSchema = Joi.object({
  title: Joi.string().required().trim().max(500),
  description: Joi.string().trim().max(2000).allow('', null),
  modelType: Joi.string().valid('Initial', 'NEP', 'GAA').default('Initial'),
  fiscalYear: Joi.number().integer().min(2020).max(2050).required(),
  projectedCorporateIncome: Joi.number().min(0).allow(null),
  projectedSubsidy: Joi.number().min(0).allow(null),
  region: Joi.alternatives().try(Joi.string(), Joi.object()).allow(null),
  department: Joi.string().trim().max(200).allow('', null),
  division: Joi.string().trim().max(200).allow('', null),
}).unknown(true);

const updateProposalSchema = Joi.object({
  title: Joi.string().trim().max(500),
  description: Joi.string().trim().max(2000).allow('', null),
  modelType: Joi.string().valid('Initial', 'NEP', 'GAA'),
  fiscalYear: Joi.number().integer().min(2020).max(2050),
  projectedCorporateIncome: Joi.number().min(0).allow(null),
  projectedSubsidy: Joi.number().min(0).allow(null),
  region: Joi.alternatives().try(Joi.string(), Joi.object()).allow(null),
  department: Joi.string().trim().max(200).allow('', null),
  division: Joi.string().trim().max(200).allow('', null),
  office: Joi.string().trim().max(200).allow('', null),
  __v: Joi.number().integer().min(0), // For optimistic locking - client sends current version
}).unknown(true).min(1);

const performActionSchema = Joi.object({
  action: Joi.string().required().valid(
    'submit-to-reviewer', 'submit-to-approver', 'submit-to-analyst',
    'forward-to-officer', 'forward-to-manager', 'finalize',
    'return-to-preparer', 'return-to-reviewer', 'return-to-approver',
    'return-to-analyst', 'return-to-officer'
  ),
  comment: Joi.string().trim().max(2000).allow('', null),
  targetAnalystId: Joi.string().trim().allow('', null), // For submit-to-analyst: route to specific BPA (Central Office vs Other Region)
  digitalSignature: Joi.object({
    signature: Joi.string().trim().required(),
    certificatePem: Joi.string().trim().required(),
    certificateChainPem: Joi.alternatives().try(
      Joi.string().trim(),
      Joi.array().items(Joi.string().trim())
    ).allow(null),
    signedPayload: Joi.string().allow('', null),
    signedAt: Joi.date().iso().required(),
    algorithm: Joi.string().trim().valid('RSA-SHA256', 'sha256', 'sha256WithRSAEncryption').default('RSA-SHA256')
  }).allow(null),
}).unknown(true);

module.exports = {
  createProposalSchema,
  updateProposalSchema,
  performActionSchema,
};
