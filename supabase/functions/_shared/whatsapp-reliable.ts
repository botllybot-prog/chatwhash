type WhatsAppButton = { id: string; title: string };

type SendRawResult = {
  ok: boolean;
  status: number;
  data: any;
  messageId: string | null;
};

export type WhatsAppSendResult = {
  ok: boolean;
  messageId: string | null;
  usedTemplateFallback: boolean;
  error?: string;
};

function normalizePhone(phone: string): string {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{9}$/.test(cleaned)) return `964${cleaned.slice(1)}`;
  return cleaned;
}

function normalizeTemplateLanguage(code: string | undefined): string {
  const value = (code || "").trim();
  if (!value) return "ar";
  return value;
}

function getFallbackTemplateName(settings: Record<string, string>): string {
  return (
    settings.WHATSAPP_UTILITY_TEMPLATE_NAME ||
    settings.WHATSAPP_FALLBACK_TEMPLATE_NAME ||
    ""
  ).trim();
}

function getFallbackTemplateLanguage(settings: Record<string, string>, language?: string): string {
  // Prefer the approved template language configured in Supabase. This avoids
  // sending "en", "ku", or "tr" when only the Arabic template is approved.
  return normalizeTemplateLanguage(
    settings.WHATSAPP_UTILITY_TEMPLATE_LANG ||
      settings.WHATSAPP_FALLBACK_TEMPLATE_LANG ||
      language,
  );
}

async function sendRaw(
  settings: Record<string, string>,
  payload: Record<string, unknown>,
): Promise<SendRawResult> {
  const token = settings.WHATSAPP_ACCESS_TOKEN;
  const phoneId = settings.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    return {
      ok: false,
      status: 400,
      data: { error: { message: "Missing WhatsApp configuration keys." } },
      messageId: null,
    };
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...payload,
    }),
  });

  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    data,
    messageId: data?.messages?.[0]?.id ?? null,
  };
}

async function sendTemplateFallback(
  settings: Record<string, string>,
  phone: string,
  plainText: string,
  language?: string,
): Promise<SendRawResult> {
  const templateName = getFallbackTemplateName(settings);
  const templateLang = getFallbackTemplateLanguage(settings, language);

  if (!templateName) {
    return {
      ok: false,
      status: 400,
      data: {
        error: {
          message:
            "Template fallback is not configured. Set WHATSAPP_UTILITY_TEMPLATE_NAME in app_settings.",
        },
      },
      messageId: null,
    };
  }

  const safeText = plainText.length > 1000 ? `${plainText.slice(0, 997)}...` : plainText;

  return sendRaw(settings, {
    to: normalizePhone(phone),
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: safeText }],
        },
      ],
    },
  });
}

export async function sendWhatsAppTextReliable(params: {
  phone: string;
  message: string;
  settings: Record<string, string>;
  language?: string;
}): Promise<WhatsAppSendResult> {
  const { phone, message, settings, language } = params;
  if (!phone) return { ok: false, messageId: null, usedTemplateFallback: false, error: "Missing phone." };

  const direct = await sendRaw(settings, {
    to: normalizePhone(phone),
    type: "text",
    text: { body: message },
  });

  if (direct.ok) {
    return { ok: true, messageId: direct.messageId, usedTemplateFallback: false };
  }

  if (!getFallbackTemplateName(settings)) {
    return {
      ok: false,
      messageId: null,
      usedTemplateFallback: false,
      error: String(direct?.data?.error?.message || "WhatsApp text send failed."),
    };
  }

  const fallback = await sendTemplateFallback(settings, phone, message, language);
  if (fallback.ok) {
    // Once the approved template wakes the chat outside the 24h window,
    // retry the plain text so the recipient sees the full live message too.
    const followUp = await sendRaw(settings, {
      to: normalizePhone(phone),
      type: "text",
      text: { body: message },
    });

    return {
      ok: true,
      messageId: followUp.messageId || fallback.messageId,
      usedTemplateFallback: true,
    };
  }

  return {
    ok: false,
    messageId: null,
    usedTemplateFallback: true,
    error: String(
      fallback?.data?.error?.message ||
        direct?.data?.error?.message ||
        "Template fallback send failed.",
    ),
  };
}

export async function sendWhatsAppInteractiveReliable(params: {
  phone: string;
  body: string;
  buttons: WhatsAppButton[];
  settings: Record<string, string>;
  language?: string;
}): Promise<WhatsAppSendResult> {
  const { phone, body, buttons, settings, language } = params;
  if (!phone) return { ok: false, messageId: null, usedTemplateFallback: false, error: "Missing phone." };

  const direct = await sendRaw(settings, {
    to: normalizePhone(phone),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((button) => ({
          type: "reply",
          reply: {
            id: button.id,
            title: button.title,
          },
        })),
      },
    },
  });

  if (direct.ok) {
    return { ok: true, messageId: direct.messageId, usedTemplateFallback: false };
  }

  if (!getFallbackTemplateName(settings)) {
    return {
      ok: false,
      messageId: null,
      usedTemplateFallback: false,
      error: String(direct?.data?.error?.message || "WhatsApp interactive send failed."),
    };
  }

  const fallbackText =
    `${body}\n\n` +
    "Interactive buttons were replaced by a normal notification because the chat session window has expired.";
  const fallback = await sendTemplateFallback(settings, phone, fallbackText, language);

  if (fallback.ok) {
    return { ok: true, messageId: fallback.messageId, usedTemplateFallback: true };
  }

  return {
    ok: false,
    messageId: null,
    usedTemplateFallback: true,
    error: String(
      fallback?.data?.error?.message ||
        direct?.data?.error?.message ||
        "Template fallback send failed.",
    ),
  };
}
