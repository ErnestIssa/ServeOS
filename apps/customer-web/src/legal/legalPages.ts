import type { LegalPageDef } from "./types";

const UPDATED = "10 June 2026";
const CONTACT = "privacy@serveos.com";
const SECURITY_CONTACT = "security@serveos.com";
const DPO_CONTACT = "dpo@serveos.com";

export const LEGAL_PAGES: Record<string, LegalPageDef> = {
  center: {
    slug: "center",
    eyebrow: "Legal",
    title: "Legal Center",
    summary:
      "Your hub for agreements, privacy, security, and operational policies governing ServeOS and your restaurant workspace.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "agreements",
        title: "Agreements",
        blocks: [
          {
            kind: "p",
            text: "Core contractual documents that govern your use of ServeOS as a restaurant operator or team member."
          },
          {
            kind: "ul",
            items: [
              "Terms of Service — platform agreement, subscriptions, and acceptable use",
              "Data Processing Agreement (DPA) — GDPR processor terms for B2B customers"
            ]
          }
        ]
      },
      {
        id: "privacy",
        title: "Privacy",
        blocks: [
          {
            kind: "p",
            text: "How ServeOS collects, uses, stores, and protects personal data across guest, staff, and venue accounts."
          },
          {
            kind: "ul",
            items: [
              "Privacy Policy",
              "Cookie Policy",
              "Subprocessor List",
              "Data Retention Policy"
            ]
          }
        ]
      },
      {
        id: "security",
        title: "Security",
        blocks: [
          {
            kind: "p",
            text: "Technical and organizational measures that protect restaurant operations, payments, and customer data."
          },
          {
            kind: "ul",
            items: [
              "Security & Compliance overview",
              "Responsible Disclosure Policy"
            ]
          }
        ]
      },
      {
        id: "operations",
        title: "Operations",
        blocks: [
          {
            kind: "p",
            text: "Billing, refunds, and day-to-day platform policies for venue operators."
          },
          {
            kind: "ul",
            items: [
              "Acceptable Use Policy",
              "Refund & Billing Policy",
              "Service Level Policy (coming soon)"
            ]
          }
        ]
      },
      {
        id: "requests",
        title: "Requests",
        blocks: [
          {
            kind: "p",
            text: "Exercise your data rights or submit a GDPR-related request. We respond within statutory timelines."
          },
          {
            kind: "ul",
            items: [
              "Data access request",
              "Data deletion request",
              "GDPR / data subject request form"
            ]
          },
          {
            kind: "callout",
            title: "Need help?",
            text: `Email ${CONTACT} for privacy requests or ${SECURITY_CONTACT} for security matters.`
          }
        ]
      }
    ],
    relatedLinks: [
      { label: "Privacy Policy", slug: "privacy" },
      { label: "Terms of Service", slug: "terms" },
      { label: "Security & Compliance", slug: "security" }
    ]
  },

  privacy: {
    slug: "privacy",
    eyebrow: "Privacy",
    title: "Privacy Policy",
    summary:
      "How ServeOS handles personal data for restaurant guests, venue operators, staff, and everyone who interacts with our platform.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            kind: "p",
            text: "ServeOS AB (\"ServeOS\", \"we\", \"us\") provides a restaurant operating system used by venues, their staff, and their guests. This Privacy Policy explains what personal data we process, why we process it, and the rights available to you under applicable law, including the EU General Data Protection Regulation (GDPR)."
          },
          {
            kind: "callout",
            title: "Controller vs processor",
            text: "For your restaurant's guest and staff data, your venue is typically the data controller and ServeOS acts as a data processor. For account, billing, and platform data relating to your ServeOS subscription, ServeOS is the controller."
          }
        ]
      },
      {
        id: "data-we-collect",
        title: "Data we collect",
        blocks: [
          { kind: "sub", title: "Restaurant & owner data", blocks: [
            { kind: "ul", items: [
              "Business name, legal entity, organisation number, and billing address",
              "Owner and administrator contact details (name, email, phone)",
              "Subscription plan, invoices, and payment method metadata (processed by Stripe)",
              "Venue configuration: menus, tables, opening hours, branding"
            ]}
          ]},
          { kind: "sub", title: "Staff data", blocks: [
            { kind: "ul", items: [
              "Name, email, phone, role, and permission assignments",
              "Shift activity, session metadata, device identifiers, and audit logs",
              "Authentication factors when 2FA is enabled"
            ]}
          ]},
          { kind: "sub", title: "Customer & guest data", blocks: [
            { kind: "ul", items: [
              "Order and reservation details, table assignments, and preferences",
              "Contact information when provided for bookings or receipts",
              "In-venue chat messages and support conversations",
              "Payment status and transaction references (card data is handled by payment providers)"
            ]}
          ]},
          { kind: "sub", title: "Technical & usage data", blocks: [
            { kind: "ul", items: [
              "IP address, browser type, device model, operating system, and app version",
              "Session tokens, crash reports, and performance diagnostics",
              "Analytics events that help us improve reliability and product design",
              "Approximate location when you enable location features in the mobile app"
            ]}
          ]}
        ]
      },
      {
        id: "legal-basis",
        title: "Legal basis (GDPR)",
        blocks: [
          {
            kind: "ul",
            items: [
              "Contract — to provide the ServeOS platform and fulfil our agreement with you",
              "Legitimate interests — security monitoring, fraud prevention, product improvement, and B2B communications",
              "Consent — marketing emails, non-essential cookies, and optional communications where required",
              "Legal obligation — tax, accounting, and regulatory record-keeping"
            ]
          }
        ]
      },
      {
        id: "retention",
        title: "Data retention",
        blocks: [
          {
            kind: "p",
            text: "We retain personal data only as long as necessary for the purposes described in this policy, our agreement with you, or applicable law. Retention periods vary by data category — see our Data Retention Policy for detail."
          },
          { kind: "link", label: "Data Retention Policy", slug: "data-retention" }
        ]
      },
      {
        id: "transfers",
        title: "International transfers",
        blocks: [
          {
            kind: "p",
            text: "ServeOS is based in Sweden. Some subprocessors may process data outside the EU/EEA. Where required, we rely on Standard Contractual Clauses (SCCs) and supplementary measures. See our Subprocessor List for current providers and locations."
          },
          { kind: "link", label: "Subprocessor List", slug: "subprocessors" }
        ]
      },
      {
        id: "rights",
        title: "Your rights",
        blocks: [
          {
            kind: "p",
            text: "Depending on your jurisdiction, you may have the right to access, rectify, erase, restrict, or port your personal data, and to object to certain processing. You may also withdraw consent where processing is consent-based."
          },
          {
            kind: "ul",
            items: [
              "Submit a data access or deletion request via our GDPR request form",
              "Lodge a complaint with Integritetsskyddsmyndigheten (IMY) in Sweden or your local supervisory authority"
            ]
          },
          { kind: "link", label: "GDPR / data subject request", slug: "gdpr-request" }
        ]
      },
      {
        id: "children",
        title: "Children's privacy",
        blocks: [
          {
            kind: "p",
            text: "ServeOS is a B2B platform directed at restaurants and their staff. We do not knowingly collect personal data from children under 16 without appropriate parental authority. Guest ordering flows should be operated under the restaurant's own policies."
          }
        ]
      },
      {
        id: "marketing",
        title: "Marketing communications",
        blocks: [
          {
            kind: "p",
            text: "We may send product updates, onboarding tips, and offers to business contacts where permitted. You can opt out of marketing emails at any time via the unsubscribe link or by contacting us."
          }
        ]
      },
      {
        id: "contact",
        title: "Contact",
        blocks: [
          {
            kind: "p",
            text: `Privacy enquiries: ${CONTACT}. Data Protection Officer: ${DPO_CONTACT}. Postal: ServeOS AB, Jyllandsgatan 112, 164 47 Kista, Sweden.`
          }
        ]
      }
    ],
    relatedLinks: [
      { label: "Cookie Policy", slug: "cookies" },
      { label: "Data Retention Policy", slug: "data-retention" },
      { label: "Subprocessor List", slug: "subprocessors" },
      { label: "GDPR request", slug: "gdpr-request" }
    ]
  },

  cookies: {
    slug: "cookies",
    eyebrow: "Privacy",
    title: "Cookie Policy",
    summary: "How ServeOS uses cookies and similar technologies on our marketing site, web admin, and customer ordering surfaces.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "what",
        title: "What are cookies?",
        blocks: [
          {
            kind: "p",
            text: "Cookies are small text files stored on your device. We also use local storage and similar technologies for session management and preferences. This policy explains each category and how you can control them."
          }
        ]
      },
      {
        id: "categories",
        title: "Cookie categories",
        blocks: [
          { kind: "sub", title: "Strictly necessary", blocks: [
            { kind: "p", text: "Required for authentication, security, load balancing, and core platform functionality. These cannot be disabled without breaking the service." },
            { kind: "ul", items: ["Session and refresh tokens", "CSRF and security cookies", "Venue context and admin workspace selection"] }
          ]},
          { kind: "sub", title: "Functional", blocks: [
            { kind: "p", text: "Remember choices such as language, theme, and dismissed notices to improve your experience." }
          ]},
          { kind: "sub", title: "Analytics", blocks: [
            { kind: "p", text: "Help us understand usage patterns, diagnose errors, and measure performance. We minimize identifiable data in analytics." }
          ]},
          { kind: "sub", title: "Marketing", blocks: [
            { kind: "p", text: "Used only where you have consented, to measure campaign effectiveness on our public marketing pages." }
          ]}
        ]
      },
      {
        id: "duration",
        title: "Duration",
        blocks: [
          {
            kind: "ul",
            items: [
              "Session cookies — deleted when you close your browser or sign out",
              "Persistent cookies — typically 1–12 months depending on purpose",
              "Authentication refresh tokens — rotated on use and revoked on password change or admin action"
            ]
          }
        ]
      },
      {
        id: "control",
        title: "Managing cookies",
        blocks: [
          {
            kind: "p",
            text: "You can control non-essential cookies through your browser settings. Blocking necessary cookies may prevent login or ordering. Where required by law, we present a consent banner before setting analytics or marketing cookies on public pages."
          },
          {
            kind: "callout",
            title: "Cookie settings",
            text: "A dedicated in-product cookie preferences panel is rolling out across marketing and guest surfaces. Until then, use your browser controls or contact us to record your preferences."
          }
        ]
      },
      {
        id: "list",
        title: "Current cookie list",
        blocks: [
          {
            kind: "p",
            text: "We maintain an updated technical cookie inventory aligned with our subprocessors. Key first-party identifiers include serveos_session, serveos_workspace, and serveos_consent where applicable."
          }
        ]
      }
    ],
    relatedLinks: [
      { label: "Privacy Policy", slug: "privacy" },
      { label: "Legal Center", slug: "center" }
    ]
  },

  terms: {
    slug: "terms",
    eyebrow: "Agreement",
    title: "Terms of Service",
    summary: "The primary agreement between ServeOS and restaurant operators for use of the platform, subscriptions, and connected services.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "acceptance",
        title: "Acceptance",
        blocks: [
          {
            kind: "p",
            text: "By creating an account, starting a trial, or using ServeOS, you agree to these Terms of Service and our Privacy Policy. If you accept on behalf of a company, you represent that you have authority to bind that entity."
          }
        ]
      },
      {
        id: "accounts",
        title: "Account terms",
        blocks: [
          { kind: "ul", items: [
            "You must be at least 18 and legally able to enter contracts",
            "Registration information must be accurate and kept up to date",
            "You are responsible for credentials, 2FA devices, and all activity under your account",
            "Notify us immediately of unauthorized access at security@serveos.com"
          ]}
        ]
      },
      {
        id: "subscriptions",
        title: "Subscriptions & billing",
        blocks: [
          { kind: "ul", items: [
            "Plans, features, and pricing are described at signup and in your admin billing area",
            "Trials convert to paid subscriptions unless cancelled before the trial ends",
            "Fees are billed in advance on a recurring basis unless otherwise agreed",
            "Taxes may apply based on your jurisdiction and legal entity status",
            "Cancellation stops future renewals; access continues until the end of the paid period unless otherwise stated"
          ]},
          { kind: "link", label: "Refund & Billing Policy", slug: "billing" }
        ]
      },
      {
        id: "platform-use",
        title: "Platform usage",
        blocks: [
          { kind: "sub", title: "Permitted use", blocks: [
            { kind: "p", text: "Use ServeOS to operate legitimate restaurant, café, bar, hotel F&B, or related hospitality businesses in compliance with applicable law." }
          ]},
          { kind: "sub", title: "Prohibited use", blocks: [
            { kind: "ul", items: [
              "Reverse engineering, scraping, or circumventing security controls",
              "Uploading malware, spam, or unlawful content",
              "Misrepresenting menu items, prices, or availability",
              "Sharing accounts in ways that bypass permission controls"
            ]}
          ]},
          { kind: "link", label: "Acceptable Use Policy", slug: "acceptable-use" }
        ]
      },
      {
        id: "restaurant-duties",
        title: "Restaurant responsibilities",
        blocks: [
          { kind: "ul", items: [
            "Menu, allergen, and pricing accuracy displayed to guests",
            "Compliance with food safety, alcohol licensing, and consumer protection laws",
            "Correct tax configuration and fiscal reporting in your jurisdiction",
            "Obtaining lawful bases to process guest data you collect through ServeOS"
          ]}
        ]
      },
      {
        id: "staff",
        title: "Staff management",
        blocks: [
          { kind: "ul", items: [
            "Venue owners control staff invitations, roles, and permissions",
            "You are responsible for actions taken by users you invite",
            "Ownership transfer and owner protection rules are enforced server-side",
            "Suspended or removed staff lose access immediately when sessions are revoked"
          ]}
        ]
      },
      {
        id: "communications",
        title: "Communications",
        blocks: [
          {
            kind: "p",
            text: "ServeOS may send transactional email, SMS, and push notifications for orders, reservations, security alerts, and account events. You must obtain guest consent where required for marketing messages sent through the platform."
          }
        ]
      },
      {
        id: "ip",
        title: "Intellectual property",
        blocks: [
          { kind: "ul", items: [
            "ServeOS owns the platform, software, branding, and documentation",
            "You retain ownership of your menus, photos, and venue content",
            "You grant ServeOS a limited license to host and display your content to provide the service"
          ]}
        ]
      },
      {
        id: "availability",
        title: "Service availability",
        blocks: [
          {
            kind: "p",
            text: "We target high availability but do not guarantee uninterrupted service. Planned maintenance is communicated in advance where practicable. Features may evolve; material changes are communicated through product notices or email."
          }
        ]
      },
      {
        id: "liability",
        title: "Liability",
        blocks: [
          {
            kind: "p",
            text: "To the maximum extent permitted by law, ServeOS is not liable for indirect, incidental, or consequential damages. Our aggregate liability is limited to fees paid by you in the twelve months preceding the claim. Nothing limits liability for fraud, gross negligence, or rights that cannot be waived under Swedish law."
          }
        ]
      },
      {
        id: "termination",
        title: "Termination",
        blocks: [
          { kind: "ul", items: [
            "You may close your account according to billing settings",
            "We may suspend or terminate for material breach, abuse, or legal requirement",
            "Upon termination, export windows and data deletion follow the DPA and retention policies"
          ]}
        ]
      },
      {
        id: "law",
        title: "Governing law & disputes",
        blocks: [
          {
            kind: "p",
            text: "These Terms are governed by the laws of Sweden. Disputes shall be resolved in Stockholm courts unless mandatory consumer protections require otherwise. We encourage contacting support@serveos.com before formal proceedings."
          }
        ]
      }
    ],
    relatedLinks: [
      { label: "Data Processing Agreement", slug: "dpa" },
      { label: "Privacy Policy", slug: "privacy" },
      { label: "Legal Center", slug: "center" }
    ]
  },

  dpa: {
    slug: "dpa",
    eyebrow: "Agreement",
    title: "Data Processing Agreement",
    summary: "GDPR Article 28 terms between your restaurant (controller) and ServeOS (processor) for guest, staff, and operational data processed in your workspace.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "parties",
        title: "Parties & roles",
        blocks: [
          {
            kind: "p",
            text: "The Customer (restaurant operator) is the data controller for personal data relating to guests, staff, and venue operations. ServeOS AB is the data processor when handling that data on the Customer's instructions through the platform."
          }
        ]
      },
      {
        id: "scope",
        title: "Processing scope",
        blocks: [
          { kind: "ul", items: [
            "Guest orders, reservations, profiles, and communications",
            "Staff accounts, permissions, shifts, and audit trails",
            "Payment metadata and transaction references",
            "Technical logs required to operate, secure, and support the service"
          ]}
        ]
      },
      {
        id: "instructions",
        title: "Processor obligations",
        blocks: [
          { kind: "ul", items: [
            "Process personal data only on documented instructions from the controller",
            "Ensure personnel are bound by confidentiality",
            "Implement appropriate technical and organizational security measures",
            "Assist with data subject requests where technically feasible",
            "Delete or return data at end of service subject to legal retention requirements"
          ]}
        ]
      },
      {
        id: "subprocessors",
        title: "Subprocessors",
        blocks: [
          {
            kind: "p",
            text: "The Customer authorizes ServeOS to engage subprocessors listed in our Subprocessor List. We notify material changes and maintain flow-down obligations consistent with GDPR."
          },
          { kind: "link", label: "Subprocessor List", slug: "subprocessors" }
        ]
      },
      {
        id: "breach",
        title: "Breach notification",
        blocks: [
          {
            kind: "p",
            text: "ServeOS will notify the Customer without undue delay after becoming aware of a personal data breach affecting Customer data, providing information reasonably available to support the Customer's regulatory obligations."
          }
        ]
      },
      {
        id: "transfers",
        title: "International transfers",
        blocks: [
          {
            kind: "p",
            text: "Where subprocessors process data outside the EU/EEA, ServeOS implements appropriate safeguards including Standard Contractual Clauses and supplementary technical measures."
          }
        ]
      },
      {
        id: "annex-a",
        title: "Annex A — Processing activities",
        blocks: [
          { kind: "ul", items: [
            "Subject matter: Restaurant operations platform (orders, reservations, staff, payments)",
            "Duration: Term of the subscription plus statutory retention",
            "Nature & purpose: Hosting, transmission, display, analytics, support, security",
            "Categories of data subjects: Guests, staff, venue contacts",
            "Categories of data: Identity, contact, order, reservation, payment metadata, usage logs"
          ]}
        ]
      },
      {
        id: "annex-b",
        title: "Annex B — Security measures",
        blocks: [
          { kind: "ul", items: [
            "Encryption in transit (TLS) and encryption at rest for databases",
            "Role-based access control with server-enforced permissions",
            "Multi-factor authentication for privileged accounts",
            "Session revocation on suspension, password reset, and security events",
            "Audit logging for sensitive staff and ownership actions",
            "Monitoring and incident response procedures"
          ]},
          { kind: "link", label: "Security & Compliance", slug: "security" }
        ]
      }
    ],
    relatedLinks: [
      { label: "Privacy Policy", slug: "privacy" },
      { label: "Terms of Service", slug: "terms" },
      { label: "Subprocessor List", slug: "subprocessors" }
    ]
  },

  security: {
    slug: "security",
    eyebrow: "Trust",
    title: "Security & Compliance",
    summary: "How ServeOS protects restaurant operations, customer data, and payments — and how we approach compliance, incidents, and transparency.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "practices",
        title: "Security practices",
        blocks: [
          { kind: "ul", items: [
            "TLS encryption for all API and web traffic",
            "Bcrypt password hashing and optional TOTP-based two-factor authentication",
            "Server-side permission enforcement — the frontend is never trusted for access control",
            "Session management with refresh rotation and admin-initiated revocation",
            "Structured audit logs for staff, ownership, and permission changes"
          ]}
        ]
      },
      {
        id: "infrastructure",
        title: "Infrastructure",
        blocks: [
          {
            kind: "p",
            text: "ServeOS production infrastructure follows our deployment architecture: a single API on Render, static web surfaces on Render, PostgreSQL on Neon, Redis on Upstash, and mobile builds via Expo EAS."
          },
          { kind: "sub", title: "Key subprocessors", blocks: [
            { kind: "ul", items: [
              "Neon — primary database (PostgreSQL)",
              "Upstash — Redis cache, sessions, queues, and realtime",
              "Render — API and web hosting",
              "Stripe — payment processing",
              "Resend — transactional email",
              "Twilio — SMS where configured",
              "Sentry — error monitoring and performance",
              "Expo EAS — mobile application builds"
            ]}
          ]},
          { kind: "link", label: "Full Subprocessor List", slug: "subprocessors" }
        ]
      },
      {
        id: "compliance",
        title: "Compliance",
        blocks: [
          { kind: "ul", items: [
            "GDPR-aligned privacy and data processing practices",
            "Cookie consent on marketing surfaces where required",
            "Data Processing Agreement available for B2B customers",
            "Ownership and permission safeguards to prevent privilege escalation"
          ]}
        ]
      },
      {
        id: "incident",
        title: "Incident response",
        blocks: [
          {
            kind: "p",
            text: "We maintain runbooks for detection, containment, eradication, and customer notification. Report vulnerabilities or suspected incidents to security@serveos.com."
          },
          { kind: "link", label: "Responsible Disclosure Policy", slug: "responsible-disclosure" }
        ]
      },
      {
        id: "status",
        title: "Uptime & status",
        blocks: [
          {
            kind: "p",
            text: "Operational status and incident history will be published on a dedicated status page as we scale public commitments. Enterprise customers may request uptime reporting in their agreement."
          }
        ]
      }
    ],
    relatedLinks: [
      { label: "Responsible Disclosure", slug: "responsible-disclosure" },
      { label: "DPA", slug: "dpa" },
      { label: "Legal Center", slug: "center" }
    ]
  },

  subprocessors: {
    slug: "subprocessors",
    eyebrow: "Privacy",
    title: "Subprocessor List",
    summary: "Third-party providers that may process personal data on behalf of ServeOS when delivering the platform.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "list",
        title: "Current subprocessors",
        blocks: [
          { kind: "ul", items: [
            "Neon — cloud PostgreSQL database (EU/US regions per configuration)",
            "Upstash — Redis cache, pub/sub, and rate limiting",
            "Render — application and static site hosting",
            "Stripe — payment processing and billing",
            "Resend — transactional and invitation email",
            "Twilio — SMS notifications where enabled",
            "Sentry — application monitoring and error tracking",
            "Expo (EAS) — mobile build and distribution infrastructure"
          ]}
        ]
      },
      {
        id: "changes",
        title: "Changes",
        blocks: [
          {
            kind: "p",
            text: "We update this list when subprocessors are added or replaced. Material changes are communicated to business customers via email or in-product notice where required by the DPA."
          }
        ]
      }
    ],
    relatedLinks: [
      { label: "Privacy Policy", slug: "privacy" },
      { label: "DPA", slug: "dpa" }
    ]
  },

  "data-retention": {
    slug: "data-retention",
    eyebrow: "Privacy",
    title: "Data Retention Policy",
    summary: "How long ServeOS retains different categories of data and when deletion occurs.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "principles",
        title: "Principles",
        blocks: [
          {
            kind: "p",
            text: "We retain data for the minimum period needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements."
          }
        ]
      },
      {
        id: "categories",
        title: "Retention by category",
        blocks: [
          { kind: "ul", items: [
            "Active account & venue data — retained while subscription is active",
            "Guest orders & reservations — configurable per venue; default aligned with operational and tax needs",
            "Staff audit logs — typically 24 months for security investigations",
            "Authentication sessions — until expiry, logout, or revocation",
            "Backups — rolling retention with secure deletion on schedule",
            "Billing records — per Swedish accounting and tax law (generally 7 years)"
          ]}
        ]
      },
      {
        id: "deletion",
        title: "Deletion",
        blocks: [
          {
            kind: "p",
            text: "On account closure, we delete or anonymize controller data within agreed timelines except where law requires retention. Processor deletion procedures are described in the DPA."
          }
        ]
      }
    ],
    relatedLinks: [{ label: "Privacy Policy", slug: "privacy" }, { label: "DPA", slug: "dpa" }]
  },

  "acceptable-use": {
    slug: "acceptable-use",
    eyebrow: "Operations",
    title: "Acceptable Use Policy",
    summary: "Rules for using ServeOS lawfully, securely, and respectfully.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "rules",
        title: "Prohibited conduct",
        blocks: [
          { kind: "ul", items: [
            "Illegal activities, harassment, or discrimination",
            "Spam, phishing, or unauthorized bulk messaging",
            "Fraudulent orders, payment abuse, or chargeback manipulation",
            "Attempting to access other venues' data or bypass permissions",
            "Interfering with platform stability or other customers' service"
          ]}
        ]
      },
      {
        id: "enforcement",
        title: "Enforcement",
        blocks: [
          {
            kind: "p",
            text: "Violations may result in warning, suspension, or termination. We may report illegal activity to authorities where required."
          }
        ]
      }
    ],
    relatedLinks: [{ label: "Terms of Service", slug: "terms" }, { label: "Legal Center", slug: "center" }]
  },

  "responsible-disclosure": {
    slug: "responsible-disclosure",
    eyebrow: "Security",
    title: "Responsible Disclosure Policy",
    summary: "How security researchers can report vulnerabilities safely and how we respond.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "report",
        title: "Reporting",
        blocks: [
          {
            kind: "p",
            text: `Email ${SECURITY_CONTACT} with a description, reproduction steps, and impact assessment. Encrypt sensitive details if possible. Do not access or modify data belonging to other customers.`
          }
        ]
      },
      {
        id: "response",
        title: "Our response",
        blocks: [
          { kind: "ul", items: [
            "Acknowledgement within 3 business days for valid reports",
            "Status updates as we investigate and remediate",
            "Credit in release notes where appropriate and agreed",
            "No legal action for good-faith research that follows this policy"
          ]}
        ]
      }
    ],
    relatedLinks: [{ label: "Security & Compliance", slug: "security" }]
  },

  billing: {
    slug: "billing",
    eyebrow: "Operations",
    title: "Refund & Billing Policy",
    summary: "How subscriptions, trials, invoices, and refunds work on ServeOS.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "billing",
        title: "Billing",
        blocks: [
          { kind: "ul", items: [
            "Subscriptions renew automatically unless cancelled",
            "Prices are shown exclusive or inclusive of VAT as indicated at checkout",
            "Payment methods are processed securely via Stripe",
            "Failed payments may result in grace period then service restriction"
          ]}
        ]
      },
      {
        id: "refunds",
        title: "Refunds",
        blocks: [
          {
            kind: "p",
            text: "Trial periods are free. Paid subscriptions are generally non-refundable for partial months except where required by consumer law or explicitly agreed in writing. Contact billing@serveos.com for billing disputes."
          }
        ]
      }
    ],
    relatedLinks: [{ label: "Terms of Service", slug: "terms" }]
  },

  "gdpr-request": {
    slug: "gdpr-request",
    eyebrow: "Privacy",
    title: "GDPR & Data Subject Requests",
    summary: "Exercise your rights to access, correct, delete, or port personal data processed by ServeOS.",
    lastUpdated: UPDATED,
    sections: [
      {
        id: "how",
        title: "How to submit a request",
        blocks: [
          {
            kind: "p",
            text: `Email ${CONTACT} from the address associated with your account. Include your full name, venue name (if applicable), request type, and any details that help us locate your data. We may verify identity before fulfilling the request.`
          }
        ]
      },
      {
        id: "timeline",
        title: "Response timeline",
        blocks: [
          {
            kind: "p",
            text: "We respond within one month as required by GDPR, extendable by two further months for complex requests with notice. Guest data controlled by a restaurant should often be directed to that venue first; we will assist processors as needed."
          }
        ]
      }
    ],
    relatedLinks: [{ label: "Privacy Policy", slug: "privacy" }, { label: "Data Retention Policy", slug: "data-retention" }]
  }
};

export function getLegalPage(slug: string): LegalPageDef {
  return LEGAL_PAGES[slug] ?? LEGAL_PAGES.center;
}

/** Hub cards for Legal Center — maps section items to slugs */
export const LEGAL_CENTER_CARDS: Array<{
  group: string;
  items: Array<{ label: string; slug: LegalPageDef["slug"]; description: string }>;
}> = [
  {
    group: "Agreements",
    items: [
      { label: "Terms of Service", slug: "terms", description: "Platform agreement, billing, and usage rules" },
      { label: "Data Processing Agreement", slug: "dpa", description: "GDPR processor terms for venue data" }
    ]
  },
  {
    group: "Privacy",
    items: [
      { label: "Privacy Policy", slug: "privacy", description: "What we collect and your rights" },
      { label: "Cookie Policy", slug: "cookies", description: "Cookies and consent" },
      { label: "Subprocessor List", slug: "subprocessors", description: "Third-party providers" },
      { label: "Data Retention Policy", slug: "data-retention", description: "How long we keep data" }
    ]
  },
  {
    group: "Security",
    items: [
      { label: "Security & Compliance", slug: "security", description: "Practices, infrastructure, compliance" },
      { label: "Responsible Disclosure", slug: "responsible-disclosure", description: "Report vulnerabilities" }
    ]
  },
  {
    group: "Operations",
    items: [
      { label: "Acceptable Use Policy", slug: "acceptable-use", description: "Abuse and fraud prevention" },
      { label: "Refund & Billing Policy", slug: "billing", description: "Subscriptions and refunds" }
    ]
  },
  {
    group: "Requests",
    items: [
      { label: "GDPR & data subject requests", slug: "gdpr-request", description: "Access, deletion, portability" }
    ]
  }
];
