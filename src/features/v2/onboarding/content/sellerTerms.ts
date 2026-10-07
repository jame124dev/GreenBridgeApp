/**
 * Platform Terms & Conditions (condensed) shown to sellers during onboarding.
 *
 * Source: GIH Co., Ltd. "Platform Terms & Conditions — Version 1.0 draft,
 * condensed". The full Version 1.0 draft remains the reference document if the
 * two are ever inconsistent. Bracketed items ([...]) are decisions the source
 * document still lists as open — they are reproduced as written.
 *
 * Content only, so legal can update the wording without touching the UI.
 */

export const SELLER_TERMS_VERSION = "1.0-condensed";

export interface TermsClause {
  heading: string;
  paragraphs: string[];
}

export const SELLER_TERMS_TITLE = "Platform Terms & Conditions";
export const SELLER_TERMS_SUBTITLE = "GIH Co., Ltd. · GreenBidz · 101 Marketplaces — Version 1.0, condensed";

export const SELLER_TERMS_INTRO =
  "These Terms govern use of the Platform. They do not govern individual transactions — those are governed by the applicable Transaction Terms. Sellers with a negotiated commercial arrangement are also bound by their signed Reseller Agreement and its Schedules, which supplement these Terms.";

export const SELLER_TERMS_CLAUSES: TermsClause[] = [
  {
    heading: "1 · Definitions (selected)",
    paragraphs: [
      "“Buyer” / “Seller” / “User” — a registered business using the Platform to buy, sell, or both. The role follows the transaction, not the account.",
      "“Goods” — Materials (secondary industrial materials, including battery materials and metal-bearing scrap) and Equipment (used industrial, laboratory, IT and related capital equipment), together or separately.",
      "“Listing / Tender / RFQ” — the three ways Goods are offered or sought on the Platform: a fixed-price or open listing, a time-limited bidding event run by a Seller, and a request for quotation issued by a Buyer.",
      "“Offer / Quote” — a binding bid or response submitted through the Platform at a stated price.",
      "“Purchase Contract” — the binding contract formed directly between Buyer and Seller when an Offer, Quote or winning bid is accepted, governed by the applicable Transaction Terms.",
      "“Assay” — a third-party laboratory analysis of Materials' composition.",
      "“Transaction Data” — all data generated through the Platform on RFQs, Listings, Tenders and transactions (bids, prices, volumes, Assay data, outcomes).",
      "“Platform” — the GreenBidz platform and the 101 marketplaces (101lab, 101machines, 101it, 101recycle) and GreenBidz Trade, operated by GIH Co., Ltd. (星河智能股份有限公司), Taiwan.",
      "Full definitions, including “Affiliate,” “Applicable Laws,” “Confidential Information,” “Listing Data,” “Power Seller” and “Working Days,” are set out in the full Terms.",
    ],
  },
  {
    heading: "2 · About GIH and the Platform",
    paragraphs: [
      "GIH operates a digital marketplace for used Equipment and secondary industrial Materials via fixed-price listings, Seller-run Tenders and Buyer-issued RFQs. GIH hosts the Platform, verifies Users, standardises Listing Data (including parsing Assay reports), invoices Buyers on a Seller's behalf and collects payment as limited agent (Clause 6), and provides optional Transaction Services (Clause 7.3).",
      "GIH does not own, handle or take title to Goods; is not a principal in any Purchase Contract; and does not guarantee Listing Data, Assay results, the condition of Goods, or any User's identity, solvency or performance beyond the verification in Clause 3. Automated valuations, benchmarks and Assay extractions are estimates only — the Assay of record is the third-party lab report, not the Platform's extraction of it.",
      "GIH may update the Platform and these Terms; material changes take effect 30 days after notice, and continued use after that date is acceptance.",
    ],
  },
  {
    heading: "3 · Registration, verification and account tiers",
    paragraphs: [
      "The Platform is for businesses. You confirm you act for a registered company and have authority to bind it, that you're based in a jurisdiction listed in the Appendix (or approved by GIH), and that your information is accurate and kept current.",
      "Before Listings go live or any payout is released, GIH verifies your business (registration, tax ID, signatory/beneficial-owner ID, bank confirmation) and screens for sanctions/PEP status. Buyers may need to evidence financial capacity or import eligibility for a Tender or RFQ.",
      "Seller accounts are standard or Power Seller; Power Seller terms sit in a separate signed Reseller Agreement, which prevails over these Terms for matters it covers.",
      "One account per company, non-transferable. GIH's payment/escrow partners run their own separate onboarding — completing GIH's checks doesn't complete theirs. You may close your account any time; this doesn't affect obligations under open Purchase Contracts or Clauses 11, 14 and 16.",
    ],
  },
  {
    heading: "4 · Listings, Tenders and RFQs",
    paragraphs: [
      "A Listing is an invitation to bid/offer unless expressly published as fixed-price. Sellers warrant that Listing Data is accurate and complete, they own or are authorised to sell the Goods (free of liens), the Goods are available as stated, all known damage/defects/hazards are disclosed, any Assay published is genuine, and personal data on listed devices has been erased.",
      "A live Listing can't be sold off-Platform without withdrawal first, and can't be withdrawn once an Offer/Quote/bid is accepted or during a Tender's final window.",
      "Buyers issuing an RFQ warrant it's genuine and that they'll respond to Quotes within the stated period.",
      "GIH may edit, reclassify, suspend or remove any Listing, RFQ or Tender it believes is inaccurate, misleading, unlawful or in breach. Prohibited Goods include anything the User doesn't hold/control, sanctioned or export-controlled Goods without a licence, and Materials with undisclosed radioactive, explosive or hazardous content.",
    ],
  },
  {
    heading: "5 · How a transaction is concluded",
    paragraphs: [
      "A bid, Offer or Quote from a verified User is a binding commitment at that price for the stated period. The Purchase Contract forms directly between Buyer and Seller on acceptance (or Tender close plus Seller confirmation) — GIH is not a party to it, and the applicable Transaction Terms govern the transaction (prevailing over these Terms where they conflict).",
      "A reserved Tender forms no contract unless the reserve is met and, where stated, the Seller confirms. GIH may pause, postpone or cancel a Tender, RFQ or transaction where required information or a compliance check is outstanding.",
    ],
  },
  {
    heading: "6 · Invoicing and payment collection",
    paragraphs: [
      "Each Seller appoints GIH as its limited agent solely to invoice Buyers in the Seller's name and collect payment on its behalf; GIH accepts that limited appointment only.",
      "Payment to GIH or its payment partner discharges the Buyer's obligation to the Seller in full, whether or not GIH has yet paid the Seller. Every invoice names the Seller as supplier with its legal details; the Seller won't issue a duplicate invoice.",
      "Buyer funds are held by GIH's licensed payment partner for the Seller's account and released per the Transaction Terms — ordinarily once the Buyer confirms the Goods or the inspection window closes without valid rejection.",
      "The Seller authorises GIH to deduct, before payout: Subscription and Transaction Service charges due, disclosed processing/FX costs, refunds/reversals (Clause 9), and any tax GIH must collect. Shortfalls are recovered from later payouts or invoiced (payable within 14 days).",
      "Payouts go only to a bank account in the Seller's registered company name, in the settlement currency shown — never to personal or third-party accounts; changing payout details requires written confirmation and re-verification.",
      "Each User handles its own tax; GIH accounts for its own fees and will collect/withhold/report tax where Applicable Laws require, shown separately on the statement. GIH keeps a transaction ledger (gross, fees, deductions, tax, net) available to each party, correctable within 60 days of issue. On request from a payment partner, bank, regulator or auditor, the User authorises GIH to disclose transaction records and will supply further documents within 3 Working Days; related funds may be held until the request is closed.",
    ],
  },
  {
    heading: "7 · Fees",
    paragraphs: [
      "Registration, publishing Listings, issuing RFQs and submitting bids/Offers/Quotes are free.",
      "Platform access is charged as a periodic Subscription under the accepted plan. Transaction Services (cross-border payment/escrow, trade finance, logistics/export coordination, inspection/assay coordination, managed cataloguing) are charged only when used, at disclosed rates.",
      "GIH does not charge a commission or success fee on the value of a Purchase Contract, unless a Power Seller has expressly agreed one in a signed Schedule.",
      "Published rates may change on 30 days' notice (not affecting periods/services already paid for or engaged); a signed Schedule's rate changes only by a signed replacement. Individually agreed fee arrangements are confidential. All sums are exclusive of VAT/equivalent taxes unless stated.",
    ],
  },
  {
    heading: "8 · Delivery, shipping information and export",
    paragraphs: [
      "Sales are EXW from the Listing location unless stated otherwise; the Buyer bears shipping, rigging, insurance and import costs. The Seller is responsible for safe loading, any de-installation/packing it offered, and accurate weights/dimensions/declarations.",
      "The Seller must despatch with a trackable carrier and give GIH the carrier, tracking reference, despatch date and delivery address within 2 Working Days of despatch (or a signed collection note if the Buyer collects) — GIH's payment partner requires this before releasing funds, and a payout may be held while it's outstanding.",
      "Each party handles its own side's licences/permits; neither may misdescribe Goods, value or composition in customs, transport or waste documentation. Restricted-transport Goods (e.g., lithium batteries, battery-bearing Materials) must be packed and consigned per dangerous-goods rules, with the restriction disclosed in the Listing.",
    ],
  },
  {
    heading: "9 · Inspection, rejection and disputes between Users",
    paragraphs: [
      "A Buyer may reject Goods within the stated inspection window where they materially differ from the Listing (wrong model, undisclosed damage/missing parts, non-functional Equipment described as working, or Materials whose composition materially differs from the published Assay). Rejection needs evidence, and for Materials an umpire Assay (cost borne by whichever party's result is further from the umpire's).",
      "An upheld rejection results in return-and-refund or an agreed price adjustment; return costs fall on the Seller if the Listing was inaccurate, otherwise the Buyer. Change of mind isn't a valid ground.",
      "Users authorise GIH to apply refunds/adjustments from held funds and recover amounts already paid out. GIH may offer non-binding dispute support but isn't an arbitrator.",
    ],
  },
  {
    heading: "10 · User conduct",
    paragraphs: [
      "You'll comply with these Terms and Applicable Laws, act in good faith, and provide accurate information. You won't: act unlawfully; misrepresent yourself, your business or any Goods; publish an unrelated Assay; bid without intent/ability to complete; bid on your own Listing; attempt unauthorised access; scrape or reverse-engineer the Platform; or transact in breach of sanctions/export control laws. Breach of this Clause is a material breach.",
    ],
  },
  {
    heading: "11 · Platform exclusivity and anti-circumvention",
    paragraphs: [
      "A transaction that originates through the Platform must be completed through it — a condition of your account. You must not use Platform contacts/information to transact outside it, induce another User to do so, pay/accept payment outside GIH's payment services for a Platform-originated transaction, or otherwise deprive GIH of fees it's entitled to. This extends to your Affiliates and, for Power Sellers, your directors and senior management.",
      "Exception: a pre-existing relationship evidenced by a completed transaction before either party joined the Platform — notify GIH within 5 Working Days of becoming aware of the connection.",
      "On reasonable grounds of breach, GIH may withhold related payments (giving reasons); unresolved matters after 30 days go to Clause 18, and payments are released promptly if no breach is found. On established breach, GIH may terminate the account, exclude the User and its Affiliates, recover the fees that would have been payable plus reasonable costs, and seek injunctive relief. These obligations continue for 12 months after the account ends.",
    ],
  },
  {
    heading: "12 · Disclaimers and liability",
    paragraphs: [
      "The Platform is provided “as is” / “as available.” GIH does not guarantee Listing Data, Assay results, User information, the quality/legality/availability of Goods, or that a User will perform its Purchase Contract obligations — each User is responsible for its own due diligence.",
      "Neither party is liable for indirect or consequential loss (including lost profit, revenue, business or goodwill).",
      "GIH's total aggregate liability to a User is capped at the greater of the fees that User paid GIH in the preceding 12 months, or [USD 50,000]. This cap does not apply to breach of Clause 11 or 14, fraud, wilful misconduct, death/personal injury from negligence, or any liability that can't lawfully be excluded.",
    ],
  },
  {
    heading: "13 · Indemnity",
    paragraphs: [
      "You indemnify GIH against claims, losses and costs arising from your breach of these Terms or Applicable Laws, inaccurate or misleading Listing Data/Assay/content you provide, and third-party claims relating to your sale, purchase, handling, transport or processing of Goods.",
      "If you hold a permit, licence or credential a transaction depends on, you additionally indemnify GIH against regulatory penalties, enforcement action, remediation costs and third-party claims arising from failing to hold/maintain it, or from your handling of Goods.",
    ],
  },
  {
    heading: "14 · Confidentiality",
    paragraphs: [
      "Each party keeps the other's Confidential Information confidential, disclosing only to those with a need to know, as required by law, or with consent. Counterparty details disclosed for a transaction may be used only for that transaction — never added to marketing lists or passed to third parties. Obligations survive [2] years after the account ends, and indefinitely for trade secrets, pricing methodology, Platform data and non-public transaction history.",
    ],
  },
  {
    heading: "15 · Data protection",
    paragraphs: [
      "GIH processes personal data under its Privacy Policy and Taiwan's Personal Data Protection Act (and other applicable laws, including GDPR where relevant). By transacting, you consent to GIH sharing your business contact details with your counterparty as necessary to complete the transaction.",
    ],
  },
  {
    heading: "16 · Transaction Data, automated outputs and intellectual property",
    paragraphs: [
      "You keep ownership of your Listing Data but grant GIH a non-exclusive, royalty-free licence to use and display it while the Listing is live (and for a reasonable period after) to operate and market the Platform.",
      "You grant GIH a perpetual, irrevocable, royalty-free licence to use, store, analyse and process Transaction Data to operate and improve the Platform — including developing valuation, benchmark, matching and fraud-detection models.",
      "GIH owns anonymised/aggregated derived data and won't disclose your identity, counterparty identity or individual transaction prices in identifiable form without written consent. The Platform itself — software, design, content — is GIH's IP.",
    ],
  },
  {
    heading: "17 · Suspension and termination",
    paragraphs: [
      "GIH may suspend or restrict an account immediately for breach, false information, an outstanding/failed verification or sanctions check, insolvency, or reasonable belief of regulatory/safety/financial/reputational risk — acting reasonably, with reasons given as soon as practicable.",
      "For a remediable material breach (other than Clause 11/14, fraud, or an immediate safety/Platform risk), GIH gives 14 days' written notice to remedy. You may request review of a suspension within 10 Working Days.",
      "On termination: open Purchase Contracts continue to completion; outstanding amounts are due within 5 Working Days; you must stop representing an association with GIH; final payout follows the last inspection window, less a reserve held for [30] days against reversals; and Clauses 6.5, 9, 11–14 and 16 survive.",
    ],
  },
  {
    heading: "18 · Dispute resolution and governing law",
    paragraphs: [
      "Governed by the laws of [Taiwan / Singapore]; the courts of [  ] have exclusive jurisdiction, subject to mediation first. Disputes start with written notice and good-faith negotiation; if unresolved after 21 days, either party may refer to mediation at [CAA Taipei / SIMC]; if still unresolved 30 days after mediation starts, either party may commence proceedings. Either party may still seek urgent injunctive or interim relief at any time, and both keep performing their obligations throughout.",
    ],
  },
  {
    heading: "19 · General",
    paragraphs: [
      "These Terms, the applicable Transaction Terms, any Purchase Contract and (for Power Sellers) the signed Reseller Agreement and Schedules form the entire agreement. Nothing creates a partnership or general agency — GIH acts as agent only per Clause 6. Invalid provisions are modified to the minimum extent necessary; the rest continues. Failure to exercise a right isn't a waiver. Neither party is liable for delay from events beyond its reasonable control.",
      "Terms are published in English and [Traditional Chinese]; the [English] version prevails if inconsistent. Notices are given via the Platform or registered email, deemed received after 24 hours. Electronic acceptance has the same effect as signature; GIH records the version accepted, timestamp and account details, and by accepting you confirm authority to bind your organisation. Rights/obligations aren't assignable by you without GIH's consent; GIH may assign to a group company or a business/asset purchaser.",
    ],
  },
  {
    heading: "Appendix · Permitted jurisdictions",
    paragraphs: [
      "Settlement markets (cross-border payment collection and escrow available): Taiwan · China · Thailand · Singapore · Malaysia · Indonesia · Vietnam · India.",
      "Buyer markets (buy, and sell where approved, with settlement arranged case by case): [Japan · South Korea · Hong Kong · and other markets approved by GIH in writing].",
      "Excluded: any jurisdiction subject to comprehensive sanctions, and any market GIH hasn't approved. GIH may update this Appendix by notifying affected Users.",
      "Questions: [support@greenbidz.com]",
    ],
  },
];
