/**
 * Notification Service
 * Handles dispatching notifications / emails to vendors and customers.
 * Stubs external email / SMS provider with structured logging for Phase 5.
 */

/**
 * Notify a vendor of an administrative review decision (approved or rejected).
 *
 * @param {object} params
 * @param {string} params.vendorEmail
 * @param {string} params.vendorName
 * @param {string} params.shopName
 * @param {string} params.offerTitle
 * @param {'approved'|'rejected'} params.decision
 * @param {string} [params.reason]
 * @returns {Promise<{ delivered: boolean, messageId: string, timestamp: Date }>}
 */
export const notifyVendorOfReviewDecision = async ({
  vendorEmail,
  vendorName,
  shopName,
  offerTitle,
  decision,
  reason,
}) => {
  const timestamp = new Date();
  const messageId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const subject =
    decision === 'approved'
      ? `Offer Approved: "${offerTitle}" is now live on OfferBazaar!`
      : decision === 'manual_takedown_post_approval'
        ? `Notice: Your offer "${offerTitle}" has been taken down`
        : `Action Required: Offer "${offerTitle}" was rejected`;

  const body =
    decision === 'approved'
      ? `Hello ${vendorName || shopName || 'Vendor'},\n\nGreat news! Your promotional offer "${offerTitle}" has been approved by our administration team and is now visible to customers in your area.`
      : decision === 'manual_takedown_post_approval'
        ? `Hello ${vendorName || shopName || 'Vendor'},\n\nYour promotional offer "${offerTitle}" has been taken down by our administration team.\nReason: ${reason || 'Violation of platform guidelines'}\n\nIf you believe this was an error or wish to appeal, please review your Vendor Dashboard or contact support.`
        : `Hello ${vendorName || shopName || 'Vendor'},\n\nYour promotional offer "${offerTitle}" could not be approved at this time.\nReason: ${reason || 'Does not meet platform guidelines'}\n\nYou can update your offer details and resubmit it anytime from your Vendor Dashboard.`;

  console.log(`[Notification Service] Dispatching email to: ${vendorEmail}`);
  console.log(`[Notification Service] Subject: ${subject}`);
  console.log(
    `[Notification Service] Body preview: ${body.substring(0, 120)}...`
  );

  return {
    delivered: true,
    messageId,
    timestamp,
    recipient: vendorEmail,
    subject,
  };
};

export default {
  notifyVendorOfReviewDecision,
};
