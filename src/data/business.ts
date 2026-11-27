// Studio details printed on invoices. Fill in the blanks; empty lines are
// simply left off the PDF.
export const BUSINESS = {
  name: "Éclat by Harsha",
  addressLines: [
    "Éclat Studio, Ground Floor, Dream Weavers Dance & Fitness Arena",
    "13/167 D, Sarovaram Biopark Road, Eranhippalam",
    "Kozhikode, Kerala 673020",
  ],
  phone: "6282062455",
  email: "eclatbyharsha@gmail.com",
  instagram: "", // e.g. "@eclatbyharsha"
  gstin: "", // leave empty if not GST registered
  paymentNote: "", // legacy one-liner; paymentLines below is used instead
  // Printed under "Payment method" on quotes and invoices.
  paymentLines: [
    "UPI (GPay): 9072103592 (Harsha Chemban)",
    "Federal Bank  |  A/C: 55550117648582  |  IFSC: FDRL0005555",
  ],
  // Scan-to-pay QR beside "Payment method" (Harsha's GPay QR, decoded). "" hides it.
  upiQr: "upi://pay?pa=hrshaa96@okicici&pn=harsha%2096&aid=uGICAgMDQlMjsSg",
  invoicePrefix: "ECL",
  quotePrefix: "Q",
  signature: "Harsha, Founder",
  // Pre-filled note on new quotes and invoices (editable each time).
  defaultNote: "Hair extension charges, if required, will be charged separately on the event day and are not included in the quoted package amount.",
  // Page 2 of every quotation.
  quotePolicy: [
    "This quotation remains valid for 3 days from the date of issue. To confirm and secure the booking date, a non-refundable advance payment of 50% of the total package amount must be made within this period.",
    "Dates will be reserved only upon receipt of the advance payment. If the booking is not confirmed within 3 days, the date will be released and may be allocated to other clients.",
    "Please note that the advance payment is strictly non-refundable and non-transferable under any circumstances.",
  ],
};
