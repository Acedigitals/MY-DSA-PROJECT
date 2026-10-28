export function createMockPaymentGateway() {
  return {
    async charge({ amountCents, decline = false }) {
      if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
        throw new TypeError('amountCents must be whole cents');
      }
      if (decline) return { success: false };
      return { success: true, amountCents };
    }
  };
}
