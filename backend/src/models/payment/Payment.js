/**
 * Payment Model
 * 
 * Stores payment/invoice records from Stripe.
 */
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  stripePaymentIntentId: {
    type: String,
    unique: true,
    sparse: true,
  },
  stripeInvoiceId: {
    type: String,
    unique: true,
    sparse: true,
  },
  stripeSubscriptionId: {
    type: String,
    index: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
  },
  planName: String,
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'usd',
    lowercase: true,
  },
  status: {
    type: String,
    enum: ['succeeded', 'pending', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'one_time'],
    default: 'monthly',
  },
  description: String,
  receiptUrl: String,
  invoiceUrl: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  paidAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
