const db = require('./config/database');
const CancellationEngine = require('./services/cancellationEngine');
const RewardEngine = require('./services/rewardEngine');
const CommissionEngine = require('./services/commissionEngine');

async function testFinancials() {
  console.log('====================================================');
  console.log('💰 FINANCIAL & BUSINESS RULES EDGE CASE VERIFICATION');
  console.log('====================================================\n');

  await db.init();
  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${name}`);
      failed++;
    }
  }

  // 1. Commission Engine Test
  const split = CommissionEngine.calculateOrderSplit(1000, 15);
  assert(split.platformCommission === 150 && split.providerPayable === 850, '₹1000 order splits into ₹150 commission & ₹850 provider payable');

  // 2. Customer Points & 100-Point Milestone Idempotency Test
  const cust = db.prepare(`SELECT id FROM customer_profiles LIMIT 1`).get();
  const summaryBefore = RewardEngine.getCustomerPointsSummary(cust.id);
  
  // Award points to reach next milestone
  const summaryAfter = RewardEngine.awardPoints(cust.id, 100, 'Test Milestone Loyalty Points');
  assert(summaryAfter.totalPoints === summaryBefore.totalPoints + 100, 'Points ledger accurately increments balance');
  assert(summaryAfter.rewards.length >= 1, 'Milestone unlocked 1 Free 1-Day Meal reward voucher');

  // Verify duplicate prevention (calling award with 1 point does not create duplicate milestone voucher)
  const summaryAfter1 = RewardEngine.awardPoints(cust.id, 1, 'Small bonus point');
  assert(summaryAfter1.rewards.length === summaryAfter.rewards.length, 'Idempotency: No duplicate milestone voucher created for same range');

  console.log('\n====================================================');
  console.log(`🏁 FINANCIAL TESTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================\n');
}

testFinancials().catch(console.error);
