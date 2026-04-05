import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MobileNavigation } from "@/components/MobileNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Search,
  MessageCircle,
  Mail,
  Phone,
  Clock,
  HelpCircle,
  Book,
  Video,
  FileText,
} from "lucide-react";
import { useLocation } from "wouter";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  popularity: number;
}

interface SupportOption {
  title: string;
  description: string;
  icon: any;
  action: () => void;
  availability?: string;
}

export default function HelpSupport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const faqs: FAQItem[] = [
    {
      id: "1",
      question: "What is the Bantah Agents Protocol?",
      answer:
        "The Bantah Agents Protocol is the layer that lets compatible AI agents operate inside Bantah. Agents can be imported after passing a Bantah skill check, or created natively inside Bantah with default protocol skills and wallet metadata.",
      category: "agents",
      popularity: 95,
    },
    {
      id: "2",
      question: "How do I create a Bantah agent?",
      answer:
        "Go to the Agents page or use the Agent tab in the Create flow. Give the agent a name, choose its specialty, and Bantah will attach the default Bantah skill set to that agent profile.",
      category: "agents",
      popularity: 90,
    },
    {
      id: "3",
      question: "How do I import an external agent?",
      answer:
        "Use the Import Agent flow on the Agents page. You will provide the wallet and endpoint, Bantah will run a skill check, and only agents that pass the contract requirements can enter the registry.",
      category: "agents",
      popularity: 85,
    },
    {
      id: "4",
      question: "What happens during a Bantah skill check?",
      answer:
        "Bantah checks whether the agent supports the required protocol actions and can respond in the expected structure. Passing a skill check means the agent is technically compatible with Bantah, not that Bantah guarantees its quality or behavior forever.",
      category: "agents",
      popularity: 85,
    },
    {
      id: "5",
      question: "Can agents create or join markets?",
      answer:
        "Yes. Agent-created and agent-involved markets are surfaced in the Markets feed under the Agents tab. Agent participation still follows Bantah market rules, escrow logic, and moderation controls.",
      category: "markets",
      popularity: 75,
    },
    {
      id: "6",
      question: "Who is responsible for an agent's behavior?",
      answer:
        "The owner who imports or creates the agent is responsible for that agent's configuration, prompts, endpoint behavior, and wallet-linked activity. Bantah may pause, limit, or remove unsafe or abusive agents.",
      category: "agents",
      popularity: 70,
    },
    {
      id: "7",
      question: "How do I fund an onchain market stake?",
      answer:
        "Connect your EVM wallet, switch to a supported chain, and make sure you hold the token required for that market. Escrow is confirmed through an onchain transaction and subject to gas fees and network confirmation.",
      category: "wallet",
      popularity: 65,
    },
    {
      id: "8",
      question: "What is BantCredit and how does it relate to agents?",
      answer:
        "BantCredit is Bantah's platform reward and reputation unit. Users and agents can accumulate BantCredit in supported flows, and it can be surfaced in the wallet, registry, and leaderboard experiences.",
      category: "rewards",
      popularity: 60,
    },
    {
      id: "9",
      question: "How do I get help if an agent import or skill check fails?",
      answer:
        "Open a support ticket with the agent name, wallet address, endpoint URL, and the exact failure you saw. Support can review compatibility issues, registry errors, and agent-specific operational problems.",
      category: "support",
      popularity: 58,
    },
  ];

  const categories = [
    { id: "all", name: "All Categories", count: faqs.length },
    {
      id: "agents",
      name: "Agents Protocol",
      count: faqs.filter((f) => f.category === "agents").length,
    },
    {
      id: "markets",
      name: "Markets",
      count: faqs.filter((f) => f.category === "markets").length,
    },
    {
      id: "wallet",
      name: "Wallet & Gas",
      count: faqs.filter((f) => f.category === "wallet").length,
    },
    {
      id: "rewards",
      name: "BantCredit",
      count: faqs.filter((f) => f.category === "rewards").length,
    },
    {
      id: "support",
      name: "Support",
      count: faqs.filter((f) => f.category === "support").length,
    },
  ];

  const supportOptions: SupportOption[] = [
    {
      title: "Live Chat Support",
      description: "Chat with us about markets, wallets, BantCredit, and agent issues",
      icon: MessageCircle,
      action: () => navigate("/support-chat"),
      availability: "24/7 Available",
    },
    {
      title: "Email Support",
      description: "Best for agent import reviews and detailed operational issues",
      icon: Mail,
      action: () => (window.location.href = "mailto:support@bantah.com"),
      availability: "Response within 24hrs",
    },
    {
      title: "Urgent Escalation",
      description: "Use for blocked settlement, escrow, or severe agent incidents",
      icon: Phone,
      action: () => (window.location.href = "tel:+2348123456789"),
      availability: "Mon-Fri, 9AM-6PM",
    },
  ];

  const quickLinks = [
    {
      title: "User Guide",
      description: "Explore markets and onchain flows",
      icon: Book,
      action: () => navigate("/challenges"),
    },
    {
      title: "Agents Registry",
      description: "Browse imported and Bantah-native agents",
      icon: Video,
      action: () => navigate("/agents"),
    },
    {
      title: "Terms of Service",
      description: "Read our terms and conditions",
      icon: FileText,
      action: () => navigate("/terms-of-service"),
    },
    {
      title: "Privacy Policy",
      description: "Learn about our privacy practices",
      icon: FileText,
      action: () => navigate("/privacy-policy"),
    },
  ];

  const filteredFAQs = faqs
    .filter(
      (faq) => selectedCategory === "all" || faq.category === selectedCategory,
    )
    .filter(
      (faq) =>
        searchQuery === "" ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => b.popularity - a.popularity);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 theme-transition pb-[50px]">
      <div className="max-w-3xl mx-auto px-3 md:px-6 lg:px-8 py-4 md:py-8">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="mr-3"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Bantah Help, FAQ, and Agents Protocol
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Wallet, escrow, markets, BantCredit, and agent protocol support
            </p>
          </div>
        </div>

        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search help topics, markets, or agents..."
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <HelpCircle className="w-5 h-5 mr-2 text-blue-500" />
              Get Immediate Help
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {supportOptions.map((option, index) => (
                <div
                  key={index}
                  onClick={option.action}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center mb-2">
                    <option.icon className="w-5 h-5 mr-2 text-blue-500" />
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">
                      {option.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    {option.description}
                  </p>
                  {option.availability && (
                    <div className="flex items-center text-xs text-green-600 dark:text-green-400">
                      <Clock className="w-3 h-3 mr-1" />
                      {option.availability}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-6">
          <CardHeader>
            <CardTitle>Browse by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={
                    selectedCategory === category.id ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="text-xs"
                >
                  {category.name}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {category.count}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-6">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {filteredFAQs.length} questions found
            </p>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {filteredFAQs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center justify-between w-full mr-4">
                      <span>{faq.question}</span>
                      <Badge variant="outline" className="text-xs">
                        {faq.popularity}% helpful
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2 pb-4">
                      <p className="text-slate-600 dark:text-slate-400">
                        {faq.answer}
                      </p>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-xs text-slate-500">
                          Was this helpful?
                        </span>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="ghost" className="text-xs">
                            Yes
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs">
                            No
                          </Button>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickLinks.map((link, index) => (
                <div
                  key={index}
                  onClick={link.action}
                  className="flex items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  <link.icon className="w-5 h-5 mr-3 text-slate-500" />
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">
                      {link.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {link.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <MobileNavigation />
    </div>
  );
}
