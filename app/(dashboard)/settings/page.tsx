import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { AI_PROVIDER, DEFAULT_MODEL } from "@/lib/agent/ai";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";

  const env = {
    "Meta verify token": !!process.env.META_VERIFY_TOKEN,
    "Meta app secret": !!process.env.META_APP_SECRET,
    "WhatsApp access token": !!process.env.WHATSAPP_ACCESS_TOKEN,
    "WhatsApp phone number ID": !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    "WhatsApp Business Account ID": !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    [AI_PROVIDER === "gemini" ? "Gemini API key" : "OpenAI API key"]:
      AI_PROVIDER === "gemini" ? !!process.env.GEMINI_API_KEY : !!process.env.OPENAI_API_KEY,
    "Supabase service role key": !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  return (
    <SettingsForm
      initial={data as Settings}
      defaultModel={DEFAULT_MODEL}
      webhookUrl={`${proto}://${host}/api/webhook/whatsapp`}
      env={env}
    />
  );
}
