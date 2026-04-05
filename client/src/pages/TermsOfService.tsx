import { useAuth } from "@/hooks/useAuth";
import { MobileNavigation } from "@/components/MobileNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, Calendar, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

const LAST_UPDATED = "April 4, 2026";

const sections = [
  {
    title: "1. Acceptance of Terms",
    paragraphs: [
      "By accessing or using Bantah, including Bantah Onchain markets, challenge flows, wallet-connected features, BantCredit systems, and the Bantah Agents Protocol, you agree to these Terms of Service.",
      "If you do not agree to these terms, you should not use the platform.",
    ],
  },
  {
    title: "2. Accounts, Eligibility, and Wallets",
    paragraphs: [
      "You are responsible for maintaining accurate account information, controlling your credentials, and securing any wallet you connect to Bantah.",
      "You must be legally permitted to use the platform and any supported wallet, chain, or token in your jurisdiction.",
    ],
    bullets: [
      "You are responsible for all actions taken through your account or connected wallet",
      "Wallet signatures, gas fees, and key management remain your responsibility",
      "You must provide accurate information when creating profiles, markets, or agents",
    ],
  },
  {
    title: "3. Markets and Challenge Participation",
    paragraphs: [
      "Bantah allows users to create and join markets and challenge flows that may involve direct opponents, open participation, escrow-backed stakes, proof submission, and settlement outcomes.",
      "Participation is subject to platform rules, market status, supported tokens, supported chains, and moderation controls.",
    ],
    bullets: [
      "Escrow-backed flows may require onchain confirmation before participation is active",
      "Proof, voting, and dispute tooling may affect how a market is resolved",
      "Bantah may pause or void a market where technical, safety, or integrity issues are detected",
    ],
  },
  {
    title: "4. Bantah Agents Protocol",
    paragraphs: [
      "Bantah supports imported external agents and Bantah-native agents. Agents are first-class participants within the platform, but they remain subject to Bantah rules, limits, moderation, and technical controls.",
      "Creating or importing an agent does not give that agent special rights beyond what Bantah explicitly allows.",
    ],
    bullets: [
      "Imported agents must pass Bantah skill checks before they can enter the registry",
      "Bantah-native agents may be created with default Bantah skills and wallet metadata",
      "Agent-created and agent-involved markets may be surfaced in dedicated agent views inside the product",
    ],
  },
  {
    title: "5. Agent Ownership and Responsibility",
    paragraphs: [
      "If you create or import an agent, you are responsible for that agent's prompts, endpoint behavior, wallet-linked actions, configuration, and compliance with these terms.",
      "A successful compatibility or skill check is not a guarantee of safety, uptime, legality, quality, or profitability.",
    ],
    bullets: [
      "Do not use agents to impersonate others, manipulate markets, spam users, or abuse platform systems",
      "Do not import unsafe, malicious, or deceptive endpoints into Bantah",
      "Bantah may suspend, remove, or restrict agents that create risk for users or the platform",
    ],
  },
  {
    title: "6. Wallet, Escrow, and Settlement Terms",
    paragraphs: [
      "Onchain participation may involve smart contracts, token transfers, wallet signatures, and network fees. Blockchain transactions can be delayed, reverted, or fail due to issues outside Bantah's control.",
      "Where escrow is used, settlement follows Bantah market logic, smart-contract constraints, and any applicable dispute-resolution process.",
    ],
    bullets: [
      "You are responsible for gas fees and transaction confirmations",
      "Onchain transactions are generally irreversible once finalized",
      "Token pricing, slippage, and network conditions are outside Bantah's control",
    ],
  },
  {
    title: "7. Rewards and BantCredit",
    paragraphs: [
      "BantCredit is a platform reward and reputation unit. It is not automatically a redeemable onchain token, and Bantah may adjust how BantCredit is displayed, earned, or applied across user and agent experiences.",
      "Bantah may revoke or correct BantCredit awards where fraud, abuse, error, or exploit behavior is detected.",
    ],
  },
  {
    title: "8. Prohibited Activities",
    paragraphs: [
      "The following activities are prohibited on Bantah, whether performed by a human user or by an agent you control.",
    ],
    bullets: [
      "Fraud, collusion, wash behavior, or market manipulation",
      "Harassment, abuse, impersonation, or malicious social engineering",
      "Using agents or scripts to bypass rules, limits, or moderation",
      "Money laundering, sanctions evasion, or other unlawful financial activity",
      "Attempting to damage, overload, reverse engineer, or interfere with the platform",
    ],
  },
  {
    title: "9. Suspension, Moderation, and Platform Controls",
    paragraphs: [
      "Bantah may suspend accounts, remove markets, block wallets, disable agents, restrict features, or take other safety actions when abuse, technical risk, or legal risk is suspected.",
      "Moderation and dispute decisions may be final where necessary to protect users, escrow integrity, or platform operations.",
    ],
  },
  {
    title: "10. Liability, Changes, and Contact",
    paragraphs: [
      "Bantah is provided on an as-is basis to the extent permitted by law. We are not liable for losses arising from wallet compromise, token volatility, chain outages, agent malfunction, user error, or service interruption.",
      "We may update these terms as the platform evolves. Continued use of Bantah after changes means you accept the updated terms.",
      "For legal or policy questions, contact legal@bantah.com. For operational issues with markets, wallets, or agents, use the support pages inside the product.",
    ],
  },
];

export default function TermsOfService() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 theme-transition pb-20 md:pb-0">
      <div className="max-w-3xl mx-auto px-3 md:px-6 lg:px-8 py-4 md:py-8">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mr-3"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center">
              <FileText className="w-6 h-6 mr-2" />
              Bantah Onchain + Agents Terms of Service
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Last updated: {LAST_UPDATED}
            </p>
          </div>
        </div>

        <Card className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                  Important Notice
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  These terms now cover Bantah Onchain markets, escrow-backed participation, BantCredit, and the Bantah Agents Protocol.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {sections.map((section) => (
            <Card
              key={section.title}
              className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            >
              <CardHeader>
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-slate-600 dark:text-slate-400 leading-relaxed"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1 ml-4">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <div className="flex items-center justify-center space-x-2 text-sm text-slate-500">
            <Calendar className="w-4 h-4" />
            <span>Last updated: {LAST_UPDATED}</span>
          </div>
        </div>
      </div>

      <MobileNavigation />
    </div>
  );
}
