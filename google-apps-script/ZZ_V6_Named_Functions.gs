/**
 * RTAFNC v6 Named Functions
 * Use these if Apps Script load order does not reliably override selfTest_ / pRunQaGate_.
 */

function pRunQaGateV6_(a, groups) {
  return pRunQaGate_(a, groups);
}

function selfTestV6_() {
  return selfTest_();
}

function getHealthV6_() {
  return getHealth_();
}
