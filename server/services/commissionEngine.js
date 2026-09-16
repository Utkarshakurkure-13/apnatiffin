const db = require('../config/database');

/**
 * Decimal-Safe Commission & Financial Payout Calculation Engine
 */
class CommissionEngine {
  /**
   * Get currently active platform commission percentage
   */
  static getCommissionPercent() {
    const setting = db.prepare(`SELECT value FROM admin_settings WHERE key = 'platform_commission_percent'`).get();
    return setting ? parseFloat(setting.value) : 15.0;
  }

  /**
   * Calculate commission and provider share for an order
   * e.g. Gross ₹1000, 15% commission = ₹150, Provider payable = ₹850
   */
  static calculateOrderSplit(grossAmount, commissionPercent = null) {
    if (commissionPercent === null) {
      commissionPercent = this.getCommissionPercent();
    }
    const commission = Math.round((grossAmount * (commissionPercent / 100)) * 100) / 100;
    const providerPayable = Math.round((grossAmount - commission) * 100) / 100;
    return {
      grossAmount,
      commissionPercent,
      platformCommission: commission,
      providerPayable
    };
  }
}

module.exports = CommissionEngine;
