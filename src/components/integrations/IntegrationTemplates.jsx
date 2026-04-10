import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, DollarSign, Target } from "lucide-react";

const templates = [
  {
    name: "Xero",
    description: "Accounting and financial management",
    category: "accounting",
    icon: DollarSign,
    function_name: "integrations/xero",
    credentials: ["XERO_API_KEY"],
    color: "emerald"
  },
  {
    name: "Outlook",
    description: "Email and calendar management",
    category: "email",
    icon: Mail,
    function_name: "integrations/outlook",
    credentials: ["OUTLOOK_ACCESS_TOKEN"],
    color: "blue"
  },
  {
    name: "Facebook",
    description: "Social media content publishing",
    category: "social",
    icon: Target,
    function_name: "integrations/facebook",
    credentials: ["FACEBOOK_ACCESS_TOKEN", "FACEBOOK_PAGE_ID"],
    color: "violet"
  },
  {
    name: "Instagram",
    description: "Post content and reels to Instagram",
    category: "social",
    icon: Target,
    function_name: "integrations/instagram",
    credentials: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID"],
    color: "pink"
  }
];

export default function IntegrationTemplates({ onSelect }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((template) => {
        const Icon = template.icon;
        return (
          <div
            key={template.name}
            className={`rounded-2xl bg-${template.color}-500/[0.08] border border-${template.color}-500/20 p-5`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-xl bg-${template.color}-500/20`}>
                <Icon className={`w-5 h-5 text-${template.color}-400`} />
              </div>
              <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/20">
                Template
              </Badge>
            </div>

            <h3 className="text-sm font-semibold text-white mb-1">{template.name}</h3>
            <p className="text-xs text-slate-400 mb-3">{template.description}</p>

            <div className="mb-3">
              <p className="text-[10px] text-slate-500 mb-1">Required credentials:</p>
              {template.credentials.map((cred) => (
                <Badge key={cred} variant="outline" className="text-[9px] mr-1 mb-1">
                  {cred}
                </Badge>
              ))}
            </div>

            <Button
              onClick={() => onSelect(template)}
              className="w-full bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              Install Template
            </Button>
          </div>
        );
      })}
    </div>
  );
}